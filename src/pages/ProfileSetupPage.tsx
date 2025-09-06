import React, { useState } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Alert,
  Space,
  Select,
} from "antd";
import {
  UserOutlined,
  SaveOutlined,
  TeamOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { usersApi } from "../services/api";
import type { UserRole } from "../types";
import "./AuthPages.css";

const { Title, Text } = Typography;

interface ProfileFormValues {
  firstName: string;
  lastName: string;
  role: UserRole;
}

const ProfileSetupPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, refreshProfile } = useAuth();

  const onFinish = async (values: ProfileFormValues) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      await usersApi.updateUserProfile(user.id, {
        firstName: values.firstName,
        lastName: values.lastName,
      });

      // Request the selected role for approval
      await usersApi.requestRole(user.id, values.role);

      // Refresh user profile to trigger flow to pending approval page
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בעדכון הפרופיל");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Card className="auth-card">
          <div className="auth-header">
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <UserOutlined style={{ fontSize: 64, color: "#1890ff" }} />
              <Title level={2}>השלמת פרטים אישיים</Title>
              <Text type="secondary">
                אנא הזן את הפרטים האישיים שלך ובחר את התפקיד המתאים
              </Text>
            </Space>
          </div>

          {error && (
            <Alert
              message="שגיאה בעדכון הפרופיל"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              className="auth-alert"
            />
          )}

          <Form
            form={form}
            name="profile-setup"
            onFinish={onFinish}
            layout="vertical"
            requiredMark={false}
            className="auth-form">
            <Form.Item
              name="firstName"
              label="שם פרטי"
              rules={[
                { required: true, message: "נא להזין שם פרטי" },
                { min: 2, message: "שם פרטי חייב להכיל לפחות 2 תווים" },
              ]}>
              <Input
                prefix={<UserOutlined />}
                placeholder="הזן את השם הפרטי שלך"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="lastName"
              label="שם משפחה"
              rules={[
                { required: true, message: "נא להזין שם משפחה" },
                { min: 2, message: "שם משפחה חייב להכיל לפחות 2 תווים" },
              ]}>
              <Input
                prefix={<UserOutlined />}
                placeholder="הזן את שם המשפחה שלך"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="role"
              label="תפקיד במערכת"
              rules={[{ required: true, message: "נא לבחור תפקיד" }]}>
              <Select
                size="large"
                placeholder="בחר את התפקיד שלך"
                options={[
                  {
                    value: "parent",
                    label: (
                      <Space>
                        <HomeOutlined />
                        הורה
                      </Space>
                    ),
                  },
                  {
                    value: "staff",
                    label: (
                      <Space>
                        <TeamOutlined />
                        צוות
                      </Space>
                    ),
                  },
                ]}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                icon={<SaveOutlined />}
                block
                className="auth-submit-btn">
                שמור פרטים והמשך
              </Button>
            </Form.Item>
          </Form>

          <div className="auth-footer">
            <Text type="secondary">
              פרטים אלו יעזרו לנו לזהות אותך במערכת. התפקיד שתבחר יישלח לאישור
              מנהל.
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ProfileSetupPage;
