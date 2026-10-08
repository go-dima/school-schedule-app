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

  it("offers none on mobile (read-only committed view)", () => {
    expect(Object.values(scheduleCapabilities("mobile"))).not.toContain(true);
  });
});
