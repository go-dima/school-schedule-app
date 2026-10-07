import React, { useEffect, useState } from "react";
import { Button, Drawer, Layout, Menu, Typography } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import ProfileDropdown from "../components/ProfileDropdown";
import { ROUTES } from "../routes/paths";
import { USER_MANAGEMENT_SUBMENU_KEY, useNavItems } from "./useNavItems";
import { usePageInfo } from "./usePageInfo";
import "./MobileAppLayout.css";

const { Content } = Layout;
const { Title } = Typography;

// The app shell in mobile UI Mode: a compact header with a menu button that
// opens the same navigation as the desktop Sidebar. Pages without a mobile
// version render their desktop component in the content area.
const MobileAppLayout: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const items = useNavItems({ submenuTitleNavigates: false });
  const pageInfo = usePageInfo();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const isUserManagementPath = location.pathname.startsWith(
    ROUTES.USER_MANAGEMENT
  );

  useEffect(() => {
    setOpenKeys(isUserManagementPath ? [USER_MANAGEMENT_SUBMENU_KEY] : []);
  }, [isUserManagementPath]);

  // Close the menu on any navigation, including browser back/forward.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <Layout className="mobile-app-layout">
      {/* RTL: the menu button renders rightmost, the profile leftmost. */}
      <header className="mobile-app-header">
        <Button
          type="text"
          className="mobile-app-menu-button"
          icon={<MenuOutlined />}
          aria-label={t("navigation.openMenu")}
          onClick={() => setMenuOpen(true)}
        />
        <div className="mobile-app-title">
          {pageInfo.icon}
          <Title level={5} className="mobile-app-title-text">
            {pageInfo.title}
          </Title>
        </div>
        <ProfileDropdown />
      </header>

      <Drawer
        className="mobile-app-menu"
        placement="right"
        width={280}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={t("app.title")}>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          openKeys={openKeys}
          onOpenChange={keys => setOpenKeys(keys as string[])}
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      </Drawer>

      <Content className="mobile-app-content">
        <Outlet />
      </Content>
    </Layout>
  );
};

export default MobileAppLayout;
