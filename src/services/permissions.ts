import type { UserRoleData } from "../types";
import { getRoleFlags } from "./roleFlags";

export interface PermissionsState {
  canManageClasses: boolean; // admin || staff || moderator — gates ClassManagementPage/catalog editing
  canCreateClasses: boolean; // admin || moderator
  canDeleteClasses: boolean; // admin || moderator
  canViewAllSchedules: boolean; // admin || staff (moderator excluded)
  canManageRoster: boolean; // admin || staff (moderator excluded)
  canApproveSignups: boolean; // admin only
  canAdjustRoles: boolean; // admin only
}

// Pure permission computation from a user's role rows, derived from the same
// approved-role identity flags as getRoleFlags (see roleFlags.ts).
export function getPermissions(roles: UserRoleData[]): PermissionsState {
  const { isAdmin, isStaff, isModerator } = getRoleFlags(roles);

  return {
    canManageClasses: isAdmin || isStaff || isModerator,
    canCreateClasses: isAdmin || isModerator,
    canDeleteClasses: isAdmin || isModerator,
    canViewAllSchedules: isAdmin || isStaff,
    canManageRoster: isAdmin || isStaff,
    canApproveSignups: isAdmin,
    canAdjustRoles: isAdmin,
  };
}
