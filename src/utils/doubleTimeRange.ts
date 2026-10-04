import { ScheduleService } from "../services/scheduleService";
import type { TimeSlot, ClassWithTimeSlot } from "../types";

// Helper function to get combined time range for double lessons
export const getDoubleTimeRange = (
  cls: ClassWithTimeSlot,
  allTimeSlots: TimeSlot[]
): string => {
  const primaryTimeSlot = ScheduleService.getPrimarySlot(cls).timeSlot;

  if (!cls.isDouble)
    return ScheduleService.formatTimeRange(
      primaryTimeSlot.startTime,
      primaryTimeSlot.endTime
    );

  // Find the next consecutive time slot
  const nextTimeSlot = ScheduleService.getNextConsecutiveTimeSlot(
    primaryTimeSlot,
    allTimeSlots
  );
  if (nextTimeSlot) {
    return ScheduleService.formatTimeRange(
      primaryTimeSlot.startTime,
      nextTimeSlot.endTime
    );
  }

  // Fallback to original time if next slot not found
  return ScheduleService.formatTimeRange(
    primaryTimeSlot.startTime,
    primaryTimeSlot.endTime
  );
};
