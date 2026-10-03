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
  // Draft picks for the selected child, the draft/committed toggle, and
  // seeing that child's overrides. Parent and child alike: the only
  // difference is who the selected child is (one of a parent's children, or
  // a child user's own linked student -- see ChildContext).
  canPickSchedule: boolean; // parent || child
  // Add, claim or remove children; child tabs; ChildManagement.
  canManageChildren: boolean; // parent only
}

// Pure permission computation from a user's role rows, derived from the same
// approved-role identity flags as getRoleFlags (see roleFlags.ts).
export function getPermissions(roles: UserRoleData[]): PermissionsState {
  const { isAdmin, isStaff, isModerator, isParent, isChild } =
    getRoleFlags(roles);

  return {
    canManageClasses: isAdmin || isStaff || isModerator,
    canCreateClasses: isAdmin || isModerator,
    canDeleteClasses: isAdmin || isModerator,
    canViewAllSchedules: isAdmin || isStaff,
    canManageRoster: isAdmin || isStaff,
    canApproveSignups: isAdmin,
    canAdjustRoles: isAdmin,
    canPickSchedule: isParent || isChild,
    canManageChildren: isParent,
  };
}
