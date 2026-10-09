import { useMemo, useState } from "react";
import { message } from "antd";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useAllChildrenContext } from "../../contexts/AllChildrenContext";
import { childrenApi } from "../../services/api";
import type { Child, Scope } from "../../types";
import { ALL_SCOPES } from "../../constants/scopes";
import { trackEvent, AnalyticsEvent } from "../../utils/analytics";
import { filterByText } from "@/utils/textSearch";
import { studentName } from "@/utils/personName";

export type ChildWithParent = Child & { assignedParent: boolean };

export interface StudentFormData {
  firstName: string;
  lastName: string;
  grade: number;
  groupNumber: number | null;
  scope?: "test" | "prod";
}

// Narrows the students list by name text, grade and (admin-only) scope.
// Pure so the filter combinations are testable without rendering.
export function filterStudents(
  students: ChildWithParent[],
  searchTerm: string,
  selectedGrade: number | undefined,
  selectedScopes: Scope[]
): ChildWithParent[] {
  let filtered = filterByText(students, searchTerm, studentName);

  if (selectedGrade !== undefined) {
    filtered = filtered.filter(child => child.grade === selectedGrade);
  }

  // Admin-only UI, but harmless to keep unconditional -- non-admins never
  // change selectedScopes away from its all-on default.
  return filtered.filter(child => selectedScopes.includes(child.scope));
}

// State and actions of the Students page, so a second view can render from
// the same logic.
export function useStudentsController() {
  const { t } = useTranslation();
  const { permissions, roleFlags } = useAuth();
  const {
    children,
    loading,
    error,
    createChild,
    updateChild,
    removeChild,
    refetch,
  } = useAllChildrenContext();
  const isAdmin = roleFlags.isAdmin;
  const isCurrentUserParent = roleFlags.isParent;
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | undefined>();
  const [formLoading, setFormLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<number | undefined>(
    undefined
  );
  // Admin-only filter -- staff never see it. Both scopes start ON,
  // equivalent to "no filter".
  const [selectedScopes, setSelectedScopes] = useState<Scope[]>([
    ...ALL_SCOPES,
  ]);

  const handleCreateChild = async (data: StudentFormData) => {
    setFormLoading(true);
    try {
      await createChild(
        data.firstName,
        data.lastName,
        data.grade,
        data.groupNumber,
        data.scope || "prod"
      );
      setIsFormModalOpen(false);
      setEditingChild(undefined);
      message.success(t("students.page.addSuccess"));
      trackEvent(AnalyticsEvent.StudentSaved, { mode: "create" });
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("students.page.addError")
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateChild = async (data: StudentFormData) => {
    if (!editingChild) return;

    setFormLoading(true);
    try {
      await updateChild(editingChild.id, data);
      setIsFormModalOpen(false);
      setEditingChild(undefined);
      message.success(t("students.page.updateSuccess"));
      trackEvent(AnalyticsEvent.StudentSaved, { mode: "update" });
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("students.page.updateError")
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    try {
      await removeChild(childId);
      message.success(t("students.page.deleteSuccess"));
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("students.page.deleteError")
      );
    }
  };

  const handleClaimChild = async (childId: string) => {
    try {
      await childrenApi.claimChild(childId);
      message.success(t("students.page.claimSuccess"));
      await refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  };

  const openEditModal = (child: Child) => {
    setEditingChild(child);
    setIsFormModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingChild(undefined);
    setIsFormModalOpen(true);
  };

  const closeModal = () => {
    setIsFormModalOpen(false);
    setEditingChild(undefined);
  };

  // The form found a duplicate: edit the existing student instead.
  const handleDuplicateRedirect = (childId: string) => {
    const match = children.find(c => c.id === childId);
    if (match) openEditModal(match);
  };

  const filteredChildren = useMemo(
    () => filterStudents(children, searchTerm, selectedGrade, selectedScopes),
    [children, searchTerm, selectedGrade, selectedScopes]
  );

  // A parent can claim a student who has no parent assigned yet.
  const canClaim = (child: ChildWithParent) =>
    isCurrentUserParent && !child.assignedParent;

  const handleChildAdded = (_newChild: Child) => {
    // No action needed: AllChildrenContext already appends the new child,
    // so filteredChildren updates automatically.
  };

  return {
    canManageRoster: permissions.canManageRoster,
    isAdmin,
    canClaim,
    loading,
    error,
    filteredChildren,
    searchTerm,
    setSearchTerm,
    selectedGrade,
    setSelectedGrade,
    selectedScopes,
    setSelectedScopes,
    isFormModalOpen,
    editingChild,
    formLoading,
    openCreateModal,
    openEditModal,
    closeModal,
    handleCreateChild,
    handleUpdateChild,
    handleDeleteChild,
    handleClaimChild,
    handleChildAdded,
    handleDuplicateRedirect,
  };
}
