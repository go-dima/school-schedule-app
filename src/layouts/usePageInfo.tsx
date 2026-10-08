import React from "react";
import {
  CalendarOutlined,
  BookOutlined,
  UserOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  HomeOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { ROUTES } from "../routes/paths";

// Title and icon of the current page, shared by the desktop and mobile headers.
export function usePageInfo(): { title: string; icon: React.ReactNode } {
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
      case ROUTES.STUDENTS:
        return {
          title: t("navigation.students"),
          icon: <UsergroupAddOutlined />,
        };
      case ROUTES.USER_MANAGEMENT_LIST:
        return {
          title: t("navigation.userManagement"),
          icon: <UserOutlined />,
        };
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

  return getPageInfo(location.pathname);
}
