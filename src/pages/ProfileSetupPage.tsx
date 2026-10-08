import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, Alert, Space } from "antd";
import { UserOutlined, SaveOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { usersApi } from "../services/api";
import "./AuthPages.css";

const { Title, Text } = Typography;

interface ProfileFormValues {
  firstName: string;
  lastName: string;
}

const ProfileSetupPage: React.FC = () => {
  const { t } = useTranslation();
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

      // Refresh user profile to trigger flow to pending approval page
      await refreshProfile();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("profile.page.updateError")
      );
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
              <Title level={2}>{t("profileSetup.title")}</Title>
              <Text type="secondary">{t("profileSetup.subtitle")}</Text>
            </Space>
          </div>

          {error && (
            <Alert
              message={t("profile.page.updateError")}
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
              label={t("profile.page.firstNameLabel")}
              rules={[
                {
                  required: true,
                  message: t("profile.page.firstNameRequired"),
                },
                { min: 2, message: t("profile.page.firstNameMinLength") },
              ]}>
              <Input
                prefix={<UserOutlined />}
                placeholder={t("profile.page.firstNamePlaceholder")}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="lastName"
              label={t("profile.page.lastNameLabel")}
              rules={[
                { required: true, message: t("profile.page.lastNameRequired") },
                { min: 2, message: t("profile.page.lastNameMinLength") },
              ]}>
              <Input
                prefix={<UserOutlined />}
                placeholder={t("profile.page.lastNamePlaceholder")}
                size="large"
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
                {t("profileSetup.submitButton")}
              </Button>
            </Form.Item>
          </Form>

          <div className="auth-footer">
            <Text type="secondary">{t("profileSetup.footerNote")}</Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ProfileSetupPage;
