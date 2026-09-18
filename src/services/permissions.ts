import type { UserRoleData } from "../types";

export interface PermissionsState {
  canManageClasses: boolean; // admin || staff || moderator — gates ClassManagementPage/catalog editing
  canCreateClasses: boolean; // admin || moderator
  canDeleteClasses: boolean; // admin || moderator
  canViewAllSchedules: boolean; // admin || staff (moderator excluded)
  canManageRoster: boolean; // admin || staff (moderator excluded)
  canApproveSignups: boolean; // admin only
  canAdjustRoles: boolean; // admin only
}

// Pure permission computation from a user's role rows. Only approved roles
// are considered, matching the approval-status check in useAuth's
// loadUserRoles (roles.filter(role => role.approved)).
export function getPermissions(roles: UserRoleData[]): PermissionsState {
  const approvedRoles = roles.filter(role => role.approved);
  const hasRole = (role: string): boolean =>
    approvedRoles.some(r => r.role === role);

  const isAdmin = hasRole("admin");
  const isStaff = hasRole("staff");
  const isModerator = hasRole("moderator");

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
