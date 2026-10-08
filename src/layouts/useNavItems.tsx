import { Badge } from "antd";
import {
  CalendarOutlined,
  BookOutlined,
  TeamOutlined,
  UserOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePendingApprovals } from "../hooks/usePendingApprovals";
import { ROUTES } from "../routes/paths";
import type { MenuProps } from "antd";

export const USER_MANAGEMENT_SUBMENU_KEY = "user-management-submenu";

// The app's navigation menu, shared by the desktop Sidebar and the mobile
// drawer so both always offer the same pages under the same permissions.
// Item keys are route paths: clicking an item navigates to its key.
// `submenuTitleNavigates`: on desktop, clicking the User Management title
// also opens its list page; the mobile drawer only expands the submenu, so
// a tap on the title (or its arrow) can reach Pending Approvals.
export function useNavItems({
  submenuTitleNavigates = true,
}: { submenuTitleNavigates?: boolean } = {}): MenuProps["items"] {
  const { t } = useTranslation();
  const { roleFlags, permissions } = useAuth();
  const isAdmin = roleFlags.isAdmin;
  const { pendingApprovalsCount } = usePendingApprovals();
  const navigate = useNavigate();

  return [
    {
      key: ROUTES.SCHEDULE,
      icon: <CalendarOutlined />,
      label: t("navigation.schedule"),
    },
    {
      key: ROUTES.CLASS_MANAGEMENT,
      icon: <BookOutlined />,
      label: t("navigation.classManagement"),
      style: permissions.canManageClasses ? {} : { display: "none" },
    },
    {
      key: ROUTES.STUDENTS,
      icon: <UsergroupAddOutlined />,
      label: t("navigation.students"),
      style: permissions.canManageRoster ? {} : { display: "none" },
    },
    isAdmin
      ? {
          key: USER_MANAGEMENT_SUBMENU_KEY,
          icon: <TeamOutlined />,
          label: t("navigation.userManagement"),
          onTitleClick: submenuTitleNavigates
            ? () => navigate(ROUTES.USER_MANAGEMENT_LIST)
            : undefined,
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
}
