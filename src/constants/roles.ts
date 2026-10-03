import type { UserRole } from "../types";

// Every role, in the order role UI lists them (User Management filter and
// role picker).
export const ALL_ROLES: UserRole[] = [
  "admin",
  "moderator",
  "staff",
  "parent",
  "child",
];

// Roles a new user may ask for on the signup page. The admin still picks the
// actual role at approval; this is only the request. Mirrored by the
// user_roles self-request policy (migration 045).
export const REQUESTABLE_ROLES = ["staff", "parent", "child"] as const;

export type RequestableRole = (typeof REQUESTABLE_ROLES)[number];

// Roles that carry an identity of their own. admin/moderator are elevated:
// capability-only, so they need a base role alongside them.
export const BASE_ROLES: UserRole[] = ["staff", "parent", "child"];
export const ELEVATED_ROLES: UserRole[] = ["admin", "moderator"];

// Roles that can't be combined with any other role.
export const EXCLUSIVE_ROLES: UserRole[] = ["child"];
