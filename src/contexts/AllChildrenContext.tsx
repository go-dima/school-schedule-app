import React, { createContext, useContext, useState } from "react";
import { useAllChildren } from "../hooks/useAllChildren";
import type { Child, Scope } from "../types";

type ChildWithParent = Child & { assignedParent: boolean };

interface AllChildrenContextType {
  selectedChild: Child | undefined;
  setSelectedChild: (child: Child | undefined) => void;
  children: ChildWithParent[];
  loading: boolean;
  error: string | null;
  createChild: (
    firstName: string,
    lastName: string,
    grade: number,
    groupNumber?: number | null,
    scope?: Scope,
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

const AllChildrenContext = createContext<AllChildrenContextType | undefined>(
  undefined
);

export function AllChildrenProvider({
  children: reactChildren,
}: {
  children: React.ReactNode;
}) {
  const [selectedChild, setSelectedChild] = useState<Child | undefined>(
    undefined
  );
  const { children, loading, error, createChild, updateChild, removeChild } =
    useAllChildren();

  return (
    <AllChildrenContext.Provider
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
    </AllChildrenContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAllChildrenContext() {
  const context = useContext(AllChildrenContext);
  if (context === undefined) {
    throw new Error(
      "useAllChildrenContext must be used within an AllChildrenProvider"
    );
  }
  return context;
}
