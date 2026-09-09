import { useEffect, useState } from "react";
import { scheduleApi } from "../services/api";
import type {
  Child,
  ScheduleSelectionWithClass,
  SelectionStatus,
} from "../types";

export function useChildSchedule(
  child: Child | undefined,
  status: SelectionStatus
) {
  const [schedule, setSchedule] = useState<ScheduleSelectionWithClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!child) {
      setSchedule([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadSchedule = async () => {
      setLoading(true);
      setError(null);
      try {
        const childSchedule = await scheduleApi.getChildSchedule(
          child.id,
          status
        );
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
  }, [child?.id, status]);

  const refetch = async (): Promise<void> => {
    if (!child) return;
    const childSchedule = await scheduleApi.getChildSchedule(child.id, status);
    setSchedule(childSchedule);
  };

  const selectClassForChild = async (classId: string): Promise<void> => {
    if (!child) throw new Error("No child selected");

    try {
      await scheduleApi.selectClassForChild(child.id, classId, status);
      // Refresh schedule
      const childSchedule = await scheduleApi.getChildSchedule(
        child.id,
        status
      );
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
      await scheduleApi.unselectClassForChild(child.id, classId, status);
      // Refresh schedule
      const childSchedule = await scheduleApi.getChildSchedule(
        child.id,
        status
      );
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
    refetch,
  };
}
