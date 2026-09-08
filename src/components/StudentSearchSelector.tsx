import React, { useState, useMemo } from "react";
import { AutoComplete, Modal, message } from "antd";
import { PlusOutlined, UserOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { ChildForm } from "./ChildForm";
import { childrenApi } from "../services/api";
import { GetGradeName } from "@/utils/grades";
import type { Child } from "../types";

interface StudentSearchSelectorProps {
  children: Child[];
  selectedChildId?: string | null;
  onChildSelect?: (childId: string | undefined) => void;
  onChildAdded?: (child: Child) => void;
  onSearchChange?: (searchTerm: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  allowClear?: boolean;
  defaultGrade?: number;
  isCreateAllowed?: boolean;
  mode?: "select" | "search"; // 'select' for SchedulePage, 'search' for StudentsPage
  value?: string; // For controlled input in search mode
}

export const StudentSearchSelector: React.FC<StudentSearchSelectorProps> = ({
  children,
  selectedChildId,
  onChildSelect,
  onChildAdded,
  onSearchChange,
  placeholder,
  style,
  disabled = false,
  allowClear = true,
  defaultGrade = 1,
  isCreateAllowed = true,
  mode = "select",
  value,
}) => {
  const { t } = useTranslation();
  const [internalSearchTerm, setInternalSearchTerm] = useState<string>("");

  // Use controlled value if provided (search mode), otherwise internal state (select mode)
  // In select mode, show selected child name only if user hasn't started typing
  const searchTerm =
    mode === "search"
      ? value || ""
      : internalSearchTerm ||
        (selectedChildId && mode === "select"
          ? (() => {
              const selectedChild = children.find(
                c => c.id === selectedChildId
              );
              return selectedChild
                ? `${selectedChild.firstName} ${selectedChild.lastName}`
                : "";
            })()
          : "");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Child | undefined>();
  const [addLoading, setAddLoading] = useState(false);

  // Generate search options with add student functionality
  const searchOptions = useMemo(() => {
    // Filter children by search term (show all if no search term)
    const filteredChildren = children.filter(child => {
      if (!searchTerm) return true; // Show all children when no search term

      const fullName = `${child.firstName} ${child.lastName}`.toLowerCase();
      const search = searchTerm.toLowerCase();
      return (
        fullName.includes(search) ||
        child.firstName.toLowerCase().includes(search) ||
        child.lastName.toLowerCase().includes(search)
      );
    });

    // Generate matching children options
    const matchingChildren = filteredChildren.map(child => {
      const displayValue =
        mode === "search" ? `${child.firstName} ${child.lastName}` : child.id;

      return {
        value: displayValue,
        label: (
          <div style={{ display: "flex", alignItems: "center" }}>
            <UserOutlined style={{ marginRight: 8, color: "#1890ff" }} />
            {`${child.firstName} ${child.lastName}`}
            {mode === "select" && ` - ${GetGradeName(child.grade)}`}
          </div>
        ),
      };
    });

    // If no matches and search term is not empty, add "Add Student" option
    if (matchingChildren.length === 0 && searchTerm.trim() && isCreateAllowed) {
      return [
        {
          value: `__ADD_STUDENT__${searchTerm}`,
          label: (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: "#52c41a",
                cursor: "pointer",
                padding: "4px 0",
              }}>
              <PlusOutlined style={{ marginRight: 8 }} />
              {t("students.search.addStudent", { name: searchTerm })}
            </div>
          ),
        },
      ];
    }

    return matchingChildren;
  }, [searchTerm, children, t, mode, isCreateAllowed]);

  const handleSearchSelect = (value: string) => {
    if (value.startsWith("__ADD_STUDENT__")) {
      const searchName = value.replace("__ADD_STUDENT__", "");
      const [firstName, ...lastNameParts] = searchName.trim().split(/\s+/);
      const lastName = lastNameParts.join(" ");

      setEditingStudent({
        id: "",
        firstName: firstName || "",
        lastName: lastName || "",
        grade: defaultGrade,
        groupNumber: 1,
        trackNumber: null,
        scope: "prod",
        createdAt: "",
        updatedAt: "",
      } as Child);
      setIsAddModalOpen(true);

      if (mode === "search") {
        // In search mode, notify parent about search clear
        onSearchChange?.("");
      } else {
        // In select mode, clear internal state
        setInternalSearchTerm("");
      }
    } else {
      if (mode === "select") {
        // Regular selection - find the child by name and get ID
        const selectedChild = children.find(
          child =>
            `${child.firstName} ${child.lastName}` === value ||
            child.id === value
        );
        if (selectedChild && onChildSelect) {
          onChildSelect(selectedChild.id);
          // Don't clear in select mode - the searchTerm will be updated via selectedChildId
        }
      } else {
        // In search mode, just update the search term
        onSearchChange?.(value);
      }
    }
  };

  const handleSearchChange = (value: string) => {
    if (mode === "search") {
      onSearchChange?.(value);
    } else {
      setInternalSearchTerm(value);
      // Handle clear selection when value is empty (user clicked X button or cleared manually)
      if (!value && selectedChildId && onChildSelect) {
        onChildSelect(undefined);
      }
      // If user starts typing and there's a selected child, clear the selection
      else if (value && selectedChildId && onChildSelect) {
        const selectedChild = children.find(c => c.id === selectedChildId);
        const selectedChildName = selectedChild
          ? `${selectedChild.firstName} ${selectedChild.lastName}`
          : "";
        // Only clear if the typed value is different from the selected child's name
        if (value !== selectedChildName) {
          onChildSelect(undefined);
        }
      }
    }
  };

  const handleCreateStudent = async (data: {
    firstName: string;
    lastName: string;
    grade: number;
    groupNumber: number | null;
    trackNumber?: number | null;
    scope?: "test" | "prod";
  }) => {
    setAddLoading(true);
    try {
      const newChild = await childrenApi.createChild(
        data.firstName,
        data.lastName,
        data.grade,
        data.groupNumber,
        data.scope || "prod",
        data.trackNumber ?? null
      );
      setIsAddModalOpen(false);
      setEditingStudent(undefined);
      message.success(t("students.page.addSuccess"));

      // Notify parent component of the new child
      if (onChildAdded && newChild) {
        onChildAdded(newChild);
      }

      // Reload the page to refresh the children list
      window.location.reload();
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

  return (
    <>
      <AutoComplete
        value={searchTerm}
        options={searchOptions}
        onSelect={handleSearchSelect}
        onChange={handleSearchChange}
        onFocus={() => {
          // When user focuses on the input, prepare for searching
          if (mode === "select") {
            // If a child is selected and user focuses, allow them to start typing immediately
            if (selectedChildId && !internalSearchTerm) {
              // Don't clear the selection yet, but prepare for typing
              setInternalSearchTerm("");
            }
          }
        }}
        placeholder={placeholder}
        style={style}
        allowClear={allowClear}
        filterOption={false}
        disabled={disabled}
        defaultActiveFirstOption={false}
      />

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
        />
      </Modal>
    </>
  );
};
