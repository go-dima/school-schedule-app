import type { UserRole } from "../types";

export const ROLE_TAG_COLORS: Record<UserRole, string> = {
  admin: "red",
  staff: "orange",
  parent: "blue",
  child: "green",
  moderator: "purple",
};
