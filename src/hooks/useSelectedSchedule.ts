import { useEffect, useState } from "react";
import { scheduleApi } from "../services/api";
import type {
  ScheduleSelectionWithClass,
  ScheduleTarget,
  SelectionStatus,
} from "../types";

// A specific person's selected classes -- either a student a parent/staff
// member has picked ({ childId }) or the "child" role's own picks
// ({ userId }). Replaces the old useChildSchedule and the selections half
// of the old useSchedule.
export function useSelectedSchedule(
  target: ScheduleTarget | undefined,
  status: SelectionStatus
) {
  const [schedule, setSchedule] = useState<ScheduleSelectionWithClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetKey = target
    ? "userId" in target
      ? `user:${target.userId}`
      : `child:${target.childId}`
    : undefined;

  useEffect(() => {
    if (!target) {
      setSchedule([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadSchedule = async () => {
      setLoading(true);
      setError(null);
      try {
        const selectedSchedule = await scheduleApi.getSelectedSchedule(
          target,
          status
        );
        if (mounted) {
          setSchedule(selectedSchedule);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load schedule"
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
  }, [targetKey, status]);

  const refetch = async (): Promise<void> => {
    if (!target) return;
    const selectedSchedule = await scheduleApi.getSelectedSchedule(
      target,
      status
    );
    setSchedule(selectedSchedule);
  };

  const select = async (classId: string): Promise<void> => {
    if (!target) throw new Error("No selection target");

    try {
      await scheduleApi.selectSchedule(target, classId, status);
      const selectedSchedule = await scheduleApi.getSelectedSchedule(
        target,
        status
      );
      setSchedule(selectedSchedule);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to select class";
      setError(message);
      throw new Error(message);
    }
  };

  const unselect = async (classId: string): Promise<void> => {
    if (!target) throw new Error("No selection target");

    try {
      await scheduleApi.unselectSchedule(target, classId, status);
      const selectedSchedule = await scheduleApi.getSelectedSchedule(
        target,
        status
      );
      setSchedule(selectedSchedule);
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
    select,
    unselect,
    isClassSelected,
    refetch,
  };
}
