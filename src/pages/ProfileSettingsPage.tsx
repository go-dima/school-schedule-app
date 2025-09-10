import React, { useState, useEffect } from "react";
import { Card, Form, Input, Button, Alert, Space, Tabs } from "antd";
import { UserOutlined, SaveOutlined, UserAddOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { usersApi } from "../services/api";
import { ChildManagement } from "../components/ChildManagement";

interface ProfileFormValues {
  firstName: string;
  lastName: string;
}

const ProfileSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [success, setSuccess] = useState(false);
  const { user, hasRole, refreshProfile } = useAuth();

  // Set initial form values when component mounts
  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      });
    }
  }, [user, form]);

  const handleSubmit = async (values: ProfileFormValues) => {
    if (!user) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await usersApi.updateUserProfile(user.id, {
        firstName: values.firstName,
        lastName: values.lastName,
      });

      await refreshProfile();
      setSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("profile.page.updateError")
      );
    } finally {
      setLoading(false);
    }
  };

  const isParent = hasRole("parent");

  const tabItems = [
    {
      key: "profile",
      label: (
        <Space>
          <UserOutlined />
          {t("profile.page.personalInfoTab")}
        </Space>
      ),
      children: (
        <Card className="page-content">
          {success && (
            <Alert
              message={t("profile.page.updateSuccess")}
              type="success"
              showIcon
              closable
              onClose={() => setSuccess(false)}
              style={{ marginBottom: 16 }}
            />
          )}

          {error && (
            <Alert
              message={t("profile.page.updateError")}
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form
            form={form}
            name="profile-settings"
            onFinish={handleSubmit}
            layout="vertical"
            requiredMark={false}>
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
                {
                  required: true,
                  message: t("profile.page.lastNameRequired"),
                },
                { min: 2, message: t("profile.page.lastNameMinLength") },
              ]}>
              <Input
                prefix={<UserOutlined />}
                placeholder={t("profile.page.lastNamePlaceholder")}
                size="large"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}>
                {t("common.buttons.save")}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
  ];

  // Add children management tab for parents
  if (isParent) {
    tabItems.push({
      key: "children",
      label: (
        <Space>
          <UserAddOutlined />
          {t("profile.page.childrenTab")}
        </Space>
      ),
      children: (
        <Card className="page-content">
          <ChildManagement />
        </Card>
      ),
    });
  }

  return (
    <div className="page-content">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />
    </div>
  );
};

export default ProfileSettingsPage;
