import { createContext } from "react";
import type { ClassWithTimeSlot, TimeSlot, WeeklySchedule } from "../types";

export interface ScheduleCatalogContextValue {
  classes: ClassWithTimeSlot[];
  timeSlots: TimeSlot[];
  weeklySchedule: WeeklySchedule;
  loading: boolean;
  error: string | null;
  loadScheduleData: () => Promise<void>;
}

export const ScheduleCatalogContext = createContext<
  ScheduleCatalogContextValue | undefined
>(undefined);
