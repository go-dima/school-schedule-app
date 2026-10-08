import React from "react";
import { Layout, Menu } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "../routes/paths";
import { USER_MANAGEMENT_SUBMENU_KEY, useNavItems } from "./useNavItems";

const { Sider } = Layout;

interface SidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { t } = useTranslation();
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

  const items = useNavItems();

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
