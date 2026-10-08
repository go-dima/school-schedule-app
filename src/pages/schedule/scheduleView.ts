import type { UiMode } from "../../services/uiMode";

/** Which view of the Schedule page is showing: a student's week, the
 * signed-in staff member's own week (My Schedule), or any staff member's. */
export type ScheduleViewMode = "student" | "mine" | "staff";

export interface ScheduleViewInput {
  platform: UiMode;
  /** The `?view=` URL param, if any. */
  viewParam: string | null;
  /** Class managers (admin/staff/moderator) may enter the staff views. */
  canUseStaffView: boolean;
  /** Class managers with a display name may open My Schedule. */
  canUseMyView: boolean;
  /** Parent or child roles. Staff+parent users keep the parent view
   * (ADR 0004). */
  canPickSchedule: boolean;
}

/** The view shown when the URL names none. Staff on mobile land on My
 * Schedule; everyone else, and desktop, on the student view. */
export function defaultScheduleView(
  input: Pick<
    ScheduleViewInput,
    "platform" | "canUseMyView" | "canPickSchedule"
  >
): ScheduleViewMode {
  const { platform, canUseMyView, canPickSchedule } = input;
  return platform === "mobile" && canUseMyView && !canPickSchedule
    ? "mine"
    : "student";
}

/** The view to render: the URL param when the role may use it, otherwise the
 * platform default. `?view=student` is explicit, so a staff member on mobile
 * can leave My Schedule for the student picker. */
export function resolveScheduleView(
  input: ScheduleViewInput
): ScheduleViewMode {
  const { viewParam, canUseStaffView, canUseMyView } = input;
  if (viewParam === "student") return "student";
  if (canUseStaffView && viewParam === "staff") return "staff";
  if (canUseMyView && viewParam === "mine") return "mine";
  return defaultScheduleView(input);
}
