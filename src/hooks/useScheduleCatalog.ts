import { useEffect, useState } from "react";
import { classesApi, timeSlotsApi } from "../services/api";
import { ScheduleService } from "../services/scheduleService";
import type { ClassWithTimeSlot, TimeSlot, WeeklySchedule } from "../types";
import log from "../utils/logger";

// The class/time-slot catalog: role-independent, needed by every schedule
// view regardless of who (if anyone) is selected.
export function useScheduleCatalog() {
  const [classes, setClasses] = useState<ClassWithTimeSlot[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadScheduleData();
  }, []);

  const loadScheduleData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [classesData, timeSlotsData] = await Promise.all([
        classesApi.getClasses(),
        timeSlotsApi.getTimeSlots(),
      ]);

      setClasses(classesData);
      setTimeSlots(timeSlotsData);

      // Debug logging for data validation: classes referencing non-existent time slots
      const orphanedClasses = classesData.filter(cls =>
        cls.slots.some(
          slot => !timeSlotsData.find(ts => ts.id === slot.timeSlotId)
        )
      );
      if (orphanedClasses.length > 0) {
        log.warn(
          "Found classes with missing time slots",
          orphanedClasses.map(cls => ({
            id: cls.id,
            title: cls.title,
            slots: cls.slots,
          }))
        );
      }

      const weeklySchedule = ScheduleService.buildWeeklySchedule(classesData);
      setWeeklySchedule(weeklySchedule);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load schedule data"
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    classes,
    timeSlots,
    weeklySchedule,
    loading,
    error,
    loadScheduleData,
  };
}
