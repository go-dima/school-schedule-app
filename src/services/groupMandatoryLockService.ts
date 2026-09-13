import { scheduleApi } from "./api";
import type {
  Child,
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  SelectionStatus,
} from "../types";

export interface GroupMandatoryChanges {
  toSelect: ClassWithTimeSlot[];
  toUnselectIds: string[];
}

/** Postgres SQLSTATE for unique_violation. */
const PG_UNIQUE_VIOLATION = "23505";

/**
 * True when `err` is a database unique-constraint violation.
 *
 * Matched strictly on the Postgres SQLSTATE carried by the error (surfaced
 * as `ApiError.code`, originally the PostgrestError's `code`) -- never on
 * the message text, which is wording- and locale-dependent.
 */
export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

export const GroupMandatoryLockService = {
  /**
   * A class is a Locked Selection for a child when its group matches the
   * child's group exactly, or -- for an ungrouped class -- when it's
   * marked mandatory. A grouped-and-mandatory class (schools run the same
   * mandatory subject at different times per group) still requires the
   * group match; it doesn't get a mandatory-only exception.
   */
  isLockedMatch(
    cls: Pick<ClassWithTimeSlot, "groupNumber" | "isMandatory">,
    childGroupNumber: number | null
  ): boolean {
    if (cls.groupNumber !== null) {
      return cls.groupNumber === childGroupNumber;
    }
    return cls.isMandatory;
  },

  computeChanges(
    allClasses: ClassWithTimeSlot[],
    currentSchedule: ScheduleSelectionWithClass[],
    child: Pick<Child, "grade" | "groupNumber">
  ): GroupMandatoryChanges {
    const alreadySelectedIds = new Set(
      currentSchedule.map(selection => selection.classId)
    );

    const toSelect = allClasses.filter(
      cls =>
        cls.grades.includes(child.grade) &&
        GroupMandatoryLockService.isLockedMatch(cls, child.groupNumber) &&
        !alreadySelectedIds.has(cls.id)
    );

    const toUnselectIds = currentSchedule
      .filter(selection => {
        const cls = selection.class;
        const wasGroupOrMandatory = cls.groupNumber !== null || cls.isMandatory;
        return (
          wasGroupOrMandatory &&
          !GroupMandatoryLockService.isLockedMatch(cls, child.groupNumber)
        );
      })
      .map(selection => selection.classId);

    return { toSelect, toUnselectIds };
  },

  /**
   * Auto-assignment is idempotent by nature: the goal is "this child ends up
   * with exactly the locked selections for their group/grade", not "this
   * particular insert was the one that created the row". A unique-constraint
   * violation on schedule_selections therefore means the desired row already
   * exists (a concurrent sync, another tab, or a computeChanges run against a
   * not-yet-refetched snapshot) -- the end state is already correct, so it is
   * swallowed rather than surfaced as a user-facing error. Every other error
   * still propagates.
   *
   * Unselects are not wrapped: they are DELETEs keyed on
   * child_id + class_id + status, and deleting zero rows is a success, not an
   * error -- a redundant concurrent unselect simply no-ops in Postgres.
   */
  async applyChanges(
    childId: string,
    { toSelect, toUnselectIds }: GroupMandatoryChanges,
    status: SelectionStatus
  ): Promise<void> {
    await Promise.all([
      ...toUnselectIds.map(classId =>
        scheduleApi.unselectSchedule({ childId }, classId, status)
      ),
      ...toSelect.map(cls =>
        scheduleApi.selectSchedule({ childId }, cls.id, status).catch(err => {
          if (isDuplicateKeyError(err)) return undefined;
          throw err;
        })
      ),
    ]);
  },
};
