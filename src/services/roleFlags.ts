import type { UserRole, UserRoleData } from "../types";

export interface RoleFlags {
  isAdmin: boolean;
  isStaff: boolean;
  isModerator: boolean;
  isParent: boolean;
  isChild: boolean;
}

// Pure role-identity computation from a user's role rows. Only approved
// roles are considered, matching the approval-status check in useAuth's
// loadUserRoles (roles.filter(role => role.approved)).
export function getRoleFlags(roles: UserRoleData[]): RoleFlags {
  const approvedRoles = roles.filter(role => role.approved);
  const hasRole = (role: UserRole): boolean =>
    approvedRoles.some(r => r.role === role);

  return {
    isAdmin: hasRole("admin"),
    isStaff: hasRole("staff"),
    isModerator: hasRole("moderator"),
    isParent: hasRole("parent"),
    isChild: hasRole("child"),
  };
}
