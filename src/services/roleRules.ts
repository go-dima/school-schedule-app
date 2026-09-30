import type { UserRole } from "../types";
import {
  BASE_ROLES,
  ELEVATED_ROLES,
  EXCLUSIVE_ROLES,
} from "../constants/roles";

export type RoleSetError =
  | "noRoles"
  | "exclusiveCombined"
  | "elevatedWithoutBase";

// Which approved-role combinations a user may hold. Returns the first rule
// the set breaks, or null when it's valid. Callers map the code to a message.
export function validateRoleSet(roles: UserRole[]): RoleSetError | null {
  if (roles.length === 0) return "noRoles";
  if (roles.length > 1 && roles.some(role => EXCLUSIVE_ROLES.includes(role))) {
    return "exclusiveCombined";
  }
  const hasElevated = roles.some(role => ELEVATED_ROLES.includes(role));
  const hasBase = roles.some(role => BASE_ROLES.includes(role));
  if (hasElevated && !hasBase) return "elevatedWithoutBase";
  return null;
}
