import React from "react";
import { Layout, Typography } from "antd";
import {
  CalendarOutlined,
  BookOutlined,
  TeamOutlined,
  UserOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import ProfileDropdown from "../components/ProfileDropdown";
import type { AppOnNavigate } from "../types";

const { Header: AntHeader } = Layout;
const { Title } = Typography;

interface HeaderProps {
  onNavigate?: AppOnNavigate;
  currentPage: string;
}

const Header: React.FC<HeaderProps> = ({ onNavigate, currentPage }) => {
  const { t } = useTranslation();

  const getPageInfo = (page: string) => {
    switch (page) {
      case "schedule":
        return {
          title: t("navigation.schedule"),
          icon: <CalendarOutlined />,
          breadcrumb: [
            { title: t("navigation.schedule"), icon: <CalendarOutlined /> },
          ],
        };
      case "class-management":
        return {
          title: t("navigation.classManagement"),
          icon: <BookOutlined />,
          breadcrumb: [
            { title: t("navigation.classManagement"), icon: <BookOutlined /> },
          ],
        };
      case "user-management":
        return {
          title: t("navigation.userManagement"),
          icon: <TeamOutlined />,
          breadcrumb: [
            { title: t("navigation.userManagement"), icon: <TeamOutlined /> },
          ],
        };
      case "user-list":
        return {
          title: t("navigation.userList"),
          icon: <UserOutlined />,
          breadcrumb: [
            { title: t("navigation.userManagement"), icon: <TeamOutlined /> },
            { title: t("navigation.userList"), icon: <UserOutlined /> },
          ],
        };
      case "pending-approvals":
        return {
          title: t("navigation.pendingApprovals"),
          icon: <CheckCircleOutlined />,
          breadcrumb: [
            { title: t("navigation.userManagement"), icon: <TeamOutlined /> },
            {
              title: t("navigation.pendingApprovals"),
              icon: <CheckCircleOutlined />,
            },
          ],
        };
      case "profile-settings":
        return {
          title: t("navigation.profileSettings"),
          icon: <SettingOutlined />,
          breadcrumb: [
            {
              title: t("navigation.profileSettings"),
              icon: <SettingOutlined />,
            },
          ],
        };
      default:
        return {
          title: t("app.title"),
          icon: <HomeOutlined />,
          breadcrumb: [{ title: t("app.title"), icon: <HomeOutlined /> }],
        };
    }
  };

  const pageInfo = getPageInfo(currentPage);

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
          {/* <Breadcrumb className="page-breadcrumb" items={pageInfo.breadcrumb} /> */}
        </div>
      </div>

      <div className="app-header-right">
        <ProfileDropdown onNavigate={onNavigate} />
      </div>
    </AntHeader>
  );
};

export default Header;
