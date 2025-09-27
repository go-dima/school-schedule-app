import { useEffect, useRef, useState } from "react";
import { authApi, usersApi } from "../services/api";
import type { User, UserRoleData } from "../types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleData[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Ref to track active operations and prevent race conditions
  const activeOperationRef = useRef<{
    initAuth: AbortController | null;
    authStateChange: AbortController | null;
  }>({
    initAuth: null,
    authStateChange: null,
  });

  useEffect(() => {
    let mounted = true;

    // Prevent re-initialization if already initialized
    if (initialized) {
      return () => {
        mounted = false;
      };
    }

    // Prevent multiple simultaneous auth initializations
    if (activeOperationRef.current.initAuth) {
      return () => {
        mounted = false;
      };
    }

    // Cancel any existing auth state change operations
    if (activeOperationRef.current.authStateChange) {
      activeOperationRef.current.authStateChange.abort();
    }

    const initController = new AbortController();
    activeOperationRef.current.initAuth = initController;

    const loadUserRoles = async (
      userId: string,
      controller: AbortController
    ) => {
      try {
        const roles = await usersApi.getUserRoles(userId);

        if (controller.signal.aborted || !mounted) return;

        const approvedRoles = roles.filter(role => role.approved);
        setUserRoles(approvedRoles);
        setCurrentRole(approvedRoles[0] || null);
      } catch (err) {
        if (controller.signal.aborted || !mounted) return;

        // For role loading errors, just proceed with empty roles instead of blocking
        setUserRoles([]);
        setCurrentRole(null);
      }
    };

    const initAuth = async () => {
      try {
        // Instead of calling getCurrentUser which hangs,
        // let the auth state change listener handle the initial auth state
        console.log(
          "🔐 useAuth: Skipping getCurrentUser, relying on auth state listener"
        );

        if (initController.signal.aborted || !mounted) return;

        // Initialize as no user - the auth state change listener will update if there's a session
        setUser(null);
        setUserRoles([]);
        setCurrentRole(null);
        setError(null);
      } catch (err) {
        if (initController.signal.aborted || !mounted) return;

        // Treat as no user and allow app to proceed
        setUser(null);
        setUserRoles([]);
        setCurrentRole(null);
        setError(null);
      } finally {
        if (!initController.signal.aborted && mounted) {
          setLoading(false);
          setInitialized(true);
          activeOperationRef.current.initAuth = null;
        }
      }
    };

    initAuth();

    const authStateController = new AbortController();
    activeOperationRef.current.authStateChange = authStateController;

    const {
      data: { subscription },
    } = authApi.onAuthStateChange(async supabaseUser => {
      if (authStateController.signal.aborted || !mounted) return;

      // Don't process auth state changes if initial auth is still loading
      if (activeOperationRef.current.initAuth) return;

      setError(null);
      setLoading(true);

      try {
        if (supabaseUser) {
          const userProfile = await usersApi.getUserProfile(supabaseUser.id);

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
      initController.abort();
      authStateController.abort();
      subscription?.unsubscribe();
      activeOperationRef.current.initAuth = null;
      activeOperationRef.current.authStateChange = null;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      await authApi.signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);

    try {
      await authApi.signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign in failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      await authApi.signUp(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
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
      setError(err instanceof Error ? err.message : "Sign out failed");
      throw err;
    }
  };

  const switchRole = (role: UserRoleData) => {
    if (userRoles.some(r => r.id === role.id)) {
      setCurrentRole(role);
    }
  };

  const hasRole = (role: string): boolean => {
    return userRoles.some(r => r.role === role);
  };

  const isAdmin = (): boolean => {
    return hasRole("admin");
  };

  const canManageClasses = (): boolean => {
    return hasRole("admin") || hasRole("staff");
  };

  const canViewAllSchedules = (): boolean => {
    return hasRole("admin") || hasRole("staff");
  };

  const refreshProfile = async () => {
    if (!user?.id) return;

    try {
      // Use the existing user id instead of calling getCurrentUser which hangs
      const userProfile = await usersApi.getUserProfile(user.id);
      setUser(userProfile);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh profile"
      );
    }
  };

  const clearApplicationState = () => {
    // Abort any ongoing operations
    if (activeOperationRef.current.initAuth) {
      activeOperationRef.current.initAuth.abort();
      activeOperationRef.current.initAuth = null;
    }
    if (activeOperationRef.current.authStateChange) {
      activeOperationRef.current.authStateChange.abort();
      activeOperationRef.current.authStateChange = null;
    }

    // Clear all state
    setUser(null);
    setUserRoles([]);
    setCurrentRole(null);
    setLoading(false);
    setError(null);
    setInitialized(false);

    // Clear browser storage
    try {
      localStorage.clear();
      sessionStorage.clear();

      // Clear Supabase session if available
      authApi.signOut().catch(() => {
        // Ignore errors during emergency cleanup
      });
    } catch (err) {
      console.warn("🧹 useAuth: Error during storage cleanup:", err);
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
    isAdmin,
    canManageClasses,
    canViewAllSchedules,
    clearApplicationState,
  };
}
