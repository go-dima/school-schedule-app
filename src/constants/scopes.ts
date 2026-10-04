import type { Scope } from "../types";
import type { RoleTagColor } from "./roleColors";

// Every data scope, in display order. The single list scope pickers and
// filters are built from, so adding a scope is one change here.
export const ALL_SCOPES: readonly Scope[] = ["prod", "test"];

// One color per scope, shared by read-only scope Tags, pickers and filters.
// Limited to the antd presets ToggleFilterGroup.css styles (RoleTagColor).
export const SCOPE_TAG_COLORS: Record<Scope, RoleTagColor> = {
  prod: "green",
  test: "orange",
};
