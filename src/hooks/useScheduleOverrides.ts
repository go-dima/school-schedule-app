import { useEffect, useState } from "react";
import { scheduleOverridesApi } from "../services/api";
import type { ScheduleOverride, ScheduleOverrideWithTimeSlot } from "../types";

// A child's staff-authored one-off lessons. Fourth independent data-flow
// hook alongside useScheduleCatalog, useSelectedSchedule and
// useDraftSelectionAwareness -- must never be called from or merged into
// any of those three.
export function useScheduleOverrides(childId: string | undefined) {
  const [overrides, setOverrides] = useState<ScheduleOverrideWithTimeSlot[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) {
      setOverrides([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadOverrides = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await scheduleOverridesApi.getOverrides(childId);
        if (mounted) {
          setOverrides(data);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load overrides"
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadOverrides();

    return () => {
      mounted = false;
    };
  }, [childId]);

  const refetch = async (): Promise<void> => {
    if (!childId) return;
    const data = await scheduleOverridesApi.getOverrides(childId);
    setOverrides(data);
  };

  const createOverride = async (
    override: Omit<
      ScheduleOverride,
      "id" | "createdBy" | "createdAt" | "updatedAt"
    >
  ): Promise<void> => {
    try {
      await scheduleOverridesApi.createOverride(override);
      await refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create override";
      setError(message);
      throw new Error(message);
    }
  };

  const updateOverride = async (
    id: string,
    updates: Partial<
      Omit<ScheduleOverride, "id" | "createdBy" | "createdAt" | "updatedAt">
    >
  ): Promise<void> => {
    try {
      await scheduleOverridesApi.updateOverride(id, updates);
      await refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update override";
      setError(message);
      throw new Error(message);
    }
  };

  const deleteOverride = async (id: string): Promise<void> => {
    try {
      await scheduleOverridesApi.deleteOverride(id);
      await refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete override";
      setError(message);
      throw new Error(message);
    }
  };

  return {
    overrides,
    loading,
    error,
    createOverride,
    updateOverride,
    deleteOverride,
    refetch,
  };
}
