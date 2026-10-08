import React from "react";
import { Dropdown, Avatar, Typography, Space, Switch, Tag } from "antd";
import {
  UserOutlined,
  EditOutlined,
  LogoutOutlined,
  DownOutlined,
  DesktopOutlined,
  MobileOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUiMode } from "../contexts/UiModeContext";
import { ROUTES } from "../routes/paths";
import { ROLE_TAG_COLORS } from "../constants/roleColors";
import type { MenuProps } from "antd";

const { Text } = Typography;

const ProfileDropdown: React.FC = () => {
  const { t } = useTranslation();
  const { user, signOut, currentRole } = useAuth();
  const navigate = useNavigate();
  const { mode, detected, setOverride } = useUiMode();

  const handleEditProfile = () => {
    navigate(ROUTES.PROFILE_SETTINGS);
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    const first = firstName ? firstName[0].toUpperCase() : "";
    const last = lastName ? lastName[0].toUpperCase() : "";
    return `${first}${last}` || "U";
  };

  const getFullName = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return t("profile.dropdown.anonymous");
    return `${firstName || ""} ${lastName || ""}`.trim();
  };

  const items: MenuProps["items"] = [
    {
      key: "user-info",
      label: (
        <div
          style={{
            padding: "8px 0",
            borderBottom: "1px solid #f0f0f0",
            marginBottom: 8,
          }}>
          {/* Name on the right, the active role pill on the left (RTL), and
              the email below. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}>
            <Text strong>{getFullName(user?.firstName, user?.lastName)}</Text>
            {currentRole && (
              <Tag
                className="profile-dropdown-role"
                color={ROLE_TAG_COLORS[currentRole.role]}>
                {t(`roles.${currentRole.role}`, currentRole.role)}
              </Tag>
            )}
          </div>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {user?.email}
          </Text>
        </div>
      ),
      disabled: true,
    },
    {
      key: "edit-profile",
      label: (
        <Space>
          <EditOutlined />
          {t("profile.dropdown.editProfile")}
        </Space>
      ),
      onClick: handleEditProfile,
    },
    // An on/off switch for the other UI Mode than the device's: "mobile
    // view" on a computer, "desktop view" on a phone. Off (the default)
    // follows the device; on pins the other mode.
    {
      key: "switch-ui-mode",
      label: (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}>
          <Space>
            {detected === "mobile" ? <DesktopOutlined /> : <MobileOutlined />}
            {detected === "mobile"
              ? t("profile.dropdown.desktopView")
              : t("profile.dropdown.mobileView")}
          </Space>
          {/* Display only: the click lands on the menu item. */}
          <Switch
            size="small"
            checked={mode !== detected}
            style={{ flexShrink: 0 }}
          />
        </div>
      ),
      onClick: () =>
        setOverride(
          mode !== detected
            ? null
            : detected === "mobile"
              ? "desktop"
              : "mobile"
        ),
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      label: (
        <Space>
          <LogoutOutlined />
          {t("profile.dropdown.logout")}
        </Space>
      ),
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <div className="profile-dropdown">
      <Dropdown
        menu={{ items }}
        placement="bottomLeft"
        trigger={["click"]}
        overlayClassName="profile-dropdown-overlay">
        <div className="profile-dropdown-trigger">
          <div className="profile-dropdown-user">
            <Avatar
              className="profile-dropdown-avatar"
              size="small"
              icon={<UserOutlined />}>
              {getInitials(user?.firstName, user?.lastName)}
            </Avatar>
            <Text className="profile-dropdown-name">
              {getFullName(user?.firstName, user?.lastName)}
            </Text>
            <DownOutlined style={{ fontSize: "12px", color: "#8c8c8c" }} />
          </div>
        </div>
      </Dropdown>
    </div>
  );
};

export default ProfileDropdown;
