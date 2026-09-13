import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { childrenApi } from "../services/api";
import type { Child } from "../types";
import { withTimeout } from "../utils/asyncUtils";

type ChildWithParent = Child & { assignedParent: boolean };

export function useAllChildren() {
  const [children, setChildren] = useState<ChildWithParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, canViewAllSchedules } = useAuth();
  // get_children_with_parent_status is admin/staff-only at the DB level
  // (see migration 020) and has anon access revoked entirely -- calling it
  // for anyone else (including pre-login/anon, since this hook backs a
  // context mounted at the app root) fails with a Postgres permission
  // error instead of the RPC's own friendlier role check.
  const canListAllChildren = !!user?.id && canViewAllSchedules();

  useEffect(() => {
    if (!canListAllChildren) {
      setChildren([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadAllChildren = async () => {
      try {
        const childrenData = await withTimeout(
          childrenApi.getAllChildren(),
          10000
        );
        if (mounted) {
          setChildren(childrenData);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          if (err instanceof Error && err.message.includes("timed out")) {
            setError(
              "Loading students is taking longer than expected. Please refresh the page."
            );
          } else {
            setError(
              err instanceof Error ? err.message : "Failed to load children"
            );
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadAllChildren();

    return () => {
      mounted = false;
    };
  }, [canListAllChildren]);

  const updateChild = async (
    childId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      grade?: number;
      groupNumber?: number | null;
      trackNumber?: number | null;
      scope?: Child["scope"];
    }
  ): Promise<Child> => {
    const { trackNumber, ...profileUpdates } = updates;
    const hasProfileUpdates = Object.values(profileUpdates).some(
      value => value !== undefined
    );

    let updatedChild: Child;
    if (hasProfileUpdates) {
      updatedChild = await childrenApi.updateChild(childId, profileUpdates);
    } else {
      const existing = children.find(child => child.id === childId);
      if (!existing) throw new Error("Child not found");
      updatedChild = existing;
    }

    if (trackNumber !== undefined) {
      await childrenApi.updateChildTrack(childId, "committed", trackNumber);
      updatedChild = { ...updatedChild, trackNumber };
    }

    setChildren(prev =>
      prev.map(child =>
        child.id === childId ? { ...child, ...updatedChild } : child
      )
    );
    return updatedChild;
  };

  const createChild = async (
    firstName: string,
    lastName: string,
    grade: number,
    groupNumber: number | null = 1,
    scope: Child["scope"] = "prod",
    trackNumber: number | null = null
  ): Promise<Child> => {
    const newChild = await childrenApi.createChild(
      firstName,
      lastName,
      grade,
      groupNumber,
      scope,
      trackNumber,
      "committed"
    );
    setChildren(prev => [...prev, { ...newChild, assignedParent: false }]);
    return newChild;
  };

  const removeChild = async (childId: string): Promise<void> => {
    await childrenApi.deleteChild(childId);
    setChildren(prev => prev.filter(child => child.id !== childId));
  };

  return {
    children,
    loading,
    error,
    createChild,
    updateChild,
    removeChild,
  };
}
