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
  selectedChildId: string | null;
  onChildSelect: (childId: string) => void;
  onChildAdded?: (child: Child) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  allowClear?: boolean;
  defaultGrade?: number;
}

export const StudentSearchSelector: React.FC<StudentSearchSelectorProps> = ({
  children,
  onChildSelect,
  onChildAdded,
  placeholder,
  style,
  disabled = false,
  allowClear = true,
  defaultGrade = 1,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Child | undefined>();
  const [addLoading, setAddLoading] = useState(false);

  // Generate search options with add student functionality
  const searchOptions = useMemo(() => {
    if (!searchTerm) return [];

    // Filter children by search term
    const filteredChildren = children.filter(child => {
      const fullName = `${child.firstName} ${child.lastName}`.toLowerCase();
      const search = searchTerm.toLowerCase();
      return (
        fullName.includes(search) ||
        child.firstName.toLowerCase().includes(search) ||
        child.lastName.toLowerCase().includes(search)
      );
    });

    // Generate matching children options
    const matchingChildren = filteredChildren.map(child => ({
      value: child.id,
      label: (
        <div style={{ display: "flex", alignItems: "center" }}>
          <UserOutlined style={{ marginRight: 8, color: "#1890ff" }} />
          {`${child.firstName} ${child.lastName}`} - {GetGradeName(child.grade)}
        </div>
      ),
    }));

    // If no matches and search term is not empty, add "Add Student" option
    if (matchingChildren.length === 0 && searchTerm.trim()) {
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
  }, [searchTerm, children, t]);

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
        scope: "prod",
        createdAt: "",
        updatedAt: "",
      } as Child);
      setIsAddModalOpen(true);
      setSearchTerm(""); // Clear search after adding
    } else {
      // Regular selection - select the child
      onChildSelect(value);
      setSearchTerm(""); // Clear search after selection
    }
  };

  const handleCreateStudent = async (data: {
    firstName: string;
    lastName: string;
    grade: number;
    groupNumber: number;
    scope?: "test" | "prod";
  }) => {
    setAddLoading(true);
    try {
      const newChild = await childrenApi.createChild(
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
        onChange={setSearchTerm}
        placeholder={placeholder}
        style={style}
        allowClear={allowClear}
        filterOption={false}
        disabled={disabled}
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
