import { describe, expect, it } from "vitest";
import { parseUiModeOverride, resolveUiMode } from "./uiMode";

describe("resolveUiMode", () => {
  it("uses the detected device when there is no override", () => {
    expect(resolveUiMode({ detected: "mobile", override: null })).toBe(
      "mobile"
    );
    expect(resolveUiMode({ detected: "desktop", override: null })).toBe(
      "desktop"
    );
  });

  it("lets the override win over the detected device", () => {
    expect(resolveUiMode({ detected: "mobile", override: "desktop" })).toBe(
      "desktop"
    );
    expect(resolveUiMode({ detected: "desktop", override: "mobile" })).toBe(
      "mobile"
    );
  });
});

describe("parseUiModeOverride", () => {
  it("accepts only known modes", () => {
    expect(parseUiModeOverride("mobile")).toBe("mobile");
    expect(parseUiModeOverride("desktop")).toBe("desktop");
    expect(parseUiModeOverride("tablet")).toBeNull();
    expect(parseUiModeOverride(null)).toBeNull();
  });
});
