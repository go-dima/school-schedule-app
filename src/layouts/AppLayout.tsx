import React, { useState } from "react";
import { Layout } from "antd";
import Header from "./Header";
import Sidebar from "./Sidebar";
import type { AppOnNavigate } from "../types";
import "./layouts.css";

const { Content } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
  onNavigate?: AppOnNavigate;
  currentPage: string;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  onNavigate,
  currentPage,
}) => {
  const [collapsed, setCollapsed] = useState(true);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <Layout className="app-layout">
      <Header onNavigate={onNavigate} currentPage={currentPage} />
      <Layout>
        <Sidebar
          collapsed={collapsed}
          onNavigate={onNavigate}
          currentPage={currentPage}
          onToggle={toggleSidebar}
        />
        <Content className="app-layout-content">{children}</Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
