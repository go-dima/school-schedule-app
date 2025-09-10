import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Typography,
  message,
  Modal,
  Alert,
} from "antd";
import {
  UserOutlined,
  CrownOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { usersApi } from "../services/api";
import type { UserRoleData, UserRole, AppOnNavigate } from "../types";
import "./UserManagementPage.css";
import { PendingApprovalsButton } from "@/buttons/PendingApprovalsButton";
import { ClassManagementButton } from "@/buttons/ClassManagementButton";

const { Title, Text } = Typography;

interface UserManagementPageProps {
  onNavigate?: AppOnNavigate;
}

interface UserWithRoles {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  roles: UserRoleData[];
}

const UserManagementPage: React.FC<UserManagementPageProps> = ({
  onNavigate,
}) => {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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

  const columns: ColumnsType<UserWithRoles> = [
    {
      title: "משתמש",
      key: "user",
      render: (_, record) => {
        const firstName = record.firstName || "";
        const lastName = record.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim();

        return (
          <Space direction="vertical" size="small">
            <Space>
              <UserOutlined />
              <div>
                {fullName ? (
                  <Text strong>{fullName}</Text>
                ) : (
                  <Text type="secondary">לא הוזן שם</Text>
                )}
              </div>
            </Space>
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {record.email}
            </Text>
            <Text type="secondary" style={{ fontSize: "12px" }}>
              נרשם: {new Date(record.createdAt).toLocaleDateString("he-IL")}
            </Text>
          </Space>
        );
      },
    },
    {
      title: "תפקידים",
      key: "roles",
      render: (_, record) => (
        <Space wrap>
          {record.roles.map(role => (
            <Tag
              key={role.id}
              color={getRoleColor(role.role)}
              style={{ opacity: role.approved ? 1 : 0.6 }}>
              {getRoleDisplayName(role.role)}
              {!role.approved && " (ממתין)"}
            </Tag>
          ))}
          {record.roles.length === 0 && (
            <Text type="secondary">אין תפקידים</Text>
          )}
        </Space>
      ),
    },
    {
      title: "פעולות",
      key: "actions",
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
              <Tag color="red" icon={<CrownOutlined />}>
                מנהל
              </Tag>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="user-management-page">
      <Card>
        <div className="page-header">
          <div className="header-content">
            <Space>
              <UserOutlined style={{ fontSize: "24px", color: "#1890ff" }} />
              <Title level={2} style={{ margin: 0 }}>
                ניהול משתמשים
              </Title>
            </Space>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => onNavigate?.("schedule")}>
                חזרה למערכת השעות
              </Button>
              <ClassManagementButton onNavigate={onNavigate} />
              <PendingApprovalsButton onNavigate={onNavigate} />
              <Button
                icon={<ReloadOutlined />}
                onClick={loadUsers}
                loading={loading}>
                רענן
              </Button>
            </Space>
          </div>
        </div>

        <Alert
          message="ניהול תפקידי משתמשים"
          description="כאן תוכל לקדם משתמשים לתפקיד מנהל. משתמשים חדשים נרשמים אוטומטית כהורים."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Table<UserWithRoles>
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          locale={{
            emptyText: "לא נמצאו משתמשים",
          }}
        />
      </Card>

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
