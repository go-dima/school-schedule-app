import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Button, Alert, Space, Tabs } from "antd";
import { UserOutlined, SaveOutlined, UserAddOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { usersApi } from "../services/api";
import { ChildManagement } from "./ChildManagement";

interface ProfileEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProfileFormValues {
  firstName: string;
  lastName: string;
}

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const { user, hasRole } = useAuth();

  // Set initial form values when modal opens
  useEffect(() => {
    if (visible && user) {
      form.setFieldsValue({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      });
    }
  }, [visible, user, form]);

  const handleSubmit = async (values: ProfileFormValues) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      await usersApi.updateUserProfile(user.id, {
        firstName: values.firstName,
        lastName: values.lastName,
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("profile.modal.updateError")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setError(null);
    setActiveTab("profile");
    onClose();
  };

  const isParent = hasRole("parent");

  const tabItems = [
    {
      key: "profile",
      label: (
        <Space>
          <UserOutlined />
          {t("profile.modal.personalInfoTab")}
        </Space>
      ),
      children: (
        <div>
          {error && (
            <Alert
              message={t("profile.modal.updateError")}
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
            name="profile-edit"
            onFinish={handleSubmit}
            layout="vertical"
            requiredMark={false}>
            <Form.Item
              name="firstName"
              label={t("profile.modal.firstNameLabel")}
              rules={[
                {
                  required: true,
                  message: t("profile.modal.firstNameRequired"),
                },
                { min: 2, message: t("profile.modal.firstNameMinLength") },
              ]}>
              <Input
                prefix={<UserOutlined />}
                placeholder={t("profile.modal.firstNamePlaceholder")}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="lastName"
              label={t("profile.modal.lastNameLabel")}
              rules={[
                {
                  required: true,
                  message: t("profile.modal.lastNameRequired"),
                },
                { min: 2, message: t("profile.modal.lastNameMinLength") },
              ]}>
              <Input
                prefix={<UserOutlined />}
                placeholder={t("profile.modal.lastNamePlaceholder")}
                size="large"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: "left" }}>
              <Space>
                <Button onClick={handleCancel} disabled={loading}>
                  {t("common.buttons.cancel")}
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  icon={<SaveOutlined />}>
                  {t("common.buttons.save")}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      ),
    },
  ];

  // TODO: Remove post migration - Only show child management tab for parents
  if (isParent) {
    tabItems.push({
      key: "children",
      label: (
        <Space>
          <UserAddOutlined />
          {t("profile.modal.childrenTab")}
        </Space>
      ),
      children: <ChildManagement />,
    });
  }

  return (
    <Modal
      title={t("profile.modal.title")}
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={800}
      destroyOnHidden>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />
    </Modal>
  );
};

export default ProfileEditModal;
