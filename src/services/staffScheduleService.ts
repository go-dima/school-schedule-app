import type {
  ClassWithTimeSlot,
  ScheduleOverrideWithChildName,
  ScheduleSelectionWithClass,
  StaffDirectoryEntry,
  StaffSelection,
  TeacherTitlePair,
  WeeklySchedule,
} from "../types";
import { classesApi, scheduleApi, scheduleOverridesApi, staffApi } from "./api";
import { ScheduleService } from "./scheduleService";

// Placeholder `teacher` values -- not real people, so they never show up as
// staff members to pick (e.g. the generic mentor on mentoring classes).
const HIDDEN_TEACHER_NAMES = new Set(["חונכ/ת", "כללי", "לא ידוע"]);

const OVERRIDE_ID_PREFIX = "override:";
const SELECTION_ID_PREFIX = "selection:";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Everything ScheduleTable / printSchedule need to render one staff
 * member's week. Built entirely from the existing props those two already
 * consume, so the Staff View needs no rendering code of its own.
 */
export interface StaffView {
  classes: ClassWithTimeSlot[];
  weeklySchedule: WeeklySchedule;
  // Every id in `classes`, so every cell renders as a "selected" card.
  selectedClasses: string[];
  // Synthetic selection wrappers, so ScheduleService.hasTimeConflict flags
  // two different lessons that share a slot -- the table's existing
  // `conflict` highlighting then works unchanged.
  userSelections: ScheduleSelectionWithClass[];
  // Override pseudo-class id -> number of children in that group.
  extraEnrollmentCounts: Map<string, number>;
}

/**
 * Who a Staff View shows: a user account (classes/overrides linked by
 * user_id, plus the Special Classes they selected for children), or a
 * name-only teacher without an account (matched on `teacher` text).
 */
export type StaffKey =
  | { kind: "user"; id: string }
  | { kind: "name"; name: string };

/**
 * A pickable staff member. `teaches` is false when they have no regular
 * (non-Special) catalog lesson -- still listed, but after everyone who does.
 */
export interface StaffMember {
  key: StaffKey;
  label: string;
  teaches: boolean;
}

/** `?selected=` value -> key: a UUID is a user, anything else a name. */
export function parseStaffKey(
  param: string | null | undefined
): StaffKey | undefined {
  const value = param?.trim();
  if (!value) return undefined;
  return UUID_PATTERN.test(value)
    ? { kind: "user", id: value }
    : { kind: "name", name: value };
}

export function staffKeyToParam(key: StaffKey): string {
  return key.kind === "user" ? key.id : key.name;
}

export const EMPTY_STAFF_VIEW: StaffView = {
  classes: [],
  weeklySchedule: {},
  selectedClasses: [],
  userSelections: [],
  extraEnrollmentCounts: new Map(),
};

