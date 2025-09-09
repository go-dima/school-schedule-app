import React from "react";
import { Card, Typography, Button, Alert, Space } from "antd";
import {
  ClockCircleOutlined,
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import "./AuthPages.css";

const { Title, Text, Paragraph } = Typography;

const PendingApprovalPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Card className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-header">
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <ClockCircleOutlined style={{ fontSize: 64, color: "#faad14" }} />
              <Title level={2}>{t("auth.pendingApproval.title")}</Title>
            </Space>
          </div>

          <Alert
            message={t("auth.pendingApproval.alertTitle")}
            description={
              <div style={{ textAlign: "right" }}>
                <Paragraph>
                  {t("auth.pendingApproval.greeting", {
                    email:
                      user?.email || t("auth.pendingApproval.defaultGreeting"),
                  })}
                </Paragraph>
                <Paragraph>{t("auth.pendingApproval.description1")}</Paragraph>
                <Paragraph strong>
                  {t("auth.pendingApproval.description2")}
                </Paragraph>
                <Paragraph type="secondary">
                  {t("auth.pendingApproval.description3")}
                </Paragraph>
              </div>
            }
            type="warning"
            showIcon
            icon={<UserOutlined />}
            style={{ marginBottom: 24, textAlign: "right" }}
          />

          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Text type="secondary">
              {t("auth.pendingApproval.contactInfo")}
            </Text>

            <Button
              type="primary"
              icon={<LogoutOutlined />}
              onClick={handleSignOut}
              size="large"
              style={{ marginTop: 16 }}>
              {t("common.buttons.logout")}
            </Button>
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default PendingApprovalPage;
