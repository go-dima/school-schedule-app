import { describe, expect, it } from "vitest";
import { resolveRequestedRole } from "./requestedRole";

describe("resolveRequestedRole", () => {
  it("uses the metadata role first", () => {
    expect(resolveRequestedRole({ requested_role: "child" }, "staff")).toBe(
      "child"
    );
  });

  it("falls back to the stored role when metadata has none", () => {
    expect(resolveRequestedRole({ full_name: "Noa" }, "staff")).toBe("staff");
    expect(resolveRequestedRole(undefined, "child")).toBe("child");
  });

  it("falls back to parent when neither is set", () => {
    expect(resolveRequestedRole(undefined, null)).toBe("parent");
    expect(resolveRequestedRole({}, undefined)).toBe("parent");
  });

  it("ignores roles that can't be requested", () => {
    expect(resolveRequestedRole({ requested_role: "admin" }, "child")).toBe(
      "child"
    );
    expect(resolveRequestedRole({ requested_role: "moderator" }, null)).toBe(
      "parent"
    );
    expect(resolveRequestedRole(undefined, "admin")).toBe("parent");
    expect(resolveRequestedRole({ requested_role: 42 }, "nope")).toBe("parent");
  });
});
