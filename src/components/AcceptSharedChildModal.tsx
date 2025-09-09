import { useState } from "react";
import { Modal, Button, Input, Typography, message, Form } from "antd";
import { UserAddOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useChildren } from "../hooks/useChildren";

const { Text } = Typography;

interface AcceptSharedChildModalProps {
  open: boolean;
  onClose: () => void;
}

export function AcceptSharedChildModal({
  open,
  onClose,
}: AcceptSharedChildModalProps) {
  const { t } = useTranslation();
  const { acceptSharedChild } = useChildren();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values: { shareLink: string }) => {
    setLoading(true);
    try {
      // Extract token from share link
      let token = values.shareLink.trim();

      // If it's a full URL, extract the token part
      if (token.includes("/shared-child/")) {
        const parts = token.split("/shared-child/");
        if (parts.length > 1) {
          token = parts[1];
        }
      }

      if (!token) {
        message.error(t("acceptSharedChild.modal.invalidLink"));
        return;
      }

      await acceptSharedChild(token);
      message.success(t("acceptSharedChild.modal.childAddedSuccess"));
      form.resetFields();
      onClose();
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("acceptSharedChild.modal.acceptError")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={t("acceptSharedChild.modal.title")}
      open={open}
      onCancel={handleCancel}
      footer={null}>
      <div style={{ marginBottom: 16 }}>
        <Text>{t("acceptSharedChild.modal.description")}</Text>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label={t("acceptSharedChild.modal.shareLinkLabel")}
          name="shareLink"
          rules={[
            {
              required: true,
              message: t("acceptSharedChild.modal.shareLinkRequired"),
            },
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();

                // Check if it's a valid share link format
                const isFullUrl = value.includes("/shared-child/");
                const isTokenOnly = /^[a-zA-Z0-9_-]+$/.test(value);

                if (isFullUrl || isTokenOnly) {
                  return Promise.resolve();
                }

                return Promise.reject(
                  new Error(t("acceptSharedChild.modal.invalidLink"))
                );
              },
            },
          ]}>
          <Input.TextArea
            placeholder={t("acceptSharedChild.modal.placeholder")}
            rows={3}
            autoSize={{ minRows: 3, maxRows: 5 }}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={handleCancel}>{t("common.buttons.cancel")}</Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<UserAddOutlined />}
              loading={loading}>
              {t("acceptSharedChild.modal.addChildButton")}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
