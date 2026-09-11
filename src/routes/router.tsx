// src/routes/router.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import SignupVerifyEmailPage from "../pages/SignupVerifyEmailPage";
import ProfileSetupPage from "../pages/ProfileSetupPage";
import PendingApprovalPage from "../pages/PendingApprovalPage";
import SchedulePage from "../pages/SchedulePage";
import ClassManagementPage from "../pages/ClassManagementPage";
import StudentsPage from "../pages/StudentsPage";
import UserListPage from "../pages/UserListPage";
import PendingApprovalsPage from "../pages/PendingApprovalsPage";
import ProfileSettingsPage from "../pages/ProfileSettingsPage";
import {
  AuthGate,
  PublicOnlyGate,
  ProfileSetupGate,
  PendingApprovalGate,
  SignupVerifyEmailGate,
  RequireAdmin,
  RequireClassManager,
  NotFoundGate,
} from "./guards";
import { ROUTES } from "./paths";

export const router = createBrowserRouter([
  {
    element: <PublicOnlyGate />,
    children: [
      { path: ROUTES.LOGIN, element: <LoginPage /> },
      { path: ROUTES.SIGNUP, element: <SignupPage /> },
    ],
  },
  {
    element: <SignupVerifyEmailGate />,
    children: [
      {
        path: ROUTES.SIGNUP_VERIFY_EMAIL,
        element: <SignupVerifyEmailPage />,
      },
    ],
  },
  {
    element: <ProfileSetupGate />,
    children: [{ path: ROUTES.PROFILE_SETUP, element: <ProfileSetupPage /> }],
  },
  {
    element: <PendingApprovalGate />,
    children: [
      { path: ROUTES.PENDING_APPROVAL, element: <PendingApprovalPage /> },
    ],
  },
  {
    element: <AuthGate />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to={ROUTES.SCHEDULE} replace /> },
          { path: ROUTES.SCHEDULE, element: <SchedulePage /> },
          {
            element: <RequireClassManager />,
            children: [
              {
                path: ROUTES.CLASS_MANAGEMENT,
                element: <ClassManagementPage />,
              },
              { path: ROUTES.STUDENTS, element: <StudentsPage /> },
            ],
          },
          {
            path: ROUTES.USER_MANAGEMENT,
            element: <RequireAdmin />,
            children: [
              {
                index: true,
                element: <Navigate to={ROUTES.USER_MANAGEMENT_LIST} replace />,
              },
              { path: "list", element: <UserListPage /> },
              {
                path: "pending-approvals",
                element: <PendingApprovalsPage />,
              },
            ],
          },
          {
            path: ROUTES.PROFILE_SETTINGS,
            element: <ProfileSettingsPage />,
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundGate /> },
]);
