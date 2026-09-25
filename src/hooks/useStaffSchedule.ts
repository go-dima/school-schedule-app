import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_STAFF_VIEW,
  StaffScheduleService,
} from "../services/staffScheduleService";
import type { StaffMember, StaffView } from "../services/staffScheduleService";

// The Staff View's data flow: the pickable staff members, and one staff
// member's week. Independent of the student-view hooks (catalog,
// selections, overrides) -- the page just chooses which feed reaches the
// table. `enabled` keeps it fully idle (zero requests) outside Staff View.
export function useStaffSchedule(
  enabled: boolean,
  staffName: string | undefined
) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [view, setView] = useState<StaffView>(EMPTY_STAFF_VIEW);
  const [staffLoading, setStaffLoading] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped by refetch() to re-run both effects.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;

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
  }, [enabled, reloadKey]);

  useEffect(() => {
    if (!enabled || !staffName) {
      setView(EMPTY_STAFF_VIEW);
      setViewLoading(false);
      return;
    }

    let mounted = true;
    const loadView = async () => {
      setViewLoading(true);
      setError(null);
      try {
        const data = await StaffScheduleService.getStaffView(staffName);
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
  }, [enabled, staffName, reloadKey]);

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
