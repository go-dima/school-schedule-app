import type { UserRole } from "../types";
import type { ToggleFilterGroupColor } from "../components/ToggleFilterGroup";

export const ROLE_TAG_COLORS: Record<UserRole, ToggleFilterGroupColor> = {
  admin: "red",
  staff: "orange",
  parent: "blue",
  child: "green",
  moderator: "purple",
};

// antd's preset base hex for each ToggleFilterGroupColor, for spots that need
// a solid color (e.g. a border) rather than a <Tag>/CSS class.
const PRESET_COLOR_HEX: Record<ToggleFilterGroupColor, string> = {
  red: "#f5222d",
  orange: "#fa8c16",
  blue: "#1677ff",
  green: "#52c41a",
  purple: "#722ed1",
};

export const ROLE_SOLID_COLORS: Record<UserRole, string> = Object.fromEntries(
  (Object.entries(ROLE_TAG_COLORS) as [UserRole, ToggleFilterGroupColor][]).map(
    ([role, color]) => [role, PRESET_COLOR_HEX[color]]
  )
) as Record<UserRole, string>;
