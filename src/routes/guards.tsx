// src/routes/guards.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { resolveGate } from "./resolveGate";
import { ROUTES } from "./paths";

function useHasProfile(): boolean {
  const { user } = useAuth();
  return Boolean(user?.firstName && user?.lastName);
}

function useGate() {
  const { user, userRoles } = useAuth();
  const hasProfile = useHasProfile();
  return resolveGate({ user, hasProfile, roles: userRoles });
}

/** Guards the authenticated app layout: redirects to whatever resolveGate says. */
export function AuthGate() {
  const gate = useGate();
  if (gate) return <Navigate to={gate} replace />;
  return <Outlet />;
}

/** Guards /login and /signup: only reachable while unauthenticated. */
export function PublicOnlyGate() {
  const gate = useGate();
  if (gate === null) return <Navigate to={ROUTES.SCHEDULE} replace />;
  if (gate === ROUTES.LOGIN) return <Outlet />;
  return <Navigate to={gate} replace />;
}

/** Guards /profile-setup: only reachable while that's the correct onboarding step. */
export function ProfileSetupGate() {
  const gate = useGate();
  if (gate !== ROUTES.PROFILE_SETUP) {
    return <Navigate to={gate ?? ROUTES.SCHEDULE} replace />;
  }
  return <Outlet />;
}

/** Guards /pending-approval: only reachable while that's the correct onboarding step. */
export function PendingApprovalGate() {
  const gate = useGate();
  if (gate !== ROUTES.PENDING_APPROVAL) {
    return <Navigate to={gate ?? ROUTES.SCHEDULE} replace />;
  }
  return <Outlet />;
}

interface SignupVerifyEmailLocationState {
  fromSignup?: boolean;
}

/**
 * Guards /signup/verify-email: only reachable immediately after a successful
 * signup submission (flagged via navigation state), since it isn't a
 * bookmarkable/deep-linkable page. Anyone else lands back on /signup.
 */
export function SignupVerifyEmailGate() {
  const gate = useGate();
  const location = useLocation();

  if (gate === null) return <Navigate to={ROUTES.SCHEDULE} replace />;
  if (gate !== ROUTES.LOGIN) return <Navigate to={gate} replace />;

  const state = location.state as SignupVerifyEmailLocationState | null;
  if (!state?.fromSignup) return <Navigate to={ROUTES.SIGNUP} replace />;

  return <Outlet />;
}

/** Guards class-management and students routes. */
export function RequireClassManager() {
  const { canManageClasses } = useAuth();
  if (!canManageClasses()) return <Navigate to={ROUTES.SCHEDULE} replace />;
  return <Outlet />;
}

/** Guards the /user-management/* branch. */
export function RequireAdmin() {
  const { isAdmin } = useAuth();
  if (!isAdmin()) return <Navigate to={ROUTES.SCHEDULE} replace />;
  return <Outlet />;
}

/** Catch-all for unmatched paths: /schedule if authenticated, else the right gate. */
export function NotFoundGate() {
  const gate = useGate();
  return <Navigate to={gate ?? ROUTES.SCHEDULE} replace />;
}
