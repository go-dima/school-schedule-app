import type {
  ClassWithTimeSlot,
  ScheduleOverrideWithChildName,
  ScheduleSelectionWithClass,
  WeeklySchedule,
} from "../types";
import { classesApi, scheduleOverridesApi } from "./api";
import { ScheduleService } from "./scheduleService";

// The generic mentor placeholder used as `teacher` on mentoring classes --
// not a real person, so it never shows up as a staff member to pick.
const GENERIC_MENTOR_NAME = "חונך";

const OVERRIDE_ID_PREFIX = "override:";

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
 * A pickable staff member. `teaches` is false when they have no regular
 * (non-Special) catalog lesson -- still listed, but after everyone who does.
 */
export interface StaffMember {
  name: string;
  teaches: boolean;
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

export class StaffScheduleService {
  /**
   * Pure: turns the three Staff View streams into ScheduleTable props.
   * - catalog: classes the staff member teaches (Special Classes dropped)
   * - selections: Special Classes the staff member was picked for (part 2)
   * - overrides: one-off lessons naming the staff member, grouped
   */
  static buildStaffView(input: {
    catalog: ClassWithTimeSlot[];
    selections: ClassWithTimeSlot[];
    overrides: ScheduleOverrideWithChildName[];
  }): StaffView {
    const catalog = input.catalog.filter(
      cls => !ScheduleService.isSpecialClass(cls)
    );
    const seen = new Set(catalog.map(cls => cls.id));
    const selections = input.selections.filter(cls => {
      if (seen.has(cls.id)) return false;
      seen.add(cls.id);
      return true;
    });
    const { classes: overrideClasses, counts } = overridesToPseudoClasses(
      input.overrides
    );

    const classes = [...catalog, ...selections, ...overrideClasses];

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
      extraEnrollmentCounts: counts,
    };
  }

  /**
   * Pure: distinct, trimmed staff members from (teacher, title) pairs,
   * excluding the generic mentor placeholder. Ordered alphabetically, with
   * everyone who teaches a regular (non-Special) lesson first and the rest
   * after them -- the lesson count only decides which group, never the
   * order within it.
   */
  static toStaffMembers(
    pairs: { teacher: string; title: string }[]
  ): StaffMember[] {
    const regularLessons = new Map<string, number>();
    pairs.forEach(({ teacher, title }) => {
      const name = teacher.trim();
      if (!name || name === GENERIC_MENTOR_NAME) return;
      const isRegular = !ScheduleService.isSpecialClass({ title });
      regularLessons.set(
        name,
        (regularLessons.get(name) ?? 0) + (isRegular ? 1 : 0)
      );
    });

    const members = Array.from(regularLessons, ([name, count]) => ({
      name,
      teaches: count > 0,
    }));
    const byName = (a: StaffMember, b: StaffMember) =>
      a.name.localeCompare(b.name, "he");
    return [
      ...members.filter(m => m.teaches).sort(byName),
      ...members.filter(m => !m.teaches).sort(byName),
    ];
  }

  static async getStaffMembers(): Promise<StaffMember[]> {
    return this.toStaffMembers(await classesApi.getTeacherTitlePairs());
  }

  static async getCatalogForStaff(name: string): Promise<ClassWithTimeSlot[]> {
    const classes = await classesApi.getClassesByTeacher(name);
    return classes.filter(cls => !ScheduleService.isSpecialClass(cls));
  }

  static async getOverridesForStaff(
    name: string
  ): Promise<ScheduleOverrideWithChildName[]> {
    return scheduleOverridesApi.getOverridesByTeacher(name);
  }

  /**
   * Special Classes this staff member was selected for (the member-selection
   * stream). Stub until part 2 adds the user -> catalog-name mapping.
   */
  static async getSelectionsForStaff(
    _name: string
  ): Promise<ClassWithTimeSlot[]> {
    return [];
  }

  /** Fetches all three streams for `name` and builds the view. */
  static async getStaffView(name: string): Promise<StaffView> {
    const [catalog, selections, overrides] = await Promise.all([
      this.getCatalogForStaff(name),
      this.getSelectionsForStaff(name),
      this.getOverridesForStaff(name),
    ]);
    return this.buildStaffView({ catalog, selections, overrides });
  }
}
