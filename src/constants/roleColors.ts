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

// antd's preset base hex for each RoleTagColor, for spots that need a solid
// color (e.g. a border) rather than a <Tag>/CSS class.
const PRESET_COLOR_HEX: Record<RoleTagColor, string> = {
  red: "#f5222d",
  orange: "#fa8c16",
  blue: "#1677ff",
  green: "#52c41a",
  purple: "#722ed1",
};

export const ROLE_SOLID_COLORS: Record<UserRole, string> = Object.fromEntries(
  (Object.entries(ROLE_TAG_COLORS) as [UserRole, RoleTagColor][]).map(
    ([role, color]) => [role, PRESET_COLOR_HEX[color]]
  )
) as Record<UserRole, string>;
