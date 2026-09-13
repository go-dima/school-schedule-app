import React, { createContext, useContext, useEffect, useState } from "react";
import { classesApi, timeSlotsApi } from "../services/api";
import { ScheduleService } from "../services/scheduleService";
import type { ClassWithTimeSlot, TimeSlot, WeeklySchedule } from "../types";
import log from "../utils/logger";
import { useAuth } from "./AuthContext";

interface ScheduleCatalogContextValue {
  classes: ClassWithTimeSlot[];
  timeSlots: TimeSlot[];
  weeklySchedule: WeeklySchedule;
  loading: boolean;
  error: string | null;
  loadScheduleData: () => Promise<void>;
}

const ScheduleCatalogContext = createContext<
  ScheduleCatalogContextValue | undefined
>(undefined);

// The class/time-slot catalog: staff/admin see every class, everyone else
// has staff-only placeholder classes (e.g. "חונכות", "שילוב") excluded.
export const ScheduleCatalogProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { canManageClasses } = useAuth();
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

      const visibleClasses = ScheduleService.excludeStaffOnlyClasses(
        classesData,
        canManageClasses()
      );

      setClasses(visibleClasses);
      setTimeSlots(timeSlotsData);

      // Debug logging for data validation: classes referencing non-existent time slots
      const orphanedClasses = visibleClasses.filter(cls =>
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

      const weeklySchedule =
        ScheduleService.buildWeeklySchedule(visibleClasses);
      setWeeklySchedule(weeklySchedule);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load schedule data"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScheduleCatalogContext.Provider
      value={{
        classes,
        timeSlots,
        weeklySchedule,
        loading,
        error,
        loadScheduleData,
      }}>
      {children}
    </ScheduleCatalogContext.Provider>
  );
};

export function useScheduleCatalog(): ScheduleCatalogContextValue {
  const context = useContext(ScheduleCatalogContext);
  if (!context) {
    throw new Error(
      "useScheduleCatalog must be used within a ScheduleCatalogProvider"
    );
  }
  return context;
}
