import { describe, expect, it } from "vitest";
import { scheduleCapabilities } from "./scheduleCapabilities";

describe("scheduleCapabilities", () => {
  it("offers every control on desktop", () => {
    expect(scheduleCapabilities("desktop")).toEqual({
      canChooseDraft: true,
      canPickView: true,
      canRefresh: true,
      canPrint: true,
      canAddChild: true,
      showReadOnlyNotice: true,
    });
  });

  it("offers only the view tabs on mobile (read-only committed view)", () => {
    expect(scheduleCapabilities("mobile")).toEqual({
      canChooseDraft: false,
      canPickView: true,
      canRefresh: false,
      canPrint: false,
      canAddChild: false,
      showReadOnlyNotice: false,
    });
  });
});
