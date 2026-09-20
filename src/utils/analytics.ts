import { track } from "@vercel/analytics";

// Single source of truth for event names -- every call site imports from
// here rather than calling @vercel/analytics's track() directly, so the
// full set of tracked events stays visible in one place.
export const AnalyticsEvent = {
  ScheduleDrawerOpened: "schedule_drawer_opened",
  ClassSelected: "class_selected",
  SelectionConflictShown: "selection_conflict_shown",
  SchedulePrinted: "schedule_printed",
  StaffOverrideApplied: "staff_override_applied",
  RoleSwitched: "role_switched",
  ClassEnrollmentDrawerOpened: "class_enrollment_drawer_opened",
  ClassSaved: "class_saved",
  ClassDeleted: "class_deleted",
  StudentSaved: "student_saved",
  UserRoleChanged: "user_role_changed",
  SignupApproved: "signup_approved",
  SignupRejected: "signup_rejected",
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

export function trackEvent(
  event: AnalyticsEventName,
  properties?: Record<string, string | number | boolean>
) {
  track(event, properties);
}
