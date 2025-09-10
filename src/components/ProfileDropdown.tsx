import React from "react";
import { Dropdown, Avatar, Typography, Space } from "antd";
import {
  UserOutlined,
  EditOutlined,
  LogoutOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import type { AppOnNavigate } from "../types";
import type { MenuProps } from "antd";

const { Text } = Typography;

interface ProfileDropdownProps {
  onNavigate?: AppOnNavigate;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();

  const handleEditProfile = () => {
    onNavigate?.("profile-settings");
  };

  const handleLogout = () => {
    signOut();
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
          <Text strong>{getFullName(user?.firstName, user?.lastName)}</Text>
          <br />
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
