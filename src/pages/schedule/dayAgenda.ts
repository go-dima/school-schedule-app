import { ScheduleService } from "../../services/scheduleService";
import { isLessonTimeSlot } from "../../utils/timeSlots";
import type {
  ClassWithTimeSlot,
  ScheduleOverrideWithTimeSlot,
  ScheduleSelectionWithClass,
  TimeSlot,
  WeeklySchedule,
} from "../../types";
import { classMatchesGrade } from "@/utils/grades";

/** What one time slot of the mobile day view shows. */
export type AgendaEntry =
  | {
      kind: "overrides";
      timeSlot: TimeSlot;
      overrides: ScheduleOverrideWithTimeSlot[];
    }
  | {
      kind: "selected";
      timeSlot: TimeSlot;
      classes: ClassWithTimeSlot[];
      /** Ids of classes shown as a Double Lesson's second slot. */
      continuationIds: string[];
      hasConflict: boolean;
    }
  | { kind: "nonLesson"; timeSlot: TimeSlot }
  | { kind: "unselected"; timeSlot: TimeSlot; optionCount: number }
  | { kind: "empty"; timeSlot: TimeSlot };

export interface DayAgendaInput {
  day: number;
  timeSlots: TimeSlot[];
  weeklySchedule: WeeklySchedule;
  selectedClassIds: string[];
  userSelections: ScheduleSelectionWithClass[];
  overrides: ScheduleOverrideWithTimeSlot[];
  userGrade?: number;
  childGroupNumber?: number | null;
}

/**
 * One day of the schedule as a list, one entry per time slot in start-time
 * order. Mirrors ScheduleTable's cell rules for a single day column, so the
 * mobile day view and the desktop grid show the same thing: an override
 * replaces the slot; a selected class (incl. a Double Lesson's second slot)
 * shows as a card; a break/meeting with no selected class shows its label;
 * otherwise the number of classes on offer, or nothing.
 */
export function buildDayAgenda(input: DayAgendaInput): AgendaEntry[] {
  const {
    day,
    timeSlots,
    weeklySchedule,
    selectedClassIds,
    userSelections,
    overrides,
    userGrade,
    childGroupNumber,
  } = input;
  const isSelected = (cls: ClassWithTimeSlot) =>
    selectedClassIds.includes(cls.id);

  // Same de-duplication and order as ScheduleTable's rows.
  const seen = new Set<string>();
  const slots = timeSlots
    .filter(slot => {
      const key = `${slot.startTime}-${slot.endTime}-${slot.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return slots.map((timeSlot): AgendaEntry => {
    const cellOverrides = ScheduleService.getOverridesForCell(
      overrides,
      day,
      timeSlot.id
    );
    if (cellOverrides.length > 0) {
      return { kind: "overrides", timeSlot, overrides: cellOverrides };
    }

    const inCell = (weeklySchedule[day]?.[timeSlot.id] || [])
      .filter(cls => !userGrade || classMatchesGrade(cls, userGrade))
      .filter(
        cls =>
          childGroupNumber === undefined ||
          isSelected(cls) ||
          cls.groupNumber === null ||
          cls.groupNumber === childGroupNumber
      );

    const continuationIds = inCell
      .filter(
        cls =>
          isSelected(cls) &&
          ScheduleService.isDoubleLessonSecondSlot(
            cls,
            day,
            timeSlot.id,
            timeSlots
          )
      )
      .map(cls => cls.id);
    const selected = inCell.filter(isSelected);

    if (selected.length > 0) {
      return {
        kind: "selected",
        timeSlot,
        classes: selected,
        continuationIds,
        hasConflict: selected.some(cls =>
          ScheduleService.hasConflictInSlot(
            userSelections,
            cls,
            day,
            timeSlot.id
          )
        ),
      };
    }

    if (!isLessonTimeSlot(timeSlot)) return { kind: "nonLesson", timeSlot };

    return inCell.length > 0
      ? { kind: "unselected", timeSlot, optionCount: inCell.length }
      : { kind: "empty", timeSlot };
  });
}
