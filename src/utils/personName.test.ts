import { describe, expect, it } from "vitest";
import { formatPersonName } from "./personName";

describe("formatPersonName", () => {
  it("prefers the display name", () => {
    expect(
      formatPersonName({
        displayName: "אורית שמש",
        firstName: "Orit",
        lastName: "Shemesh",
      })
    ).toBe("אורית שמש");
  });

  it("falls back to first + last name", () => {
    expect(
      formatPersonName({
        displayName: null,
        firstName: "Orit",
        lastName: "Shemesh",
      })
    ).toBe("Orit Shemesh");
    expect(formatPersonName({ displayName: "  ", firstName: "Orit" })).toBe(
      "Orit"
    );
  });

  it("returns null when there is no name at all", () => {
    expect(formatPersonName({})).toBeNull();
    expect(
      formatPersonName({ displayName: null, firstName: "", lastName: null })
    ).toBeNull();
  });
});
