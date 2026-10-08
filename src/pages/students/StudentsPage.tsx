import React from "react";
import {
  Card,
  Button,
  Table,
  Modal,
  Typography,
  Spin,
  Empty,
  Select,
  Dropdown,
  MenuProps,
} from "antd";
import { useTranslation } from "react-i18next";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  UserDeleteOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { ChildForm } from "../../components/ChildForm";
import { StudentSearchSelector } from "../../components/StudentSearchSelector";
import { FiltersBar } from "../../components/FiltersBar";
import { GroupTrackTags } from "../../components/GroupTrackTags";
import type { Scope } from "../../types";
import {
  useStudentsController,
  type ChildWithParent,
} from "./useStudentsController";
import { GRADES } from "../../types";

import { GetGradeName } from "@/utils/grades";
import { ScopeTag } from "../../components/ScopeTag";
import { ScopeFilter } from "../../components/ScopeSelector";
import { isTestScopeEnabled } from "../../utils/env";

const { Text } = Typography;

const ParentIcon: React.FC<{ assignedParent: boolean }> = ({
  assignedParent,
}) => {
  const color = assignedParent ? "#52c41a" : "#ff4d4f";
  return (
    <span>
      {assignedParent ? (
        <UserOutlined style={{ color, fontSize: "16px" }} />
      ) : (
        <UserDeleteOutlined style={{ color, fontSize: "16px" }} />
      )}
    </span>
  );
};

const StudentsPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    canManageRoster,
    isAdmin,
    isCurrentUserParent,
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
  } = useStudentsController();

  const columns: ColumnsType<ChildWithParent> = [
    {
      title: t("students.table.name"),
      key: "name",
      render: (_, record) => (
        <span style={{ fontWeight: "500" }}>
          <ParentIcon assignedParent={record.assignedParent} />{" "}
          {record.firstName} {record.lastName}
        </span>
      ),
    },
    {
      title: t("students.table.grade"),
      dataIndex: "grade",
      key: "grade",
      width: 120,
      render: (grade: number) => GetGradeName(grade),
    },
    {
      title: t("students.table.groupTrack"),
      key: "groupTrack",
      width: 140,
      align: "center",
      render: (_, record) => (
        <GroupTrackTags
          groupNumber={record.groupNumber}
          trackNumber={record.trackNumber}
        />
      ),
    },
    // Production loads prod data only, so the column would always read prod.
    ...(isTestScopeEnabled()
      ? [
          {
            title: t("students.table.scope"),
            dataIndex: "scope",
            key: "scope",
            width: 100,
            render: (scope: Scope) => <ScopeTag scope={scope} />,
          },
        ]
      : []),
    {
      title: t("students.table.createdDate"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (createdAt: string) =>
        new Date(createdAt).toLocaleDateString("he-IL"),
    },
    {
      title: t("students.page.createdByColumn"),
      dataIndex: "createdByName",
      key: "createdByName",
      render: (name: string | null) => name ?? "—",
    },
    {
      title: t("students.table.actions"),
      key: "actions",
      width: 60,
      render: (_, record) => {
        const menuItems: MenuProps["items"] = [
          {
            key: "edit",
            label: t("students.page.editButton"),
            icon: <EditOutlined />,
            onClick: () => openEditModal(record),
          },
          ...(isCurrentUserParent && !record.assignedParent
            ? [
                {
                  key: "claim",
                  label: t("students.page.claimAction"),
                  icon: <UserOutlined />,
                  onClick: () => handleClaimChild(record.id),
                },
              ]
            : []),
          {
            type: "divider" as const,
          },
          {
            key: "delete",
            label: t("students.page.removeButton"),
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: t("students.page.deleteConfirmTitle"),
                content: t("students.page.deleteConfirmDescription"),
                okText: t("students.page.confirmDelete"),
                cancelText: t("common.buttons.cancel"),
                onOk: () => handleDeleteChild(record.id),
              });
            },
          },
        ];

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={["click"]}
            placement="bottomLeft">
            <Button
              type="text"
              icon={<MoreOutlined />}
              size="small"
              title={t("students.table.actions")}
            />
          </Dropdown>
        );
      },
    },
  ];

  // Check permissions
  if (!canManageRoster) {
    return (
      <div className="page-content">
        <Card>
          <Empty
            description={t("students.page.noPermission")}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* The bar's groups are ltr: the first child is leftmost. On screen,
          right to left: grade, name search | Add, scope (admin). */}
      <FiltersBar
        actions={
          <>
            {isAdmin && (
              <ScopeFilter
                value={selectedScopes}
                onChange={setSelectedScopes}
              />
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}>
              {t("students.page.addButton")}
            </Button>
          </>
        }>
        <StudentSearchSelector
          children={filteredChildren}
          onChildAdded={handleChildAdded}
          onSearchChange={setSearchTerm}
          placeholder={t("students.search.placeholder")}
          style={{ minWidth: 250 }}
          mode="filter"
          value={searchTerm}
          defaultGrade={selectedGrade || 1}
        />
        <Select
          value={selectedGrade}
          onChange={setSelectedGrade}
          placeholder={t("students.filter.allGrades")}
          allowClear
          style={{ minWidth: 120 }}>
          {GRADES.map(grade => (
            <Select.Option key={grade} value={grade}>
              {GetGradeName(grade)}
            </Select.Option>
          ))}
        </Select>
      </FiltersBar>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Text type="danger">{error}</Text>
        </div>
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={filteredChildren}
          rowKey="id"
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              t("students.table.pagination", {
                start: range[0],
                end: range[1],
                total,
              }),
          }}
          locale={{
            emptyText: (
              <Empty
                description={t("students.page.noStudents")}
                image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openCreateModal}>
                  {t("students.page.addFirstStudent")}
                </Button>
              </Empty>
            ),
          }}
        />
      </Card>

      <Modal
        title={
          editingChild
            ? t("students.page.editModalTitle")
            : t("students.page.addModalTitle")
        }
        open={isFormModalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden>
        <ChildForm
          child={editingChild}
          onSubmit={editingChild ? handleUpdateChild : handleCreateChild}
          onCancel={closeModal}
          loading={formLoading}
          showScope={isAdmin}
          onDuplicateRedirect={handleDuplicateRedirect}
          canNavigateToEdit
        />
      </Modal>
    </div>
  );
};

export default StudentsPage;
