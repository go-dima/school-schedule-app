import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { childrenApi } from "../services/api";
import { withTimeout } from "../utils/asyncUtils";
import type { Child } from "../types";

export function useChildren() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) {
      setChildren([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadChildren = async () => {
      try {
        const childrenData = await withTimeout(
          childrenApi.getParentChildren(user.id),
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
              "Loading children is taking longer than expected. Please refresh the page."
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

    loadChildren();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const createChild = async (
    firstName: string,
    lastName: string,
    grade: number,
    groupNumber: number | null = 1,
    trackNumber: number | null = null
  ): Promise<Child> => {
    try {
      const newChild = await childrenApi.createChild(
        firstName,
        lastName,
        grade,
        groupNumber,
        undefined,
        trackNumber,
        "draft"
      );
      setChildren(prev => [...prev, newChild]);
      return newChild;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create child";
      setError(message);
      throw new Error(message);
    }
  };

  const updateChild = async (
    childId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      grade?: number;
      groupNumber?: number | null;
      trackNumber?: number | null;
    }
  ): Promise<Child> => {
    try {
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
        await childrenApi.updateChildTrack(childId, "draft", trackNumber);
        updatedChild = { ...updatedChild, trackNumber };
      }

      setChildren(prev =>
        prev.map(child => (child.id === childId ? updatedChild : child))
      );
      return updatedChild;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update child";
      setError(message);
      throw new Error(message);
    }
  };

  const removeChild = async (childId: string): Promise<void> => {
    if (!user?.id) throw new Error("User not authenticated");

    try {
      await childrenApi.removeChildFromParent(user.id, childId);
      setChildren(prev => prev.filter(child => child.id !== childId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to remove child";
      setError(message);
      throw new Error(message);
    }
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
