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

  // Auto-select first child if there's only one and user is a parent
  useEffect(() => {
    if (isParent && children.length === 1 && !selectedChild) {
      setSelectedChild(children[0]);
    }
  }, [children, selectedChild, isParent]);

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
