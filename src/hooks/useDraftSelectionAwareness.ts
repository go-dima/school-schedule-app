import { useEffect, useState } from "react";
import { scheduleApi } from "../services/api";
import type { ScheduleTarget } from "../types";

// Read-only, staff/admin-only awareness of a child's draft (not yet
// committed) picks -- surfaced as a heart marker in the drawer so staff can
// see pending parent intent while making their own independent committed
// selection. Deliberately exposes no select/unselect/refetch surface: this
// hook must never be able to mutate a draft selection.
export function useDraftSelectionAwareness(target: ScheduleTarget | undefined) {
  const [draftClassIds, setDraftClassIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetKey = target
    ? "userId" in target
      ? `user:${target.userId}`
      : `child:${target.childId}`
    : undefined;

  useEffect(() => {
    if (!target) {
      setDraftClassIds(new Set());
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadDraftSelections = async () => {
      setLoading(true);
      setError(null);
      try {
        const draftSchedule = await scheduleApi.getSelectedSchedule(
          target,
          "draft"
        );
        if (mounted) {
          setDraftClassIds(
            new Set(draftSchedule.map(selection => selection.classId))
          );
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load draft selections"
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadDraftSelections();

    return () => {
      mounted = false;
    };
  }, [targetKey]);

  const isClassDraftPicked = (classId: string): boolean => {
    return draftClassIds.has(classId);
  };

  return {
    draftClassIds,
    isClassDraftPicked,
    loading,
    error,
  };
}