const uniqueJoined = (values: string[]): string =>
  Array.from(new Set(values.map(v => v.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "he"))
    .join(", ");

/**
 * Collapses overrides sharing (title, day, slot) into one pseudo-class, so a
 * staff member teaching the same one-off lesson to several children sees a
 * single entry listing all of them -- and a group never conflicts with
 * itself, since it's one id.
 *
 * Overrides are deliberately turned into classes rather than passed via
 * ScheduleTable's `overrides` prop: that prop short-circuits a cell and
 * HIDES the catalog class under it, which would hide exactly the conflicts
 * this view exists to show.
 */
function overridesToPseudoClasses(overrides: ScheduleOverrideWithChildName[]): {
  classes: ClassWithTimeSlot[];
  counts: Map<string, number>;
} {
  const groups = new Map<string, ScheduleOverrideWithChildName[]>();
  overrides.forEach(o => {
    const id = `${OVERRIDE_ID_PREFIX}${o.dayOfWeek}:${o.timeSlotId}:${o.title.trim()}`;
    groups.set(id, [...(groups.get(id) || []), o]);
  });

  const classes: ClassWithTimeSlot[] = [];
  const counts = new Map<string, number>();

  groups.forEach((group, id) => {
    const [first] = group;
    classes.push({
      id,
      title: first.title.trim(),
      description: "",
      // The card's second line: who this lesson is for.
      teacher: uniqueJoined(group.map(o => o.childName)),
      slots: [
        {
          dayOfWeek: first.dayOfWeek,
          timeSlotId: first.timeSlotId,
          timeSlot: first.timeSlot,
        },
      ],
      grades: [],
      isMandatory: false,
      isDouble: false,
      groupNumber: null,
      trackNumber: null,
      room: uniqueJoined(group.map(o => o.room)),
      scope: first.scope,
      createdAt: first.createdAt,
      updatedAt: first.updatedAt,
    });
    counts.set(id, new Set(group.map(o => o.childId)).size);
  });

  return { classes, counts };
}

/**
 * Collapses a tutor's selections into one pseudo-class per catalog class,
 * listing the children it was selected for -- the catalog `teacher` on a
 * Special Class is only a placeholder (e.g. "חונכ/ת").
 */
function selectionsToPseudoClasses(selections: StaffSelection[]): {
  classes: ClassWithTimeSlot[];
  counts: Map<string, number>;
} {
  const groups = new Map<string, StaffSelection[]>();
  selections.forEach(s => {
    groups.set(s.class.id, [...(groups.get(s.class.id) || []), s]);
  });

  const classes: ClassWithTimeSlot[] = [];
  const counts = new Map<string, number>();

  groups.forEach((group, classId) => {
    const id = `${SELECTION_ID_PREFIX}${classId}`;
    classes.push({
      ...group[0].class,
      id,
      // The card's second line: who this lesson is for.
      teacher: uniqueJoined(group.map(s => s.childName)),
    });
    counts.set(id, new Set(group.map(s => s.childId)).size);
  });

  return { classes, counts };
}

export class StaffScheduleService {
  /**
   * Pure: turns the three Staff View streams into ScheduleTable props.
   * - catalog: classes the staff member teaches (Special Classes dropped)
   * - selections: Special Classes the staff member set for children, grouped
   * - overrides: one-off lessons assigned to the staff member, grouped
   */
  static buildStaffView(input: {
    catalog: ClassWithTimeSlot[];
    selections: StaffSelection[];
    overrides: ScheduleOverrideWithChildName[];
  }): StaffView {
    const catalog = input.catalog.filter(
      cls => !ScheduleService.isSpecialClass(cls)
    );
    const { classes: selectionClasses, counts: selectionCounts } =
      selectionsToPseudoClasses(input.selections);
    const { classes: overrideClasses, counts: overrideCounts } =
      overridesToPseudoClasses(input.overrides);

    const classes = [...catalog, ...selectionClasses, ...overrideClasses];

    return {
      classes,
      weeklySchedule: ScheduleService.buildWeeklySchedule(classes),
      selectedClasses: classes.map(cls => cls.id),
      userSelections: classes.map(cls => ({
        id: `staff-view:${cls.id}`,
        userId: "",
        classId: cls.id,
        status: "committed",
        createdAt: "",
        updatedAt: "",
        class: cls,
      })),
      extraEnrollmentCounts: new Map([...selectionCounts, ...overrideCounts]),
    };
  }

  /**
   * Pure: the pickable staff members.
   * - every directory user, labelled by display name; their linked catalog
   *   classes count towards them
   * - every distinct trimmed `teacher` of an unlinked class (teachers
   *   without an account), minus placeholders and names a user already has
   * Ordered alphabetically, with everyone who teaches a regular
   * (non-Special) lesson first and the rest after them -- the lesson count
   * only decides which group, never the order within it.
   */
  static toStaffMembers(
    pairs: TeacherTitlePair[],
    directory: StaffDirectoryEntry[]
  ): StaffMember[] {
    const members = new Map<string, StaffMember>();
    const userLabels = new Set(directory.map(d => d.displayName));

    directory.forEach(({ id, displayName }) => {
      members.set(`user:${id}`, {
        key: { kind: "user", id },
        label: displayName,
        teaches: false,
      });
    });

    pairs.forEach(({ teacher, title, userId }) => {
      const isRegular = !ScheduleService.isSpecialClass({ title });
      const linked = userId ? members.get(`user:${userId}`) : undefined;
      if (linked) {
        linked.teaches ||= isRegular;
        return;
      }

      const name = teacher.trim();
      if (!name || HIDDEN_TEACHER_NAMES.has(name) || userLabels.has(name)) {
        return;
      }
      const id = `name:${name}`;
      const member = members.get(id) ?? {
        key: { kind: "name", name },
        label: name,
        teaches: false,
      };
      member.teaches ||= isRegular;
      members.set(id, member);
    });

    const byLabel = (a: StaffMember, b: StaffMember) =>
      a.label.localeCompare(b.label, "he");
    const all = Array.from(members.values());
    return [
      ...all.filter(m => m.teaches).sort(byLabel),
      ...all.filter(m => !m.teaches).sort(byLabel),
    ];
  }

  /**
   * Pure: a name that is now a user's display name (e.g. an old
   * `?selected=<name>` link from before the user was linked) resolves to
   * that user, so the view includes their selections.
   */
  static resolveStaffKey(
    key: StaffKey,
    directory: StaffDirectoryEntry[]
  ): StaffKey {
    if (key.kind === "user") return key;
    const user = directory.find(d => d.displayName === key.name);
    return user ? { kind: "user", id: user.id } : key;
  }

  /**
   * Pure: the Linked Teacher for a class/override form's `teacher` text --
   * the staff user whose display name it is exactly (display names are
   * unique), else null (a teacher without an account). While the text is
   * unchanged the existing link is kept, so a staff list that failed to
   * load never silently unlinks a class on save.
   */
  static resolveTeacherUserId(
    teacher: string,
    members: StaffMember[],
    initial?: { teacher: string; userId?: string | null }
  ): string | null {
    const text = teacher.trim();
    if (initial?.userId && text === initial.teacher.trim()) {
      return initial.userId;
    }
    const match = members.find(m => m.key.kind === "user" && m.label === text);
    return match?.key.kind === "user" ? match.key.id : null;
  }

  static async getStaffMembers(): Promise<StaffMember[]> {
    const [pairs, directory] = await Promise.all([
      classesApi.getTeacherTitlePairs(),
      staffApi.getStaffDirectory(),
    ]);
    return this.toStaffMembers(pairs, directory);
  }

  static async getCatalogForStaff(key: StaffKey): Promise<ClassWithTimeSlot[]> {
    const classes =
      key.kind === "user"
        ? await classesApi.getClassesByUserId(key.id)
        : await classesApi.getClassesByTeacher(key.name);
    return classes.filter(cls => !ScheduleService.isSpecialClass(cls));
  }

  static async getOverridesForStaff(
    key: StaffKey
  ): Promise<ScheduleOverrideWithChildName[]> {
    return key.kind === "user"
      ? scheduleOverridesApi.getOverridesByUserId(key.id)
      : scheduleOverridesApi.getOverridesByTeacher(key.name);
  }

  /**
   * Staff-only Special Classes (חונכות, שילוב, מחויבות אישית) this user set
   * for children -- the tutor is whoever committed the selection. כישורי
   * חיים is pre-selected, so its selector says nothing about who teaches it
   * (known gap until a staff <-> child relationship exists). Name-only
   * teachers have no account, so they never made a selection.
   */
  static async getSelectionsForStaff(key: StaffKey): Promise<StaffSelection[]> {
    if (key.kind !== "user") return [];
    const selections = await scheduleApi.getCommittedSelectionsMadeBy(key.id);
    return selections.filter(s => ScheduleService.isStaffOnlyClass(s.class));
  }

  /** Fetches all three streams for `key` and builds the view. */
  static async getStaffView(key: StaffKey): Promise<StaffView> {
    const resolved =
      key.kind === "name"
        ? this.resolveStaffKey(key, await staffApi.getStaffDirectory())
        : key;
    const [catalog, selections, overrides] = await Promise.all([
      this.getCatalogForStaff(resolved),
      this.getSelectionsForStaff(resolved),
      this.getOverridesForStaff(resolved),
    ]);
    return this.buildStaffView({ catalog, selections, overrides });
  }
}
