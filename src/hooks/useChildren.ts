import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { childrenApi } from "../services/api";
import type { Child, ChildShareToken } from "../types";

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
        const childrenData = await childrenApi.getParentChildren(user.id);
        if (mounted) {
          setChildren(childrenData);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load children"
          );
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
    groupNumber: number = 1
  ): Promise<Child> => {
    try {
      const newChild = await childrenApi.createChild(
        firstName,
        lastName,
        grade,
        groupNumber
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
      groupNumber?: number;
    }
  ): Promise<Child> => {
    try {
      const updatedChild = await childrenApi.updateChild(childId, updates);
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

  const generateShareToken = async (
    childId: string,
    expiresInHours: number = 48
  ): Promise<string> => {
    try {
      const token = await childrenApi.generateShareToken(
        childId,
        expiresInHours
      );
      return token;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate share token";
      setError(message);
      throw new Error(message);
    }
  };

  const acceptSharedChild = async (token: string): Promise<void> => {
    try {
      await childrenApi.acceptSharedChild(token);
      // Refresh children list
      if (user?.id) {
        const childrenData = await childrenApi.getParentChildren(user.id);
        setChildren(childrenData);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to accept shared child";
      setError(message);
      throw new Error(message);
    }
  };

  const getChildShareTokens = async (
    childId: string
  ): Promise<ChildShareToken[]> => {
    try {
      return await childrenApi.getChildShareTokens(childId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to get share tokens";
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
    generateShareToken,
    acceptSharedChild,
    getChildShareTokens,
  };
}
