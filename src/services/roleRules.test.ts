import { describe, expect, it } from "vitest";
import type { UserRole } from "../types";
import { validateRoleSet, type RoleSetError } from "./roleRules";

describe("validateRoleSet", () => {
  const cases: { roles: UserRole[]; expected: RoleSetError | null }[] = [
    { roles: [], expected: "noRoles" },
    { roles: ["parent"], expected: null },
    { roles: ["staff"], expected: null },
    { roles: ["child"], expected: null },
    { roles: ["staff", "parent"], expected: null },
    { roles: ["admin", "staff"], expected: null },
    { roles: ["moderator", "parent"], expected: null },
    { roles: ["admin"], expected: "elevatedWithoutBase" },
    { roles: ["moderator"], expected: "elevatedWithoutBase" },
    { roles: ["admin", "moderator"], expected: "elevatedWithoutBase" },
    { roles: ["child", "parent"], expected: "exclusiveCombined" },
    { roles: ["child", "staff"], expected: "exclusiveCombined" },
    // child counts as a base role, but exclusivity wins.
    { roles: ["child", "admin"], expected: "exclusiveCombined" },
    { roles: ["child", "moderator"], expected: "exclusiveCombined" },
  ];

  it.each(cases)("$roles -> $expected", ({ roles, expected }) => {
    expect(validateRoleSet(roles)).toBe(expected);
  });
});
