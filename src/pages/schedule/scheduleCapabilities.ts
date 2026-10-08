import type { UiMode } from "../../services/uiMode";

/** Which controls the Schedule page offers on a platform. One object per
 * platform, the same for every role; role permissions still apply on top
 * (a control shows only if the role allows it too). */
export interface ScheduleCapabilities {
  /** The draft/committed toggle. */
  canChooseDraft: boolean;
  /** The student / my schedule / staff view tabs. */
  canPickView: boolean;
  canRefresh: boolean;
  canPrint: boolean;
  canAddChild: boolean;
  /** The "committed view is read only" notice. */
  showReadOnlyNotice: boolean;
}

const DESKTOP: ScheduleCapabilities = {
  canChooseDraft: true,
  canPickView: true,
  canRefresh: true,
  canPrint: true,
  canAddChild: true,
  showReadOnlyNotice: true,
};

// Mobile is a read-only view for now. Staff and admins get the desktop page
// in the mobile shell, so the view tabs stay: they open on My Schedule and the
// student picker is one tap away. Only class managers see the tabs.
const MOBILE: ScheduleCapabilities = {
  canChooseDraft: false,
  canPickView: true,
  canRefresh: false,
  canPrint: false,
  canAddChild: false,
  showReadOnlyNotice: false,
};

export function scheduleCapabilities(platform: UiMode): ScheduleCapabilities {
  return platform === "mobile" ? MOBILE : DESKTOP;
}
