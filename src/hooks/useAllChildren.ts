import { useEffect, useState } from "react";
import { childrenApi } from "../services/api";
import type { Child } from "../types";

export function useAllChildren() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadAllChildren = async () => {
      try {
        const childrenData = await childrenApi.getAllChildren();
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

    loadAllChildren();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    children,
    loading,
    error,
  };
}
