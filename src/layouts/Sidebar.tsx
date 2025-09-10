import React from "react";
import { Layout, Menu, Badge } from "antd";
import {
  CalendarOutlined,
  BookOutlined,
  TeamOutlined,
  UserOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { usePendingApprovals } from "../hooks/usePendingApprovals";
import type { AppOnNavigate } from "../types";
import type { MenuProps } from "antd";

const { Sider } = Layout;

interface SidebarProps {
  collapsed: boolean;
  onNavigate?: AppOnNavigate;
  currentPage: string;
  onToggle?: () => void;
}

type Page =
  | "schedule"
  | "class-management"
  | "user-list"
  | "pending-approvals"
  | "profile-settings"
  | "user-management";

const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onNavigate,
  currentPage,
  onToggle,
}) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const { pendingApprovalsCount } = usePendingApprovals();
  const [openKeys, setOpenKeys] = React.useState<string[]>([]);

  // Initialize open keys based on current page
  React.useEffect(() => {
    const initialOpenKeys: string[] = [];
    if (
      currentPage === "user-list" ||
      currentPage === "pending-approvals" ||
      currentPage === "user-management"
    ) {
      initialOpenKeys.push("user-management-submenu");
    }
    setOpenKeys(initialOpenKeys);
  }, [currentPage]);

  const handleMenuClick = ({ key }: { key: string }) => {
    onNavigate?.(key as Page);
  };

  const handleOpenChange = (keys: string[]) => {
    if (!collapsed) {
      setOpenKeys(keys);
    }
  };

  // Determine selected keys based on current page
  const getSelectedKeys = () => {
    const keys: string[] = [];

    if (currentPage === "schedule") {
      keys.push("schedule");
    } else if (currentPage === "class-management") {
      keys.push("class-management");
    } else if (
      currentPage === "user-list" ||
      currentPage === "pending-approvals" ||
      currentPage === "user-management"
    ) {
      keys.push(currentPage);
    } else if (currentPage === "profile-settings") {
      keys.push("profile-settings");
    }

    return keys;
  };

  const items: MenuProps["items"] = [
    {
      key: "schedule",
      icon: <CalendarOutlined />,
      label: t("navigation.schedule"),
    },
    {
      key: "class-management",
      icon: <BookOutlined />,
      label: t("navigation.classManagement"),
      style: isAdmin() ? {} : { display: "none" },
    },
    isAdmin()
      ? {
          key: "user-management-submenu",
          icon: <TeamOutlined />,
          label: t("navigation.userManagement"),
          children: [
            {
              key: "user-list",
              icon: <UserOutlined />,
              label: t("navigation.userList"),
            },
            {
              key: "pending-approvals",
              icon:
                pendingApprovalsCount > 0 ? (
                  <Badge count={pendingApprovalsCount} size="small" />
                ) : (
                  <CheckCircleOutlined />
                ),
              label: (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                  }}>
                  <span>{t("navigation.pendingApprovals")}</span>
                </div>
              ),
            },
          ],
        }
      : null,
    {
      key: "profile-settings",
      icon: <SettingOutlined />,
      label: t("navigation.profileSettings"),
    },
  ].filter(Boolean);

  return (
    <Sider
      className="app-sidebar"
      collapsible
      collapsed={collapsed}
      width={250}
      collapsedWidth={80}
      reverseArrow
      trigger={
        <div className="sidebar-trigger" onClick={onToggle}>
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      }>
      <Menu
        className="sidebar-menu"
        mode="inline"
        selectedKeys={getSelectedKeys()}
        openKeys={collapsed ? [] : openKeys}
        items={items}
        onClick={handleMenuClick}
        onOpenChange={handleOpenChange}
      />
    </Sider>
  );
};

export default Sidebar;
