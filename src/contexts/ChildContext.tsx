import React, { createContext, useContext, useState, useEffect } from "react";
import { useChildren } from "../hooks/useChildren";
import { useAuth } from "./AuthContext";
import type { Child } from "../types";

interface ChildContextType {
  selectedChild: Child | null;
  setSelectedChild: (child: Child | null) => void;
  children: Child[];
  loading: boolean;
  error: string | null;
}

const ChildContext = createContext<ChildContextType | undefined>(undefined);

export function ChildProvider({
  children: reactChildren,
}: {
  children: React.ReactNode;
}) {
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const { hasRole } = useAuth();
  const { children, loading, error } = useChildren();
  const isParent = hasRole("parent");

  // Auto-select first child if user is a parent and no child is selected
  useEffect(() => {
    if (isParent && children.length && !selectedChild && !loading) {
      setSelectedChild(children[0]);
    }
  }, [children, selectedChild, isParent, loading]);

  // Clear selected child if user is not a parent
  useEffect(() => {
    if (!isParent && selectedChild) {
      setSelectedChild(null);
    }
  }, [isParent, selectedChild]);

  // Clear selected child if it no longer exists in children array
  useEffect(() => {
    if (
      selectedChild &&
      !children.find(child => child.id === selectedChild.id)
    ) {
      setSelectedChild(null);
    }
  }, [children, selectedChild]);

  return (
    <ChildContext.Provider
      value={{
        selectedChild,
        setSelectedChild,
        children,
        loading,
        error,
      }}>
      {reactChildren}
    </ChildContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChildContext() {
  const context = useContext(ChildContext);
  if (context === undefined) {
    throw new Error("useChildContext must be used within a ChildProvider");
  }
  return context;
}
