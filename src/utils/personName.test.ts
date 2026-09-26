import { describe, expect, it } from "vitest";
import { formatPersonName } from "./personName";

describe("formatPersonName", () => {
  it("prefers the display name", () => {
    expect(
      formatPersonName({
        displayName: "טלוש שור",
        firstName: "Tal",
        lastName: "Shor",
      })
    ).toBe("טלוש שור");
  });

  it("falls back to first + last name", () => {
    expect(
      formatPersonName({
        displayName: null,
        firstName: "Tal",
        lastName: "Shor",
      })
    ).toBe("Tal Shor");
    expect(formatPersonName({ displayName: "  ", firstName: "Tal" })).toBe(
      "Tal"
    );
  });

  it("returns null when there is no name at all", () => {
    expect(formatPersonName({})).toBeNull();
    expect(
      formatPersonName({ displayName: null, firstName: "", lastName: null })
    ).toBeNull();
  });
});
