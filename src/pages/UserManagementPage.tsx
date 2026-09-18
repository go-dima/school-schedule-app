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
import { UserOutlined, SettingOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { FiltersBar } from "../components/FiltersBar";
import { ToggleFilterGroup } from "../components/ToggleFilterGroup";
import { useAuth } from "../contexts/AuthContext";
import { usersApi } from "../services/api";
import type { UserRoleData, UserRole } from "../types";
import { ROLE_TAG_COLORS } from "../constants/roleColors";
import "./UserManagementPage.css";

const ALL_ROLES: UserRole[] = ["admin", "moderator", "staff", "parent"];

// admin/moderator are elevated roles that require a base role (staff or
// parent) to remain meaningful -- they don't carry their own identity.
const BASE_ROLES: UserRole[] = ["staff", "parent"];
const ELEVATED_ROLES: UserRole[] = ["admin", "moderator"];

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
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
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

  const handleManageRoles = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRoles(
      user.roles.filter(role => role.approved).map(role => role.role)
    );
    setValidationError(null);
    setModalVisible(true);
  };

  const toggleRole = (role: UserRole, checked: boolean) => {
    setValidationError(null);
    setSelectedRoles(prev =>
      checked ? [...prev, role] : prev.filter(r => r !== role)
    );
  };

  // Elevated roles (admin/moderator) carry no identity of their own -- they
  // must be paired with a base role (staff or parent).
  const validateRoleSet = (roles: UserRole[]): string | null => {
    const hasElevated = roles.some(role => ELEVATED_ROLES.includes(role));
    const hasBase = roles.some(role => BASE_ROLES.includes(role));
    if (hasElevated && !hasBase) {
      return "תפקיד מנהל או אחראי/ת מערכת דורש תפקיד בסיס נוסף (הורה או צוות)";
    }
    return null;
  };

  const applyRoleChanges = async (user: UserWithRoles, desired: UserRole[]) => {
    const current = user.roles
      .filter(role => role.approved)
      .map(role => role.role);

    const toAdd = desired.filter(role => !current.includes(role));
    const toRemove = user.roles.filter(
      role => role.approved && !desired.includes(role.role)
    );

    for (const role of toAdd) {
      await usersApi.requestRole(user.id, role);
      const userRoles = await usersApi.getUserRoles(user.id);
      const newRole = userRoles.find(r => r.role === role && !r.approved);
      if (newRole) {
        await usersApi.approveRole(newRole.id);
      }
    }

    for (const role of toRemove) {
      await usersApi.revokeApprovedRole(role.id);
    }
  };

  const saveRoles = async () => {
    if (!selectedUser) return;

    const validationMessage = validateRoleSet(selectedRoles);
    if (validationMessage) {
      setValidationError(validationMessage);
      return;
    }
    setValidationError(null);

    const isSelfDemotion =
      selectedUser.id === currentUser?.id &&
      selectedUser.roles.some(role => role.role === "admin" && role.approved) &&
      !selectedRoles.includes("admin");

    const performSave = async () => {
      setActionLoading(true);
      try {
        await applyRoleChanges(selectedUser, selectedRoles);
        message.success(`תפקידי המשתמש ${selectedUser.email} עודכנו בהצלחה`);
        loadUsers(); // Reload the users list
        setModalVisible(false);
        setSelectedUser(null);
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : "שגיאה בעדכון תפקידי המשתמש"
        );
        // A partial apply may have already committed some grants/revokes to
        // the DB before the failure -- resync the table to actual DB state.
        loadUsers();
      } finally {
        setActionLoading(false);
      }
    };

    if (isSelfDemotion) {
      Modal.confirm({
        title: "הסרת הרשאות מנהל מעצמך",
        content:
          "אתה עומד להסיר מעצמך את תפקיד המנהל. לאחר השמירה לא תוכל עוד לגשת לדף זה. להמשיך?",
        okText: "כן, הסר",
        cancelText: "ביטול",
        okButtonProps: { danger: true },
        onOk: performSave,
      });
      return;
    }

    await performSave();
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
      moderator: "אחראי/ת מערכת",
    };
    return roleNames[role] || role;
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
              color={ROLE_TAG_COLORS[role.role]}
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
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={() => handleManageRoles(record)}>
            ניהול תפקידים
          </Button>
        </Space>
      ),
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
        description="כאן תוכל להוסיף ולהסיר תפקידים למשתמשים. משתמשים חדשים נרשמים אוטומטית כהורים."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <FiltersBar
        canRefresh
        onRefresh={loadUsers}
        refreshing={loading}
        disabled={loading}>
        <ToggleFilterGroup<UserRole>
          value={roleFilter}
          onChange={setRoleFilter}
          options={ALL_ROLES.map(role => ({
            value: role,
            label: getRoleDisplayName(role),
          }))}
        />
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
        title="ניהול תפקידים"
        open={modalVisible}
        onOk={saveRoles}
        onCancel={() => {
          setModalVisible(false);
          setSelectedUser(null);
          setValidationError(null);
        }}
        confirmLoading={actionLoading}
        okText="שמור"
        cancelText="ביטול">
        <p>
          בחר את התפקידים המאושרים עבור המשתמש{" "}
          <strong>{selectedUser?.email}</strong>:
        </p>
        <Space wrap style={{ marginBottom: 16 }}>
          {ALL_ROLES.map(role => (
            <Tag.CheckableTag
              key={role}
              checked={selectedRoles.includes(role)}
              onChange={checked => toggleRole(role, checked)}
              style={{
                fontSize: "13px",
                padding: "4px 12px",
              }}>
              {getRoleDisplayName(role)}
            </Tag.CheckableTag>
          ))}
        </Space>
        {validationError && (
          <Alert
            message={validationError}
            type="error"
            showIcon
            style={{ marginTop: 8 }}
          />
        )}
        <Alert
          message="שים לב"
          description="מנהלים ואחראי/ת מערכת יכולים לגשת לפונקציות ניהול נרחבות. הסרת תפקיד מאושר תבוטל מיידית."
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Modal>
    </div>
  );
};

export default UserManagementPage;
