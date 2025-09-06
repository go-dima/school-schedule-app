import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Button, Alert, Space } from "antd";
import { UserOutlined, SaveOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { usersApi } from "../services/api";

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
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

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
      setError(err instanceof Error ? err.message : "שגיאה בעדכון הפרופיל");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setError(null);
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <UserOutlined />
          עריכת פרופיל משתמש
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={500}
      destroyOnClose>
      {error && (
        <Alert
          message="שגיאה בעדכון הפרופיל"
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

        <Form.Item style={{ marginBottom: 0, textAlign: "left" }}>
          <Space>
            <Button onClick={handleCancel} disabled={loading}>
              ביטול
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<SaveOutlined />}>
              שמור שינויים
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProfileEditModal;
