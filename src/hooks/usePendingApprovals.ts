import { useState, useEffect } from "react";
import { usersApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export function usePendingApprovals() {
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { isAdmin } = useAuth();

  const fetchPendingApprovalsCount = async () => {
    if (!isAdmin()) {
      setPendingApprovalsCount(0);
      return;
    }

    setLoading(true);
    try {
      const data = await usersApi.getPendingApprovalsWithUsers();
      setPendingApprovalsCount(data.length);
    } catch (error) {
      console.error("Error fetching pending approvals count:", error);
      setPendingApprovalsCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingApprovalsCount();

    // Set up an interval to refresh the count every 30 seconds
    const interval = setInterval(fetchPendingApprovalsCount, 30000);

    return () => clearInterval(interval);
  }, [isAdmin()]);

  const refreshCount = () => {
    fetchPendingApprovalsCount();
  };

  return {
    pendingApprovalsCount,
    loading,
    refreshCount,
  };
}
