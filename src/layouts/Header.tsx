// src/layouts/Header.tsx
import React from "react";
import { Layout, Typography } from "antd";
import {
  CalendarOutlined,
  BookOutlined,
  UserOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import ProfileDropdown from "../components/ProfileDropdown";
import { ROUTES } from "../routes/paths";

const { Header: AntHeader } = Layout;
const { Title } = Typography;

const Header: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const getPageInfo = (pathname: string) => {
    switch (pathname) {
      case ROUTES.SCHEDULE:
        return { title: t("navigation.schedule"), icon: <CalendarOutlined /> };
      case ROUTES.CLASS_MANAGEMENT:
        return {
          title: t("navigation.classManagement"),
          icon: <BookOutlined />,
        };
      case ROUTES.USER_MANAGEMENT_LIST:
        return { title: t("navigation.userList"), icon: <UserOutlined /> };
      case ROUTES.USER_MANAGEMENT_PENDING_APPROVALS:
        return {
          title: t("navigation.pendingApprovals"),
          icon: <CheckCircleOutlined />,
        };
      case ROUTES.PROFILE_SETTINGS:
        return {
          title: t("navigation.profileSettings"),
          icon: <SettingOutlined />,
        };
      default:
        return { title: t("app.title"), icon: <HomeOutlined /> };
    }
  };

  const pageInfo = getPageInfo(location.pathname);

  return (
    <AntHeader className="app-header">
      <div className="app-header-left">
        <div className="app-header-logo">
          <Title level={4} className="app-logo-text">
            {t("app.title")}
          </Title>
        </div>
        <div className="app-header-divider" />
        <div className="app-header-page-info">
          <div className="page-title-section">
            {pageInfo.icon}
            <Title level={3} className="page-title">
              {pageInfo.title}
            </Title>
          </div>
        </div>
      </div>

      <div className="app-header-right">
        <ProfileDropdown />
      </div>
    </AntHeader>
  );
};

export default Header;
