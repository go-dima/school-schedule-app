import type { UserRole } from "../types";

// The antd preset Tag colors ToggleFilterGroup.css has active-state classes
// for -- the set any "colored" role UI (Tag, ToggleFilterGroup option) can
// actually render consistently.
export type RoleTagColor = "red" | "orange" | "blue" | "green" | "purple";

export const ROLE_TAG_COLORS: Record<UserRole, RoleTagColor> = {
  admin: "red",
  staff: "orange",
  parent: "blue",
  child: "green",
  moderator: "purple",
};
