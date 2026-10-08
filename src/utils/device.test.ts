import { describe, expect, it } from "vitest";
import { detectDeviceType } from "./device";

const UA = {
  iPhone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  androidPhone:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  iPadOS:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  desktopChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

describe("detectDeviceType", () => {
  it("treats iPhone as mobile", () => {
    expect(detectDeviceType({ userAgent: UA.iPhone })).toBe("mobile");
  });

  it("treats an Android phone as mobile", () => {
    expect(detectDeviceType({ userAgent: UA.androidPhone })).toBe("mobile");
  });

  it("treats an Android tablet as desktop", () => {
    expect(detectDeviceType({ userAgent: UA.androidTablet })).toBe("desktop");
  });

  it("treats iPadOS (Mac user agent) as desktop", () => {
    expect(detectDeviceType({ userAgent: UA.iPadOS })).toBe("desktop");
  });

  it("treats desktop Chrome as desktop", () => {
    expect(detectDeviceType({ userAgent: UA.desktopChrome })).toBe("desktop");
  });

  it("prefers userAgentData.mobile over the user agent", () => {
    expect(
      detectDeviceType({
        userAgent: UA.desktopChrome,
        userAgentData: { mobile: true },
      })
    ).toBe("mobile");
    expect(
      detectDeviceType({
        userAgent: UA.androidPhone,
        userAgentData: { mobile: false },
      })
    ).toBe("desktop");
  });

  it("falls back to the user agent when userAgentData has no mobile hint", () => {
    expect(detectDeviceType({ userAgent: UA.iPhone, userAgentData: {} })).toBe(
      "mobile"
    );
  });
});
