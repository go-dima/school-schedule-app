import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { scheduleApi } from "../services/api";
import type { Child, ScheduleSelectionWithClass } from "../types";

export function useChildSchedule(child: Child | undefined) {
  const [schedule, setSchedule] = useState<ScheduleSelectionWithClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hasRole } = useAuth();

  // Memoize the dependencies to prevent unnecessary re-renders
  const deps = useMemo(
    () => [child?.id, hasRole("parent"), hasRole("staff")],
    [child?.id, hasRole]
  );

  useEffect(() => {
    if (!child || (!hasRole("parent") && !hasRole("staff"))) {
      setSchedule([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadSchedule = async () => {
      setLoading(true);
      setError(null);
      try {
        const childSchedule = await scheduleApi.getChildSchedule(child.id);
        if (mounted) {
          setSchedule(childSchedule);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load child schedule"
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadSchedule();

    return () => {
      mounted = false;
    };
  }, deps);

  const selectClassForChild = async (classId: string): Promise<void> => {
    if (!child) throw new Error("No child selected");

    try {
      await scheduleApi.selectClassForChild(child.id, classId);
      // Refresh schedule
      const childSchedule = await scheduleApi.getChildSchedule(child.id);
      setSchedule(childSchedule);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to select class";
      setError(message);
      throw new Error(message);
    }
  };

  const unselectClassForChild = async (classId: string): Promise<void> => {
    if (!child) throw new Error("No child selected");

    try {
      await scheduleApi.unselectClassForChild(child.id, classId);
      // Refresh schedule
      const childSchedule = await scheduleApi.getChildSchedule(child.id);
      setSchedule(childSchedule);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to unselect class";
      setError(message);
      throw new Error(message);
    }
  };

  const isClassSelected = (classId: string): boolean => {
    return schedule.some(selection => selection.classId === classId);
  };

  return {
    schedule,
    loading,
    error,
    selectClassForChild,
    unselectClassForChild,
    isClassSelected,
  };
}
