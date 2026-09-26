import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_STAFF_VIEW,
  StaffScheduleService,
  staffKeyToParam,
} from "../services/staffScheduleService";
import type {
  StaffKey,
  StaffMember,
  StaffView,
} from "../services/staffScheduleService";

// The Staff View's data flow: the pickable staff members, and one staff
// member's week. Independent of the student-view hooks (catalog,
// selections, overrides) -- the page just chooses which feed reaches the
// table. `enabled` keeps it fully idle (zero requests) outside Staff View;
// `loadStaffList: false` skips the dropdown's list (My schedule has none).
export function useStaffSchedule(
  enabled: boolean,
  staffKey: StaffKey | undefined,
  { loadStaffList = true }: { loadStaffList?: boolean } = {}
) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [view, setView] = useState<StaffView>(EMPTY_STAFF_VIEW);
  const [staffLoading, setStaffLoading] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped by refetch() to re-run both effects.
  const [reloadKey, setReloadKey] = useState(0);

  // Effects key off a string so an equal key object doesn't refetch.
  const keyParam = staffKey
    ? `${staffKey.kind}:${staffKeyToParam(staffKey)}`
    : undefined;

  useEffect(() => {
    if (!enabled || !loadStaffList) return;

    let mounted = true;
    const loadStaff = async () => {
      setStaffLoading(true);
      try {
        const data = await StaffScheduleService.getStaffMembers();
        if (mounted) setStaff(data);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load staff names"
          );
        }
      } finally {
        if (mounted) setStaffLoading(false);
      }
    };

    loadStaff();
    return () => {
      mounted = false;
    };
  }, [enabled, loadStaffList, reloadKey]);

  useEffect(() => {
    if (!enabled || !staffKey) {
      setView(EMPTY_STAFF_VIEW);
      setViewLoading(false);
      return;
    }

    let mounted = true;
    const loadView = async () => {
      setViewLoading(true);
      setError(null);
      try {
        const data = await StaffScheduleService.getStaffView(staffKey);
        if (mounted) setView(data);
      } catch (err) {
        if (mounted) {
          setView(EMPTY_STAFF_VIEW);
          setError(
            err instanceof Error ? err.message : "Failed to load staff schedule"
          );
        }
      } finally {
        if (mounted) setViewLoading(false);
      }
    };

    loadView();
    return () => {
      mounted = false;
    };
    // keyParam stands in for staffKey: equal keys, same string.
  }, [enabled, keyParam, reloadKey]);

  const refetch = useCallback(() => setReloadKey(key => key + 1), []);

  return {
    staff,
    view,
    staffLoading,
    loading: viewLoading,
    error,
    refetch,
  };
}
