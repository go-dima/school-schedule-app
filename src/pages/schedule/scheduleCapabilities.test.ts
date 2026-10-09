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
      studentPicker: "dropdown",
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
      studentPicker: "sheet",
    });
  });

  it("opens the student picker as a bottom sheet on mobile only", () => {
    expect(scheduleCapabilities("mobile").studentPicker).toBe("sheet");
    expect(scheduleCapabilities("desktop").studentPicker).toBe("dropdown");
  });
});
