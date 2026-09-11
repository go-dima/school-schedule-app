// src/routes/paths.ts
export const ROUTES = {
  ROOT: "/",
  SCHEDULE: "/schedule",
  CLASS_MANAGEMENT: "/class-management",
  STUDENTS: "/students",
  USER_MANAGEMENT: "/user-management",
  USER_MANAGEMENT_LIST: "/user-management/list",
  USER_MANAGEMENT_PENDING_APPROVALS: "/user-management/pending-approvals",
  PROFILE_SETTINGS: "/profile-settings",
  LOGIN: "/login",
  SIGNUP: "/signup",
  SIGNUP_VERIFY_EMAIL: "/signup/verify-email",
  PROFILE_SETUP: "/profile-setup",
  PENDING_APPROVAL: "/pending-approval",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
