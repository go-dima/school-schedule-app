import { useEffect, useState } from "react";
import { StaffScheduleService } from "../services/staffScheduleService";
import type { StaffMember } from "../services/staffScheduleService";
import log from "../utils/logger";

// The pickable staff members (directory users + name-only teachers), for
// the teacher picker in the class and override forms. A failed load leaves
// the list empty: the picker still accepts free text, and
// resolveTeacherUserId keeps an existing link while the text is unchanged.
export function useStaffMembers() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    StaffScheduleService.getStaffMembers()
      .then(data => {
        if (mounted) setMembers(data);
      })
      .catch(err => log.warn("Failed to load staff members", { error: err }))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { members, loading };
}
