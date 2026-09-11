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
        this.isLockedMatch(cls, child.groupNumber) &&
        !alreadySelectedIds.has(cls.id)
    );

    const toUnselectIds = currentSchedule
      .filter(selection => {
        const cls = selection.class;
        const wasGroupOrMandatory = cls.groupNumber !== null || cls.isMandatory;
        return (
          wasGroupOrMandatory && !this.isLockedMatch(cls, child.groupNumber)
        );
      })
      .map(selection => selection.classId);

    return { toSelect, toUnselectIds };
  },

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
        scheduleApi.selectSchedule({ childId }, cls.id, status)
      ),
    ]);
  },
};
