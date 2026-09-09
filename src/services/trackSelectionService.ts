import { classesApi, scheduleApi } from "./api";
import type {
  Child,
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  SelectionStatus,
} from "../types";

export interface TrackClassChanges {
  toSelect: ClassWithTimeSlot[];
  toUnselectIds: string[];
}

export const TrackSelectionService = {
  /**
   * A class is "track-locked" for a child once its track_number matches the
   * child's current track -- it was (or will be) auto-selected by that track
   * and shouldn't be picked apart one class at a time.
   */
  computeTrackClassChanges(
    allClasses: ClassWithTimeSlot[],
    currentSchedule: ScheduleSelectionWithClass[],
    grade: number,
    newTrackNumber: number | null
  ): TrackClassChanges {
    const toUnselectIds = currentSchedule
      .filter(
        selection =>
          selection.class.trackNumber !== null &&
          selection.class.trackNumber !== newTrackNumber
      )
      .map(selection => selection.classId);

    const alreadySelectedIds = new Set(
      currentSchedule.map(selection => selection.classId)
    );

    const toSelect =
      newTrackNumber === null
        ? []
        : allClasses.filter(
            cls =>
              cls.trackNumber === newTrackNumber &&
              cls.grades.includes(grade) &&
              !alreadySelectedIds.has(cls.id)
          );

    return { toSelect, toUnselectIds };
  },

  async applyTrackClassChanges(
    childId: string,
    { toSelect, toUnselectIds }: TrackClassChanges,
    status: SelectionStatus
  ): Promise<void> {
    await Promise.all([
      ...toUnselectIds.map(classId =>
        scheduleApi.unselectClassForChild(childId, classId, status)
      ),
      ...toSelect.map(cls =>
        scheduleApi.selectClassForChild(childId, cls.id, status)
      ),
    ]);
  },

  /**
   * Convenience wrapper for callers with no classes/schedule already loaded
   * (e.g. the edit-child form). Callers that already hold this data in state
   * (the schedule page) should call computeTrackClassChanges +
   * applyTrackClassChanges directly instead, to avoid re-fetching it.
   */
  async syncTrackClasses(
    child: Pick<Child, "id" | "grade">,
    newTrackNumber: number | null,
    status: SelectionStatus
  ): Promise<void> {
    const [allClasses, currentSchedule] = await Promise.all([
      classesApi.getClasses(),
      scheduleApi.getChildSchedule(child.id, status),
    ]);

    const changes = this.computeTrackClassChanges(
      allClasses,
      currentSchedule,
      child.grade,
      newTrackNumber
    );

    await this.applyTrackClassChanges(child.id, changes, status);
  },
};
