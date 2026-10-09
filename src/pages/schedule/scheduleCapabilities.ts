import type { UiMode } from "../../services/uiMode";
import type { StudentPicker } from "../../components/StudentSearchSelector";

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
  /** How the staff student picker opens: an antd dropdown or a bottom
   * sheet. */
  studentPicker: StudentPicker;
}

const DESKTOP: ScheduleCapabilities = {
  canChooseDraft: true,
  canPickView: true,
  canRefresh: true,
  canPrint: true,
  canAddChild: true,
  showReadOnlyNotice: true,
  studentPicker: "dropdown",
};

// Mobile is a read-only view for now. Staff and admins get the desktop page
// in the mobile shell, so the view tabs stay: they open on My Schedule and the
// student picker is one tap away. Only class managers see the tabs. Their
// student picker opens as a bottom sheet.
const MOBILE: ScheduleCapabilities = {
  canChooseDraft: false,
  canPickView: true,
  canRefresh: false,
  canPrint: false,
  canAddChild: false,
  showReadOnlyNotice: false,
  studentPicker: "sheet",
};

export function scheduleCapabilities(platform: UiMode): ScheduleCapabilities {
  return platform === "mobile" ? MOBILE : DESKTOP;
}
