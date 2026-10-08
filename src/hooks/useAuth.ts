import { useEffect, useMemo, useRef, useState } from "react";
import { authApi, usersApi } from "../services/api";
import { getPermissions } from "../services/permissions";
import { getRoleFlags, pickDefaultRole } from "../services/roleFlags";
import type { User, UserRole, UserRoleData } from "../types";
import type { RequestableRole } from "../constants/roles";
import { withTimeout } from "../utils/asyncUtils";
import { trackEvent, AnalyticsEvent } from "../utils/analytics";
import i18n from "../utils/i18n";

// Keep below App.tsx's 5s loading-timeout screen so a stuck query resolves to
// the existing "proceed as signed out" fallback instead of that blunter screen.
const AUTH_QUERY_TIMEOUT_MS = 4000;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleData[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRoleData | null>(null);
  // Stays true until supabase-js delivers its first auth event (see below).
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref to track the active auth listener so it can be aborted
  const activeOperationRef = useRef<{
    authStateChange: AbortController | null;
  }>({
    authStateChange: null,
  });

  useEffect(() => {
    let mounted = true;

    // Cancel any existing auth state change operations
    if (activeOperationRef.current.authStateChange) {
      activeOperationRef.current.authStateChange.abort();
    }

    const loadUserRoles = async (
      userId: string,
      controller: AbortController
    ) => {
      try {
        const roles = await withTimeout(
          usersApi.getUserRoles(userId),
          AUTH_QUERY_TIMEOUT_MS
        );

        if (controller.signal.aborted || !mounted) return;

        const approvedRoles = roles.filter(role => role.approved);
        setUserRoles(approvedRoles);
        setCurrentRole(pickDefaultRole(approvedRoles));
      } catch (err) {
        if (controller.signal.aborted || !mounted) return;

        // For role loading errors, just proceed with empty roles instead of blocking
        setUserRoles([]);
        setCurrentRole(null);
      }
    };

    const authStateController = new AbortController();
    activeOperationRef.current.authStateChange = authStateController;

    // `loading` starts true and is first cleared here, once the first auth
    // event has been handled. supabase-js emits its first event
    // (INITIAL_SESSION) only after its async initialization -- which is when
    // it reads an OAuth / email-link callback's `#access_token=...` from the
    // URL. App renders the router only once `loading` is false, so no route
    // guard can redirect (e.g. `/` -> `/login`) and wipe that hash before
    // supabase-js has consumed it. Clearing `loading` any earlier loses the
    // session on slow devices.
    const {
      data: { subscription },
    } = authApi.onAuthStateChange(async supabaseUser => {
      if (authStateController.signal.aborted || !mounted) return;

      setError(null);
      setLoading(true);

      try {
        if (supabaseUser) {
          const userProfile = await withTimeout(
            usersApi.getUserProfile(supabaseUser.id),
            AUTH_QUERY_TIMEOUT_MS
          );

          if (authStateController.signal.aborted || !mounted) return;

          setUser(userProfile);
          await loadUserRoles(supabaseUser.id, authStateController);
        } else {
          setUser(null);
          setUserRoles([]);
          setCurrentRole(null);
        }
      } catch (err) {
        if (authStateController.signal.aborted || !mounted) return;

        // For auth state change errors, just proceed as signed out
        setUser(null);
        setUserRoles([]);
        setCurrentRole(null);
        setError(null);
      } finally {
        if (!authStateController.signal.aborted && mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      authStateController.abort();
      subscription?.unsubscribe();
      activeOperationRef.current.authStateChange = null;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      await authApi.signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t("auth.login.error"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (requestedRole?: RequestableRole) => {
    setError(null);
    setLoading(true);

    try {
      await authApi.signInWithGoogle(requestedRole);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : i18n.t("auth.login.googleError")
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    requestedRole?: RequestableRole
  ) => {
    setError(null);
    setLoading(true);

    try {
      await authApi.signUp(email, password, requestedRole);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : i18n.t("auth.signup.error")
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setError(null);

    try {
      await authApi.signOut();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : i18n.t("errors.fallback.signOut")
      );
      throw err;
    } finally {
      // Don't rely solely on the onAuthStateChange listener to reach a
      // signed-out UI state -- clear local state directly as a safety net.
      setUser(null);
      setUserRoles([]);
      setCurrentRole(null);
    }
  };

  const switchRole = (role: UserRoleData) => {
    if (userRoles.some(r => r.id === role.id)) {
      setCurrentRole(role);
      trackEvent(AnalyticsEvent.RoleSwitched, { role: role.role });
    }
  };

  const hasRole = (role: UserRole): boolean => {
    return userRoles.some(r => r.role === role);
  };

  const permissions = useMemo(() => getPermissions(userRoles), [userRoles]);
  const roleFlags = useMemo(() => getRoleFlags(userRoles), [userRoles]);

  const refreshProfile = async () => {
    if (!user?.id) return;

    try {
      // Use the existing user id instead of calling getCurrentUser which hangs
      const userProfile = await usersApi.getUserProfile(user.id);
      setUser(userProfile);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : i18n.t("errors.fallback.refreshProfile")
      );
    }
  };

  return {
    user,
    userRoles,
    currentRole,
    loading,
    error,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    refreshProfile,
    switchRole,
    hasRole,
    permissions,
    roleFlags,
  };
}
