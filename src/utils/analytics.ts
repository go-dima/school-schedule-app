import { track } from "@vercel/analytics";
import type { UserRole } from "../types";

// Single source of truth for event names -- every call site imports from
// here rather than calling @vercel/analytics's track() directly, so the
// full set of tracked events stays visible in one place.
export const AnalyticsEvent = {
  ScheduleDrawerOpened: "schedule_drawer_opened",
  ClassSelected: "class_selected",
  ClassUnselected: "class_unselected",
  SchedulePrinted: "schedule_printed",
  StaffOverrideApplied: "staff_override_applied",
  RoleSwitched: "role_switched",
  ClassEnrollmentDrawerOpened: "class_enrollment_drawer_opened",
  ClassSaved: "class_saved",
  ClassDeleted: "class_deleted",
  StudentSaved: "student_saved",
  UserRoleChanged: "user_role_changed",
  ModeratorGranted: "moderator_granted",
  ModeratorRevoked: "moderator_revoked",
  AdminGranted: "admin_granted",
  AdminRevoked: "admin_revoked",
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

export function trackWithActor(
  event: AnalyticsEventName,
  role: UserRole | undefined,
  properties?: Record<string, string | number | boolean>
) {
  trackEvent(event, { ...properties, ...(role ? { actor: role } : {}) });
}
