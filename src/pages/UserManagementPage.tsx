import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  Button,
  Tag,
  Space,
  Typography,
  message,
  Modal,
  Alert,
} from "antd";
import { UserOutlined, CrownOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { FiltersBar } from "../components/FiltersBar";
import { FilterField } from "../components/FilterField";
import { ToggleFilterGroup } from "../components/ToggleFilterGroup";
import { usersApi } from "../services/api";
import type { UserRoleData, UserRole } from "../types";
import "./UserManagementPage.css";

const ALL_ROLES: UserRole[] = ["admin", "staff", "parent"];

const { Title, Text } = Typography;

interface UserManagementPageProps {}

interface UserWithRoles {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  lastSignInAt?: string;
  roles: UserRoleData[];
}

const UserManagementPage: React.FC<UserManagementPageProps> = () => {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  // Every role starts ON (toggled via ToggleFilterGroup below) -- semantically
  // equivalent to the old empty-array "no filter" default, but the UI always
  // shows each role's on/off state instead of hiding it behind a dropdown.
  const [roleFilter, setRoleFilter] = useState<UserRole[]>(ALL_ROLES);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const usersData = await usersApi.getAllUsersWithRoles();

      const transformedUsers: UserWithRoles[] = usersData.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        roles: user.user_roles.map((role: any) => ({
          id: role.id,
          userId: user.id,
          role: role.role,
          approved: role.approved,
          createdAt: role.created_at,
          updatedAt: role.updated_at,
        })),
      }));

      setUsers(transformedUsers);
    } catch (error) {
      message.error("שגיאה בטעינת המשתמשים");
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteToAdmin = async (user: UserWithRoles) => {
    setSelectedUser(user);
    setModalVisible(true);
  };

  const confirmPromoteToAdmin = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      // Add admin role to user
      await usersApi.requestRole(selectedUser.id, "admin");

      // Get the newly created role and approve it immediately
      const userRoles = await usersApi.getUserRoles(selectedUser.id);
      const adminRole = userRoles.find(
        role => role.role === "admin" && !role.approved
      );

      if (adminRole) {
        await usersApi.approveRole(adminRole.id);
      }

      message.success(`המשתמש ${selectedUser.email} קודם למנהל בהצלחה`);
      loadUsers(); // Reload the users list
    } catch (error) {
      message.error("שגיאה בקידום המשתמש למנהל");
    } finally {
      setActionLoading(false);
      setModalVisible(false);
      setSelectedUser(null);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const getRoleDisplayName = (role: UserRole): string => {
    const roleNames: Record<UserRole, string> = {
      admin: "מנהל",
      parent: "הורה",
      child: "תלמיד",
      staff: "צוות",
    };
    return roleNames[role] || role;
  };

  const getRoleColor = (role: UserRole): string => {
    const roleColors: Record<UserRole, string> = {
      admin: "red",
      parent: "blue",
      child: "green",
      staff: "orange",
    };
    return roleColors[role] || "default";
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      user.roles.some(role => roleFilter.includes(role.role))
    );
  }, [users, roleFilter]);

  const columns: ColumnsType<UserWithRoles> = [
    {
      title: "שם משתמש",
      key: "name",
      width: 110,
      sorter: (a, b) =>
        `${a.firstName || ""} ${a.lastName || ""}`
          .trim()
          .localeCompare(`${b.firstName || ""} ${b.lastName || ""}`.trim()),
      render: (_, record) => {
        const firstName = record.firstName || "";
        const lastName = record.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim();

        return (
          <Space>
            <UserOutlined />
            {fullName ? (
              <Text strong>{fullName}</Text>
            ) : (
              <Text type="secondary">לא הוזן שם</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: "דוא״ל",
      key: "email",
      width: 140,
      dataIndex: "email",
      sorter: (a, b) => a.email.localeCompare(b.email),
      render: (email: string) => (
        <Text copyable={{ tooltips: false }}>{email}</Text>
      ),
    },
    {
      title: "תאריך הרשמה",
      key: "createdAt",
      width: 60,
      dataIndex: "createdAt",
      sorter: (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      defaultSortOrder: "descend",
      render: (date: string) => (
        <Text style={{ fontSize: "12px" }}>
          {new Date(date).toLocaleDateString("he-IL")}
        </Text>
      ),
    },
    {
      title: "כניסה אחרונה",
      key: "lastSignInAt",
      width: 60,
      dataIndex: "lastSignInAt",
      sorter: (a, b) =>
        new Date(a.lastSignInAt || 0).getTime() -
        new Date(b.lastSignInAt || 0).getTime(),
      render: (date?: string) => {
        if (!date) {
          return (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              לא התחבר עדיין
            </Text>
          );
        }

        const signInDate = new Date(date);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - signInDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffTime / (1000 * 60));

        let displayText = "";
        if (diffDays > 7) {
          displayText = signInDate.toLocaleDateString("he-IL");
        } else if (diffDays > 0) {
          displayText = `לפני ${diffDays} ימים`;
        } else if (diffHours > 0) {
          displayText = `לפני ${diffHours} שעות`;
        } else if (diffMinutes > 0) {
          displayText = `לפני ${diffMinutes} דקות`;
        } else {
          displayText = "עכשיו";
        }

        return (
          <Text
            style={{ fontSize: "12px" }}
            title={signInDate.toLocaleString("he-IL")}>
            {displayText}
          </Text>
        );
      },
    },
    {
      title: "תפקידים",
      key: "roles",
      width: 50,
      sorter: (a, b) =>
        a.roles
          .map(role => getRoleDisplayName(role.role))
          .sort()
          .join(",")
          .localeCompare(
            b.roles
              .map(role => getRoleDisplayName(role.role))
              .sort()
              .join(",")
          ),
      render: (_, record) => (
        <Space wrap>
          {record.roles.map(role => (
            <Tag
              key={role.id}
              color={getRoleColor(role.role)}
              style={{
                opacity: role.approved ? 1 : 0.6,
                margin: "2px",
                fontSize: "12px",
              }}>
              {getRoleDisplayName(role.role)}
              {!role.approved && " (ממתין)"}
            </Tag>
          ))}
          {record.roles.length === 0 && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              אין תפקידים
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "פעולות",
      key: "actions",
      width: 90,
      align: "center",
      render: (_, record) => {
        const isAdmin = record.roles.some(
          role => role.role === "admin" && role.approved
        );

        return (
          <Space>
            {!isAdmin && (
              <Button
                type="primary"
                size="small"
                icon={<CrownOutlined />}
                onClick={() => handlePromoteToAdmin(record)}>
                קדם למנהל
              </Button>
            )}
            {isAdmin && (
              <Tag
                color="red"
                icon={<CrownOutlined />}
                style={{ fontSize: "12px" }}>
                מנהל
              </Tag>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <Space>
          <UserOutlined style={{ fontSize: "24px", color: "#1890ff" }} />
          <Title level={2} style={{ margin: 0 }}>
            ניהול משתמשים
          </Title>
        </Space>
      </div>

      <Alert
        message="ניהול תפקידי משתמשים"
        description="כאן תוכל לקדם משתמשים לתפקיד מנהל. משתמשים חדשים נרשמים אוטומטית כהורים."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <FiltersBar
        canRefresh
        onRefresh={loadUsers}
        refreshing={loading}
        disabled={loading}>
        <FilterField label="סנן לפי תפקיד">
          <ToggleFilterGroup<UserRole>
            value={roleFilter}
            onChange={setRoleFilter}
            options={ALL_ROLES.map(role => ({
              value: role,
              label: getRoleDisplayName(role),
            }))}
          />
        </FilterField>
      </FiltersBar>

      <Table<UserWithRoles>
        columns={columns}
        dataSource={filteredUsers}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} מתוך ${total} משתמשים`,
        }}
        locale={{
          emptyText: "לא נמצאו משתמשים",
        }}
        scroll={{ x: 1040 }}
      />

      <Modal
        title="קידום למנהל"
        open={modalVisible}
        onOk={confirmPromoteToAdmin}
        onCancel={() => setModalVisible(false)}
        confirmLoading={actionLoading}
        okText="אשר קידום"
        cancelText="ביטול">
        <p>
          האם אתה בטוח שברצונך לקדם את המשתמש{" "}
          <strong>{selectedUser?.email}</strong> לתפקיד מנהל?
        </p>
        <Alert
          message="שים לב"
          description="מנהלים יכולים לגשת לכל הפונקציות במערכת, כולל ניהול משתמשים ושיעורים."
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Modal>
    </div>
  );
};

export default UserManagementPage;
