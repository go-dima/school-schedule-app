import type {
  ClassSlot,
  ClassSlotWithTimeSlot,
  ClassWithTimeSlot,
  ScheduleOverrideWithTimeSlot,
  ScheduleSelectionWithClass,
  SelectionStatus,
  TimeSlot,
  UserRole,
  WeeklySchedule,
} from "../types";
import { isLessonTimeSlot } from "../utils/timeSlots";

// Placeholder "all option" classes that only staff/admin may select; hidden
// entirely from the schedule catalog for everyone else.
const STAFF_ONLY_CLASS_TITLES = new Set(["חונכות", "שילוב"]);

export class ScheduleService {
  static slotKey(slot: ClassSlot): string {
    return `${slot.dayOfWeek}:${slot.timeSlotId}`;
  }

  static buildWeeklySchedule(classes: ClassWithTimeSlot[]): WeeklySchedule {
    const schedule: WeeklySchedule = {};

    classes.forEach(cls => {
      cls.slots.forEach(slot => {
        const { dayOfWeek, timeSlotId } = slot;

        if (!schedule[dayOfWeek]) {
          schedule[dayOfWeek] = {};
        }

        if (!schedule[dayOfWeek][timeSlotId]) {
          schedule[dayOfWeek][timeSlotId] = [];
        }

        schedule[dayOfWeek][timeSlotId].push(cls);
      });
    });

    return schedule;
  }

  static getPrimarySlot(cls: ClassWithTimeSlot): ClassSlotWithTimeSlot {
    return [...cls.slots].sort(
      (a, b) =>
        a.dayOfWeek - b.dayOfWeek ||
        a.timeSlot.startTime.localeCompare(b.timeSlot.startTime)
    )[0];
  }

  static isPrimarySlot(
    cls: ClassWithTimeSlot,
    dayOfWeek: number,
    timeSlotId: string
  ): boolean {
    const primary = this.getPrimarySlot(cls);
    return primary.dayOfWeek === dayOfWeek && primary.timeSlotId === timeSlotId;
  }

  static slotsOverlap(a: ClassSlot[], b: ClassSlot[]): boolean {
    const aKeys = new Set(a.map(this.slotKey));
    return b.some(slot => aKeys.has(this.slotKey(slot)));
  }

  /** Strips a hydrated slot (or form row) down to the raw {dayOfWeek, timeSlotId} pair stored on a class. */
  static toRawSlots(slots: ClassSlot[]): ClassSlot[] {
    return slots.map(({ dayOfWeek, timeSlotId }) => ({
      dayOfWeek,
      timeSlotId,
    }));
  }

  /**
   * The specific pair of slots a Double Lesson occupies: some slot in
   * `cls.slots` plus its immediately-following lesson slot (same day), where
   * both are actually present. Found by adjacency, not array position —
   * `cls.slots` may also carry other, unrelated slots that sort earlier.
   */
  static getDoubleLessonPair(
    cls: ClassWithTimeSlot,
    allTimeSlots: TimeSlot[]
  ): [ClassSlotWithTimeSlot, ClassSlotWithTimeSlot] | null {
    if (!cls.isDouble) return null;

    for (const slot of cls.slots) {
      const next = this.getNextConsecutiveTimeSlot(slot.timeSlot, allTimeSlots);
      if (!next) continue;

      const secondSlot = cls.slots.find(
        s => s.dayOfWeek === slot.dayOfWeek && s.timeSlotId === next.id
      );
      if (secondSlot) {
        return [slot, secondSlot];
      }
    }

    return null;
  }

  static isDoubleLessonSecondSlot(
    cls: ClassWithTimeSlot,
    dayOfWeek: number,
    timeSlotId: string,
    allTimeSlots: TimeSlot[]
  ): boolean {
    const pair = this.getDoubleLessonPair(cls, allTimeSlots);
    if (!pair) return false;
    const [, second] = pair;
    return second.dayOfWeek === dayOfWeek && second.timeSlotId === timeSlotId;
  }

  static getConflictingClasses(
    userSelections: ScheduleSelectionWithClass[],
    newClass: ClassWithTimeSlot
  ): ClassWithTimeSlot[] {
    const conflicts = userSelections
      .filter(
        selection =>
          selection.class.id !== newClass.id &&
          this.slotsOverlap(newClass.slots, selection.class.slots)
      )
      .map(selection => selection.class);

    // Remove duplicates
    return conflicts.filter(
      (conflict, index, self) =>
        self.findIndex(c => c.id === conflict.id) === index
    );
  }

