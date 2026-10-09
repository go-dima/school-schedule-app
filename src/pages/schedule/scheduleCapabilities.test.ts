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

  it("offers none on mobile (read-only committed view)", () => {
    expect(Object.values(scheduleCapabilities("mobile"))).not.toContain(true);
  });

  it("opens the student picker as a bottom sheet on mobile only", () => {
    expect(scheduleCapabilities("mobile").studentPicker).toBe("sheet");
    expect(scheduleCapabilities("desktop").studentPicker).toBe("dropdown");
  });
});
