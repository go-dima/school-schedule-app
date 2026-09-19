import React, { useState, useMemo } from "react";
import {
  Card,
  Button,
  Table,
  Modal,
  Space,
  Typography,
  message,
  Spin,
  Empty,
  Tag,
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
import { ChildForm } from "../components/ChildForm";
import { StudentSearchSelector } from "../components/StudentSearchSelector";
import { GroupTrackTags } from "../components/GroupTrackTags";
import { ToggleFilterGroup } from "../components/ToggleFilterGroup";
import { useAuth } from "../contexts/AuthContext";
import { useAllChildrenContext } from "../contexts/AllChildrenContext";
import { childrenApi } from "../services/api";
import type { Child, Scope } from "../types";
import { GRADES } from "../types";
import { isTestScopeWriteAllowed } from "../utils/env";

type ChildWithParent = Child & { assignedParent: boolean };

const ALL_SCOPES: Scope[] = ["prod", "test"];
import { GetGradeName } from "@/utils/grades";

const { Title, Text } = Typography;

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
  const isCurrentUserParent = roleFlags.isParent;
  const isAdmin = roleFlags.isAdmin;
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | undefined>();
  const [formLoading, setFormLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<number | undefined>(
    undefined
  );
  // Admin-only (see the ToggleFilterGroup below) -- staff never see this
  // filter. Both scopes start ON, equivalent to "no filter".
  const [selectedScopes, setSelectedScopes] = useState<Scope[]>(ALL_SCOPES);

  const handleCreateChild = async (data: {
    firstName: string;
    lastName: string;
    grade: number;
    groupNumber: number | null;
    scope?: "test" | "prod";
  }) => {
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
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("students.page.addError")
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateChild = async (data: {
    firstName: string;
    lastName: string;
    grade: number;
    groupNumber: number | null;
    scope?: "test" | "prod";
  }) => {
    if (!editingChild) return;

    setFormLoading(true);
    try {
      await updateChild(editingChild.id, data);
      setIsFormModalOpen(false);
      setEditingChild(undefined);
      message.success(t("students.page.updateSuccess"));
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

  // Filter children based on search and grade
  const filteredChildren = useMemo(() => {
    let filtered = children as ChildWithParent[];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(child => {
        const fullName = `${child.firstName} ${child.lastName}`.toLowerCase();
        const search = searchTerm.toLowerCase();
        return (
          fullName.includes(search) ||
          child.firstName.toLowerCase().includes(search) ||
          child.lastName.toLowerCase().includes(search)
        );
      });
    }

    // Apply grade filter
    if (selectedGrade !== undefined) {
      filtered = filtered.filter(child => child.grade === selectedGrade);
    }

    // Apply scope filter (admin-only UI, but harmless to keep unconditional --
    // non-admins never change selectedScopes away from its all-on default)
    filtered = filtered.filter(child => selectedScopes.includes(child.scope));

    return filtered;
  }, [children, searchTerm, selectedGrade, selectedScopes]);

  const handleChildAdded = (_newChild: Child) => {
    // No action needed: AllChildrenContext already appends the new child,
    // so filteredChildren updates automatically.
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
    {
      title: t("students.table.scope"),
      dataIndex: "scope",
      key: "scope",
      width: 100,
      render: (scope: "prod" | "test") => (
        <Tag color={scope === "prod" ? "green" : "orange"}>
          {t(`scope.${scope}`)}
        </Tag>
      ),
    },
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
  if (!permissions.canManageRoster) {
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
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
        <Title level={2} style={{ margin: 0 }}>
          {t("students.page.title")}
        </Title>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}>
            {t("students.page.addButton")}
          </Button>
        </Space>
      </div>

      {/* Search and Filter Controls */}
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}>
        <Space wrap>
          <StudentSearchSelector
            children={filteredChildren}
            onChildAdded={handleChildAdded}
            onSearchChange={setSearchTerm}
            placeholder={t("students.search.placeholder")}
            style={{ minWidth: 250 }}
            allowClear
            mode="search"
            value={searchTerm}
            defaultGrade={selectedGrade || 1}
            isCreateAllowed={permissions.canManageRoster}
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
        </Space>
        {isAdmin && isTestScopeWriteAllowed() && (
          <ToggleFilterGroup<Scope>
            value={selectedScopes}
            onChange={setSelectedScopes}
            options={ALL_SCOPES.map(scope => ({
              value: scope,
              label: t(`scope.${scope}`),
            }))}
            doubleClickToIsolate={false}
          />
        )}
      </div>

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
          onDuplicateRedirect={childId => {
            const match = children.find(c => c.id === childId);
            if (match) openEditModal(match);
          }}
          canNavigateToEdit
        />
      </Modal>
    </div>
  );
};

export default StudentsPage;
