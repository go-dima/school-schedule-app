import React, { useState } from "react";
import { Modal, message } from "antd";
import { PlusOutlined, UserOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { ChildForm } from "./ChildForm";
import { TextSearch } from "./TextSearch";
import { TextSearchSheet } from "./TextSearchSheet";
import type { TextSearchExtraOption } from "./TextSearch";
import { useAllChildrenContext } from "../contexts/AllChildrenContext";
import { useAuth } from "../contexts/AuthContext";
import { useUiMode } from "../contexts/UiModeContext";
import { GetGradeName } from "@/utils/grades";
import { studentName } from "@/utils/personName";
import type { Child } from "../types";

interface StudentSearchSelectorCommonProps {
  children: Child[];
  onChildAdded?: (child: Child) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  /** Grade prefilled in the add-student form. */
  defaultGrade?: number;
}

/** SchedulePage: pick one student; the value is their id. */
interface StudentSearchSelectorPickProps
  extends StudentSearchSelectorCommonProps {
  mode: "pick";
  selectedChildId?: string | null;
  onChildSelect: (childId: string | undefined) => void;
}

/** StudentsPage: the typed text filters the caller's list. */
interface StudentSearchSelectorFilterProps
  extends StudentSearchSelectorCommonProps {
  mode: "filter";
  value: string;
  onSearchChange: (searchTerm: string) => void;
}

type StudentSearchSelectorProps =
  | StudentSearchSelectorPickProps
  | StudentSearchSelectorFilterProps;

/**
 * TextSearch over students, plus the "add student" row for a name nothing
 * matches, which opens ChildForm prefilled with that name.
 */
export const StudentSearchSelector: React.FC<
  StudentSearchSelectorProps
> = props => {
  const {
    children,
    onChildAdded,
    placeholder,
    style,
    disabled = false,
    defaultGrade = 1,
  } = props;
  const { t } = useTranslation();
  const { roleFlags } = useAuth();
  const isAdmin = roleFlags.isAdmin;
  // Mobile UI Mode swaps the pick dropdown for a bottom sheet (ADR 0001).
  const { mode: uiMode } = useUiMode();
  const { createChild } = useAllChildrenContext();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Child | undefined>();
  const [addLoading, setAddLoading] = useState(false);

  const renderStudent = (child: Child) => (
    <div style={{ display: "flex", alignItems: "center" }}>
      <UserOutlined style={{ marginInlineEnd: 8, color: "#1890ff" }} />
      {studentName(child)}
      {props.mode === "pick" && ` - ${GetGradeName(child.grade)}`}
    </div>
  );

  const addStudentOption: TextSearchExtraOption = {
    label: query => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          color: "#52c41a",
          cursor: "pointer",
          padding: "4px 0",
        }}>
        <PlusOutlined style={{ marginInlineEnd: 8 }} />
        {t("students.search.addStudent", { name: query })}
      </div>
    ),
    onSelect: query => {
      const [firstName, ...lastNameParts] = query.split(/\s+/);
      setEditingStudent({
        id: "",
        firstName: firstName || "",
        lastName: lastNameParts.join(" "),
        grade: defaultGrade,
        groupNumber: 1,
        trackNumber: null,
        scope: "prod",
        createdAt: "",
        updatedAt: "",
      } as Child);
      setIsAddModalOpen(true);
    },
  };

  // ChildForm already runs the Task 6 local-duplicate check (via
  // childrenApi.findLocalDuplicateChildren + decideDuplicateWarning) before
  // ever calling this onSubmit handler, so this stays a plain create --
  // re-running the same check here would just show the same dialog twice.
  const handleCreateStudent = async (data: {
    firstName: string;
    lastName: string;
    grade: number;
    groupNumber: number | null;
    scope?: "test" | "prod";
  }) => {
    setAddLoading(true);
    try {
      const newChild = await createChild(
        data.firstName,
        data.lastName,
        data.grade,
        data.groupNumber,
        data.scope || "prod"
      );
      setIsAddModalOpen(false);
      setEditingStudent(undefined);
      message.success(t("students.page.addSuccess"));

      // Notify parent component of the new child
      if (onChildAdded && newChild) {
        onChildAdded(newChild);
      }
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("students.page.addError")
      );
    } finally {
      setAddLoading(false);
    }
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingStudent(undefined);
  };

  const common = {
    items: children,
    getText: studentName,
    renderOption: renderStudent,
    extraOption: addStudentOption,
    placeholder,
    style,
    disabled,
  };

  return (
    <>
      {props.mode === "pick" && uiMode === "mobile" ? (
        <TextSearchSheet<Child>
          {...common}
          mode="pick"
          getKey={child => child.id}
          value={props.selectedChildId}
          onSelect={child => props.onChildSelect(child?.id)}
        />
      ) : props.mode === "pick" ? (
        <TextSearch<Child>
          {...common}
          mode="pick"
          getKey={child => child.id}
          value={props.selectedChildId}
          onSelect={child => props.onChildSelect(child?.id)}
        />
      ) : (
        <TextSearch<Child>
          {...common}
          mode="filter"
          value={props.value}
          onChange={props.onSearchChange}
        />
      )}

      <Modal
        title={t("students.page.addModalTitle")}
        open={isAddModalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden>
        <ChildForm
          child={editingStudent}
          onSubmit={handleCreateStudent}
          onCancel={closeModal}
          loading={addLoading}
          showScope={isAdmin}
          onDuplicateRedirect={() => {
            closeModal();
            message.info(t("child.duplicateWarning.sameCreatorMessage"));
          }}
        />
      </Modal>
    </>
  );
};
