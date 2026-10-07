import type { UiMode } from "../../services/uiMode";

/** Which controls the Schedule page offers on a platform. Role permissions
 * still apply on top: a control shows only if the role allows it too. */
export interface ScheduleCapabilities {
  /** The draft/committed toggle. */
  canChooseDraft: boolean;
  /** The student / my schedule / staff view tabs. */
  canPickView: boolean;
  canRefresh: boolean;
  canAddChild: boolean;
  /** The "committed view is read only" notice. */
  showReadOnlyNotice: boolean;
}

const DESKTOP: ScheduleCapabilities = {
  canChooseDraft: true,
  canPickView: true,
  canRefresh: true,
  canAddChild: true,
  showReadOnlyNotice: true,
};

// Mobile is a read-only view of the committed schedule for now, so it
// needs none of these.
const MOBILE: ScheduleCapabilities = {
  canChooseDraft: false,
  canPickView: false,
  canRefresh: false,
  canAddChild: false,
  showReadOnlyNotice: false,
};

export function scheduleCapabilities(platform: UiMode): ScheduleCapabilities {
  return platform === "mobile" ? MOBILE : DESKTOP;
}
