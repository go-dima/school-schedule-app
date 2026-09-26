import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
import { RoleTagPicker } from "../components/RoleTagPicker";
import { useAuth } from "../contexts/AuthContext";
import { ApiError, usersApi } from "../services/api";
import type { UserRoleData, UserRole } from "../types";
import { ROLE_TAG_COLORS } from "../constants/roleColors";
import { trackEvent, AnalyticsEvent } from "../utils/analytics";
import "./UserManagementPage.css";

const ALL_ROLES: UserRole[] = ["admin", "moderator", "staff", "parent"];

// admin/moderator are elevated roles that require a base role (staff or
// parent) to remain meaningful -- they don't carry their own identity.
const BASE_ROLES: UserRole[] = ["staff", "parent"];
const ELEVATED_ROLES: UserRole[] = ["admin", "moderator"];

const { Text } = Typography;

// Roles that make a user staff (and so give them a display name).
const STAFF_ROLES: UserRole[] = ["admin", "staff", "moderator"];

// Postgres unique_violation: the display name belongs to someone else.
const UNIQUE_VIOLATION = "23505";

interface UserManagementPageProps {}

interface UserWithRoles {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  createdAt: string;
  lastSignInAt?: string;
  roles: UserRoleData[];
}

const UserManagementPage: React.FC<UserManagementPageProps> = () => {
  const { t } = useTranslation();
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
        displayName: user.display_name ?? undefined,
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
      message.error(t("userManagement.page.loadError"));
    } finally {
      setLoading(false);
    }
  };

  // Admin-only RPC (admin_set_display_name): admins can't UPDATE other
  // users' rows directly. Blank clears the name.
  const handleDisplayNameChange = async (
    user: UserWithRoles,
    value: string
  ) => {
    const displayName = value.trim() || undefined;
    if (displayName === user.displayName) return;
    try {
      await usersApi.adminSetDisplayName(user.id, value);
      setUsers(prev =>
        prev.map(u => (u.id === user.id ? { ...u, displayName } : u))
      );
      message.success(t("userManagement.page.displayNameUpdated"));
    } catch (error) {
      message.error(
        error instanceof ApiError && error.code === UNIQUE_VIOLATION
          ? t("profile.page.displayNameTaken")
          : t("userManagement.page.displayNameError")
      );
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
    if (roles.length === 0) {
      return t("userManagement.page.noRolesValidationError");
    }
    const hasElevated = roles.some(role => ELEVATED_ROLES.includes(role));
    const hasBase = roles.some(role => BASE_ROLES.includes(role));
    if (hasElevated && !hasBase) {
      return t("userManagement.page.baseRoleValidationError");
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
      if (role === "moderator") {
        trackEvent(AnalyticsEvent.ModeratorGranted);
      } else if (role === "admin") {
        trackEvent(AnalyticsEvent.AdminGranted);
      }
    }

    for (const role of toRemove) {
      await usersApi.revokeApprovedRole(role.id);
      if (role.role === "moderator") {
        trackEvent(AnalyticsEvent.ModeratorRevoked);
      } else if (role.role === "admin") {
        trackEvent(AnalyticsEvent.AdminRevoked);
      }
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
        message.success(
          t("userManagement.page.updateSuccess", { email: selectedUser.email })
        );
        trackEvent(AnalyticsEvent.UserRoleChanged, {
          roleCount: selectedRoles.length,
        });
        loadUsers(); // Reload the users list
        setModalVisible(false);
        setSelectedUser(null);
      } catch (error) {
        message.error(
          error instanceof Error
            ? error.message
            : t("userManagement.page.updateError")
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
        title: t("userManagement.page.selfDemotion.title"),
        content: t("userManagement.page.selfDemotion.description"),
        okText: t("userManagement.page.selfDemotion.confirmButton"),
        cancelText: t("common.buttons.cancel"),
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

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      user.roles.some(role => roleFilter.includes(role.role))
    );
  }, [users, roleFilter]);

  const columns: ColumnsType<UserWithRoles> = [
    {
      title: t("userManagement.table.nameColumn"),
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
              <Text type="secondary">{t("userManagement.table.noName")}</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: t("userManagement.table.displayNameColumn"),
      key: "displayName",
      width: 130,
      sorter: (a, b) =>
        (a.displayName || "").localeCompare(b.displayName || ""),
      render: (_, record) =>
        record.roles.some(
          role => role.approved && STAFF_ROLES.includes(role.role)
        ) ? (
          <Text
            editable={{
              tooltip: t("userManagement.table.editDisplayName"),
              onChange: value => handleDisplayNameChange(record, value),
            }}>
            {record.displayName || ""}
          </Text>
        ) : null,
    },
    {
      title: t("userManagement.table.emailColumn"),
      key: "email",
      width: 140,
      dataIndex: "email",
      sorter: (a, b) => a.email.localeCompare(b.email),
      render: (email: string) => (
        <Text copyable={{ tooltips: false }}>{email}</Text>
      ),
    },
    {
      title: t("userManagement.table.createdAtColumn"),
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
      title: t("userManagement.table.lastSignInColumn"),
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
              {t("userManagement.table.neverSignedIn")}
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
          displayText = t("userManagement.table.daysAgo", {
            count: diffDays,
          });
        } else if (diffHours > 0) {
          displayText = t("userManagement.table.hoursAgo", {
            count: diffHours,
          });
        } else if (diffMinutes > 0) {
          displayText = t("userManagement.table.minutesAgo", {
            count: diffMinutes,
          });
        } else {
          displayText = t("userManagement.table.now");
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
      title: t("userManagement.table.rolesColumn"),
      key: "roles",
      width: 50,
      sorter: (a, b) =>
        a.roles
          .map(role => t(`roles.${role.role}`, role.role))
          .sort()
          .join(",")
          .localeCompare(
            b.roles
              .map(role => t(`roles.${role.role}`, role.role))
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
              {t(`roles.${role.role}`, role.role)}
              {!role.approved && t("userManagement.table.pendingSuffix")}
            </Tag>
          ))}
          {record.roles.length === 0 && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {t("userManagement.table.noRoles")}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t("userManagement.table.actionsColumn"),
      key: "actions",
      width: 90,
      align: "center",
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={() => handleManageRoles(record)}>
            {t("userManagement.table.manageRolesButton")}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-content">
      <Alert
        message={t("userManagement.page.alertMessage")}
        description={t("userManagement.page.alertDescription")}
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
            label: t(`roles.${role}`, role),
            color: ROLE_TAG_COLORS[role],
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
            t("userManagement.table.pagination", {
              start: range[0],
              end: range[1],
              total,
            }),
        }}
        locale={{
          emptyText: t("userManagement.table.emptyText"),
        }}
        scroll={{ x: 1170 }}
      />

      <Modal
        title={t("userManagement.modal.title")}
        open={modalVisible}
        onOk={saveRoles}
        onCancel={() => {
          setModalVisible(false);
          setSelectedUser(null);
          setValidationError(null);
        }}
        confirmLoading={actionLoading}
        okText={t("common.buttons.save")}
        cancelText={t("common.buttons.cancel")}
        okButtonProps={{ disabled: selectedRoles.length === 0 }}
        footer={(_, { OkBtn, CancelBtn }) => (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 12,
            }}>
            {selectedRoles.length === 0 && (
              <Text type="danger" style={{ fontSize: 13 }}>
                {t("userManagement.page.noRolesValidationError")}
              </Text>
            )}
            <CancelBtn />
            <OkBtn />
          </div>
        )}>
        <p>
          {t("userManagement.modal.description")}{" "}
          <strong>{selectedUser?.email}</strong>:
        </p>
        <div style={{ marginBottom: 16 }}>
          <RoleTagPicker
            roles={ALL_ROLES}
            selected={selectedRoles}
            onToggle={toggleRole}
          />
        </div>
        {validationError && (
          <Alert
            message={validationError}
            type="error"
            showIcon
            style={{ marginTop: 8 }}
          />
        )}
      </Modal>
    </div>
  );
};

export default UserManagementPage;
