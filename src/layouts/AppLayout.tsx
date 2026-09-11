// src/layouts/AppLayout.tsx
import React, { useState } from "react";
import { Layout } from "antd";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import "./layouts.css";

const { Content } = Layout;

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(true);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <Layout className="app-layout">
      <Header />
      <Layout>
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
        <Content className="app-layout-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
