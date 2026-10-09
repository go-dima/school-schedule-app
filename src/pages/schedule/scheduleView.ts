import type { UiMode } from "../../services/uiMode";

/** Which view tab of the Schedule page is showing: a student's week, the
 * signed-in staff member's own week (My Schedule), or any staff member's.
 * Not the draft/committed choice (`ScheduleService.resolveScheduleView`). */
export type ScheduleTab = "student" | "mine" | "staff";

export interface ScheduleTabInput {
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

export type DefaultScheduleTabInput = Pick<
  ScheduleTabInput,
  "platform" | "canUseMyView" | "canPickSchedule"
>;

/** The tab shown when the URL names none. Staff on mobile land on My
 * Schedule; everyone else, and desktop, on the student view. */
export function defaultScheduleTab(
  input: DefaultScheduleTabInput
): ScheduleTab {
  const { platform, canUseMyView, canPickSchedule } = input;
  return platform === "mobile" && canUseMyView && !canPickSchedule
    ? "mine"
    : "student";
}

/** The tab to render: the URL param when the role may use it, otherwise the
 * platform default. `?view=student` is explicit, so a staff member on mobile
 * can leave My Schedule for the student picker. */
export function resolveScheduleTab(input: ScheduleTabInput): ScheduleTab {
  const { viewParam, canUseStaffView, canUseMyView } = input;
  if (viewParam === "student") return "student";
  if (canUseStaffView && viewParam === "staff") return "staff";
  if (canUseMyView && viewParam === "mine") return "mine";
  return defaultScheduleTab(input);
}

/** The `?view=` value to write when the user picks `tab`, or null to drop the
 * param. The default tab needs no param; any other tab is named, so on mobile
 * (where staff default to My Schedule) the student view is `?view=student`. */
export function viewParamFor(
  tab: ScheduleTab,
  input: DefaultScheduleTabInput
): ScheduleTab | null {
  return tab === defaultScheduleTab(input) ? null : tab;
}
