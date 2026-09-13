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
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePendingApprovals } from "../hooks/usePendingApprovals";
import { ROUTES } from "../routes/paths";
import type { MenuProps } from "antd";

const { Sider } = Layout;

interface SidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
}

const USER_MANAGEMENT_SUBMENU_KEY = "user-management-submenu";

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { t } = useTranslation();
  const { isAdmin, canManageClasses } = useAuth();
  const { pendingApprovalsCount } = usePendingApprovals();
  const location = useLocation();
  const navigate = useNavigate();
  const [openKeys, setOpenKeys] = React.useState<string[]>([]);

  const isUserManagementPath = location.pathname.startsWith(
    ROUTES.USER_MANAGEMENT
  );

  // Initialize/refresh open keys based on current path
  React.useEffect(() => {
    setOpenKeys(isUserManagementPath ? [USER_MANAGEMENT_SUBMENU_KEY] : []);
  }, [isUserManagementPath]);

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleOpenChange = (keys: string[]) => {
    if (!collapsed) {
      setOpenKeys(keys);
    }
  };

  const items: MenuProps["items"] = [
    {
      key: ROUTES.SCHEDULE,
      icon: <CalendarOutlined />,
      label: t("navigation.schedule"),
    },
    {
      key: ROUTES.CLASS_MANAGEMENT,
      icon: <BookOutlined />,
      label: t("navigation.classManagement"),
      style: canManageClasses() ? {} : { display: "none" },
    },
    {
      key: ROUTES.STUDENTS,
      icon: <UsergroupAddOutlined />,
      label: t("navigation.students"),
      style: canManageClasses() ? {} : { display: "none" },
    },
    isAdmin()
      ? {
          key: USER_MANAGEMENT_SUBMENU_KEY,
          icon: <TeamOutlined />,
          label: t("navigation.userManagement"),
          children: [
            {
              key: ROUTES.USER_MANAGEMENT_LIST,
              icon: <UserOutlined />,
              label: t("navigation.userList"),
            },
            {
              key: ROUTES.USER_MANAGEMENT_PENDING_APPROVALS,
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
      key: ROUTES.PROFILE_SETTINGS,
      icon: <SettingOutlined />,
      label: t("navigation.profileSettings"),
    },
  ].filter(Boolean);

  return (
    <div className="sidebar-container">
      <Sider
        className="app-sidebar"
        collapsible
        collapsed={collapsed}
        width={250}
        collapsedWidth={80}
        reverseArrow
        trigger={null}>
        <Menu
          className="sidebar-menu"
          mode="inline"
          selectedKeys={[location.pathname]}
          openKeys={collapsed ? [] : openKeys}
          items={items}
          onClick={handleMenuClick}
          onOpenChange={handleOpenChange}
        />
      </Sider>

      {/* Sidebar trigger bar at bottom */}
      <div
        className="sidebar-trigger-bar"
        style={{
          width: collapsed ? "80px" : "250px",
        }}
        onClick={onToggle}>
        <div className="sidebar-trigger-content">
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          {!collapsed && (
            <span className="sidebar-trigger-text">
              {t("navigation.collapseSidebar")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
