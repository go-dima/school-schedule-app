import React from "react";
import { Layout, Typography } from "antd";
import { useTranslation } from "react-i18next";
import ProfileDropdown from "../components/ProfileDropdown";
import { usePageInfo } from "./usePageInfo";

const { Header: AntHeader } = Layout;
const { Title } = Typography;

const Header: React.FC = () => {
  const { t } = useTranslation();

  const pageInfo = usePageInfo();

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