  static hasTimeConflict(
    userSelections: ScheduleSelectionWithClass[],
    newClass: ClassWithTimeSlot
  ): boolean {
    return this.getConflictingClasses(userSelections, newClass).length > 0;
  }

  /**
   * Conflicts to flag among the drawer's candidates for one slot. Candidates
   * are already blocked from selection whenever the slot itself has a
   * selection (single-choice-per-slot), so that state is never a "conflict"
   * to warn about -- only a candidate that could otherwise be picked (e.g. a
   * double lesson whose other slot is already taken by a different
   * selection) counts as a real conflict.
   */
  static getDrawerConflicts(
    classesForSlot: ClassWithTimeSlot[],
    userSelections: ScheduleSelectionWithClass[],
    selectedClasses: string[],
    dayOfWeek: number,
    timeSlotId: string
  ): ClassWithTimeSlot[] {
    const hasSelectionInThisSlot = classesForSlot.some(cls =>
      selectedClasses.includes(cls.id)
    );
    if (hasSelectionInThisSlot) return [];

    const otherUserSelections = userSelections.filter(
      selection =>
        !selection.class.slots.some(
          slot => slot.dayOfWeek === dayOfWeek && slot.timeSlotId === timeSlotId
        )
    );

    return classesForSlot.filter(cls => {
      if (selectedClasses.includes(cls.id)) return false;
      return this.hasTimeConflict(otherUserSelections, cls);
    });
  }

  static getNextConsecutiveTimeSlot(
    currentTimeSlot: TimeSlot,
    allTimeSlots: TimeSlot[]
  ): TimeSlot | null {
    // Filter lesson time slots for the same day and sort by start time
    const daySlots = allTimeSlots
      .filter(slot => isLessonTimeSlot(slot))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Find the current slot index
    const currentIndex = daySlots.findIndex(
      slot => slot.id === currentTimeSlot.id
    );

    // Return the next slot if it exists
    if (currentIndex >= 0 && currentIndex < daySlots.length - 1) {
      return daySlots[currentIndex + 1];
    }

    return null;
  }

  static formatTimeRange(startTime: string, endTime: string): string {
    const formatTime = (time: string): string => {
      if (!time) return "";

      // If time is in HH:MM:SS format, convert to HH:MM
      if (time.includes(":")) {
        const parts = time.split(":");
        return `${parts[0]}:${parts[1]}`;
      }

      return time;
    };

    const formattedStart = formatTime(startTime);
    const formattedEnd = formatTime(endTime);

    // If both times are missing, return empty string
    if (!formattedStart && !formattedEnd) {
      return "";
    }

    // If only one time is missing, return the available one
    if (!formattedStart) return formattedEnd;
    if (!formattedEnd) return formattedStart;

    // Both times available, return range
    return `${formattedEnd} - ${formattedStart}`;
  }

  static validateTimeSlot(startTime: string, endTime: string): boolean {
    if (!startTime || !endTime) return false;

    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);

