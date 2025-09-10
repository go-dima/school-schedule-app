import React from "react";
import { Alert } from "antd";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import UserManagementPage from "./UserManagementPage";

const UserListPage: React.FC = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();

  if (!isAdmin()) {
    return (
      <div className="page-content">
        <Alert
          message={t("userList.page.noPermissionTitle")}
          description={t("userList.page.adminOnlyAccess")}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* For now, render the existing UserManagementPage content */}
      {/* This will be the content from UserManagementPage without the layout wrapper */}
      <UserManagementPage />
    </div>
  );
};

export default UserListPage;
