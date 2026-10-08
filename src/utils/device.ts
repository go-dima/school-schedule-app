export type DeviceType = "mobile" | "desktop";

// The subset of `navigator` the detection reads, so tests can pass a plain
// object instead of stubbing the global.
export interface NavigatorLike {
  userAgent: string;
  userAgentData?: { mobile?: boolean };
}

// Phones only: Android tablets omit the "Mobile" token, and iPadOS reports a
// Mac user agent, so both resolve to desktop.
const MOBILE_UA = /iPhone|iPod|Android.*Mobile|Windows Phone/i;

export function detectDeviceType(nav: NavigatorLike): DeviceType {
  const hint = nav.userAgentData?.mobile;
  if (typeof hint === "boolean") return hint ? "mobile" : "desktop";
  return MOBILE_UA.test(nav.userAgent) ? "mobile" : "desktop";
}
