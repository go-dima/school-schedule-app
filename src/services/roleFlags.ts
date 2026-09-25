import type { UserRole, UserRoleData } from "../types";

export interface RoleFlags {
  isAdmin: boolean;
  isStaff: boolean;
  isModerator: boolean;
  isParent: boolean;
  isChild: boolean;
}

// Ordered most- to least-specific as a schedule identity. child/parent come
// first because they are the only roles that can select classes, so a user who
// holds one should land there. moderator is last: it is a capability-only role
// (permissions derive from the full role list, never from the active role) and
// carries no identity of its own, so it is only picked when it stands alone.
const ROLE_PRIORITY: UserRole[] = [
  "child",
  "parent",
  "staff",
  "admin",
  "moderator",
];

// Deterministic active-role default for a user's role rows. The roles query has
// no ORDER BY, so picking whichever row came back first would vary per load.
export function pickDefaultRole(roles: UserRoleData[]): UserRoleData | null {
  const approvedRoles = roles.filter(role => role.approved);

  for (const role of ROLE_PRIORITY) {
    const match = approvedRoles.find(r => r.role === role);
    if (match) return match;
  }

  return null;
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