    return start < end;
  }

  /**
   * The single decision point for which selection state a viewer edits/sees:
   * staff and admin always work in committed, everyone else (parent, child,
   * or no role yet) works in draft.
   */
  static resolveSelectionStatus(role: UserRole | undefined): SelectionStatus {
    return role === "staff" || role === "admin" ? "committed" : "draft";
  }

  /**
   * The single decision point for schedule_overrides visibility/edit rights,
   * collapsing what used to be three separately-reasoned-about inputs
   * (role, the parent's draft/committed toggle, which child is selected)
   * into one small, unit-testable state. An override has no draft/committed
   * status of its own in the DB, but it represents committed reality (a
   * staff decision) -- mixing it into a parent's draft would look like
   * something the parent picked themselves, so it only ever appears
   * alongside a *committed* view: a parent's own draft, a parent's
   * committed view (+ overrides), or staff's view (always committed, so
   * always + overrides). See scheduleService.test.ts for the full matrix.
   */
  static resolveScheduleView(input: {
    role: UserRole | undefined;
    viewCommitted: boolean;
    parentSelectedChildId: string | undefined;
    staffSelectedChildId: string | undefined;
  }): {
    viewStatus: SelectionStatus;
    overrideChildId: string | undefined;
    canCreateOverride: boolean;
  } {
    const isStaff = input.role === "staff";
    const isParent = input.role === "parent";

    const viewStatus: SelectionStatus =
      isParent && input.viewCommitted
        ? "committed"
        : ScheduleService.resolveSelectionStatus(input.role);

    const overrideChildId: string | undefined =
      viewStatus === "committed"
        ? isStaff
          ? input.staffSelectedChildId
          : input.parentSelectedChildId
        : undefined;

    const canCreateOverride = isStaff && !!input.staffSelectedChildId;

    return { viewStatus, overrideChildId, canCreateOverride };
  }

  /**
   * Stable-sorts classes so draft-marked ones come first (preserving
   * relative order within each group), with staff-only placeholder classes
   * (e.g. "חונכות", "שילוב") pushed after all non-staff-only classes within
   * each group. Intended for the drawer's already-non-selected "available"
   * subset -- a class in both `classes` and `draftClassIds` just moves to
   * the front, it is never duplicated.
   */
  static orderClassesByPickStatus(
    classes: ClassWithTimeSlot[],
    draftClassIds: Set<string>
  ): ClassWithTimeSlot[] {
    return [...classes].sort((a, b) => {
      const aIsDraft = draftClassIds.has(a.id) ? 0 : 1;
      const bIsDraft = draftClassIds.has(b.id) ? 0 : 1;
      if (aIsDraft !== bIsDraft) return aIsDraft - bIsDraft;

      const aIsStaffOnly = STAFF_ONLY_CLASS_TITLES.has(a.title) ? 1 : 0;
      const bIsStaffOnly = STAFF_ONLY_CLASS_TITLES.has(b.title) ? 1 : 0;
      return aIsStaffOnly - bIsStaffOnly;
    });
  }

  /**
   * Removes staff-only placeholder classes (e.g. "חונכות", "שילוב") from the
   * catalog for non-staff/admin viewers, so they never appear as pickable
   * options for parents/children.
   */
  static excludeStaffOnlyClasses(
    classes: ClassWithTimeSlot[],
    isStaffOrAdmin: boolean
  ): ClassWithTimeSlot[] {
    if (isStaffOrAdmin) return classes;
    return classes.filter(cls => !STAFF_ONLY_CLASS_TITLES.has(cls.title));
  }

  /** True for staff-only placeholder classes (e.g. "חונכות", "שילוב"). */
  static isStaffOnlyClass(cls: ClassWithTimeSlot): boolean {
    return STAFF_ONLY_CLASS_TITLES.has(cls.title);
  }

  /**
   * Combines a catalog's weekly schedule with a second schedule (e.g. a
   * user's actual selections, built via `buildWeeklySchedule` from
   * unfiltered class data) so classes present in either show up once per
   * day/slot. Used to let an already-committed pick stay visible even when
   * the catalog feed has filtered it out (e.g. a staff-only class selected
   * for a child, hidden from the parent's pickable catalog) -- the caller
   * is responsible for ensuring `overlay` only ever contains classes the
   * viewer is actually allowed to see (e.g. their own/child's selections),
   * since this merge applies no permission filtering itself.
   */
  static mergeWeeklySchedules(
    base: WeeklySchedule,
    overlay: WeeklySchedule
  ): WeeklySchedule {
    const merged: WeeklySchedule = {};
    const days = new Set([
      ...Object.keys(base).map(Number),
      ...Object.keys(overlay).map(Number),
    ]);

    days.forEach(day => {
      merged[day] = {};
      const slotIds = new Set([
        ...Object.keys(base[day] || {}),
        ...Object.keys(overlay[day] || {}),
      ]);

      slotIds.forEach(slotId => {
        const baseClasses = base[day]?.[slotId] || [];
        const overlayClasses = overlay[day]?.[slotId] || [];
        const seenIds = new Set(baseClasses.map(cls => cls.id));
        merged[day][slotId] = [
          ...baseClasses,
          ...overlayClasses.filter(cls => !seenIds.has(cls.id)),
        ];
      });
    });

    return merged;
  }

  /**
   * The overrides (if any) that apply to a specific day/slot cell. A
   * non-empty result means the cell should render these instead of whatever
   * catalog/selected classes would otherwise occupy it -- the single source
   * of truth for that precedence rule, shared by the live grid and print so
   * the two render paths can't independently drift on it.
   */
  static getOverridesForCell(
    overrides: ScheduleOverrideWithTimeSlot[],
    dayOfWeek: number,
    timeSlotId: string
  ): ScheduleOverrideWithTimeSlot[] {
    return overrides.filter(
      o => o.dayOfWeek === dayOfWeek && o.timeSlotId === timeSlotId
    );
  }
}
