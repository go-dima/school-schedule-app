import React from "react";
import { Card, Typography, Button, Alert, Space } from "antd";
import {
  ClockCircleOutlined,
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import "./AuthPages.css";

const { Title, Text, Paragraph } = Typography;

const PendingApprovalPage: React.FC = () => {
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
              <Title level={2}>ממתין לאישור מנהל</Title>
            </Space>
          </div>

          <Alert
            message="חשבונך נוצר בהצלחה"
            description={
              <div style={{ textAlign: "right" }}>
                <Paragraph>
                  שלום {user?.email ? `${user.email}` : "משתמש חדש"}!
                </Paragraph>
                <Paragraph>
                  חשבונך נוצר בהצלחה במערכת השעות. כדי להתחיל להשתמש במערכת, יש
                  צורך באישור מנהל.
                </Paragraph>
                <Paragraph strong>
                  המנהל יאשר את הבקשה שלך בהקדם האפשרי.
                </Paragraph>
                <Paragraph type="secondary">
                  לאחר האישור, תוכל להיכנס למערכת ולהתחיל לנהל את לוח השעות שלך.
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
              אם יש לך שאלות, ניתן לפנות למנהל המערכת
            </Text>

            <Button
              type="primary"
              icon={<LogoutOutlined />}
              onClick={handleSignOut}
              size="large"
              style={{ marginTop: 16 }}>
              התנתק מהמערכת
            </Button>
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default PendingApprovalPage;
