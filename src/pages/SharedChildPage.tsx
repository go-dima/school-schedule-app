import React, { useState } from "react";
import { Card, Typography, Button, Alert, Space, Result } from "antd";
import { UserAddOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { childrenApi } from "../services/api";
import "./AuthPages.css";

const { Title, Text } = Typography;

interface SharedChildPageProps {
  token: string;
}

const SharedChildPage: React.FC<SharedChildPageProps> = ({ token }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();

  const handleAcceptChild = async () => {
    if (!user) {
      setError("יש להתחבר למערכת כדי לקבל ילד משותף");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await childrenApi.acceptSharedChild(token);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בקבלת הילד המשותף");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <Card className="auth-card">
            <Result
              icon={<UserAddOutlined style={{ color: "#1890ff" }} />}
              title="נדרשת התחברות"
              subTitle="כדי לקבל ילד משותף, יש להתחבר למערכת תחילה."
              extra={
                <Button type="primary" href="/">
                  התחבר למערכת
                </Button>
              }
            />
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <Card className="auth-card">
            <Result
              icon={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
              status="success"
              title="הילד נוסף בהצלחה!"
              subTitle="הילד נוסף לחשבון שלך. תוכל כעת לנהל את מערכת השעות שלו."
              extra={
                <Button type="primary" href="/">
                  חזרה למערכת השעות
                </Button>
              }
            />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Card className="auth-card">
          <div className="auth-header">
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <UserAddOutlined style={{ fontSize: 64, color: "#1890ff" }} />
              <Title level={2}>קבלת ילד משותף</Title>
              <Text type="secondary">
                הורה אחר הזמין אותך לשיתוף ניהול מערכת השעות של הילד
              </Text>
            </Space>
          </div>

          {error && (
            <Alert
              message="שגיאה"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: 16 }}
            />
          )}

          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <Text>
              לחיצה על הכפתור תוסיף את הילד לחשבון שלך ותאפשר לך לנהל את מערכת
              השעות שלו.
            </Text>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <Button href="/" disabled={loading}>
              ביטול
            </Button>
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              loading={loading}
              onClick={handleAcceptChild}
              size="large">
              קבל את הילד
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SharedChildPage;
