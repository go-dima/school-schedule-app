import React, { createContext, useContext, useState, useEffect } from "react";
import { useChildren } from "../hooks/useChildren";
import { useAuth } from "./AuthContext";
import type { Child, Scope } from "../types";

interface ChildContextType {
  selectedChild: Child | undefined;
  setSelectedChild: (child: Child | undefined) => void;
  children: Child[];
  loading: boolean;
  error: string | null;
  createChild: (
    firstName: string,
    lastName: string,
    grade: number,
    groupNumber?: number | null,
    trackNumber?: number | null
  ) => Promise<Child>;
  updateChild: (
    childId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      grade?: number;
      groupNumber?: number | null;
      trackNumber?: number | null;
      scope?: Scope;
    }
  ) => Promise<Child>;
  removeChild: (childId: string) => Promise<void>;
}

const ChildContext = createContext<ChildContextType | undefined>(undefined);

export function ChildProvider({
  children: reactChildren,
}: {
  children: React.ReactNode;
}) {
  const [selectedChild, setSelectedChild] = useState<Child | undefined>(
    undefined
  );
  const { permissions } = useAuth();
  const { children, loading, error, createChild, updateChild, removeChild } =
    useChildren();
  // Parents pick among their children; a child user's list is just their
  // own linked student (see useChildren), so it gets selected here too and
  // the whole parent flow works on it unchanged.
  const { canPickSchedule } = permissions;

  // Auto-select the first child when nothing is selected
  useEffect(() => {
    if (canPickSchedule && children.length && !selectedChild && !loading) {
      setSelectedChild(children[0]);
    }
  }, [children, selectedChild, canPickSchedule, loading]);

  // Clear the selected child if the user can't pick schedules
  useEffect(() => {
    if (!canPickSchedule && selectedChild) {
      setSelectedChild(undefined);
    }
  }, [canPickSchedule, selectedChild]);

  // Clear selected child if it no longer exists in children array
  useEffect(() => {
    if (
      selectedChild &&
      !children.find(child => child.id === selectedChild.id)
    ) {
      setSelectedChild(undefined);
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
        createChild,
        updateChild,
        removeChild,
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
