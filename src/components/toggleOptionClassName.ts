import type { RoleTagColor } from "../constants/roleColors";

/** Class names for one option button, shared with ToggleRadioGroup so both
 * controls render the same active colors from ToggleFilterGroup.css. */
export function toggleOptionClassName(
  active: boolean,
  color?: RoleTagColor
): string {
  if (!active) return "toggle-filter-group__option";
  const activeClass = color
    ? `toggle-filter-group__option--active-${color}`
    : "toggle-filter-group__option--active";
  return `toggle-filter-group__option ${activeClass}`;
}
