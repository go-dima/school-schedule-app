import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Typography,
  List,
  Space,
  message,
  Spin,
  Empty,
  Tag,
  Divider,
} from "antd";
import { CopyOutlined, PlusOutlined } from "@ant-design/icons";
import { useChildren } from "../hooks/useChildren";
import type { Child, ChildShareToken } from "../types";

const { Title, Text, Paragraph } = Typography;

interface ChildShareModalProps {
  child: Child;
  open: boolean;
  onClose: () => void;
}

export function ChildShareModal({
  child,
  open,
  onClose,
}: ChildShareModalProps) {
  const { generateShareToken, getChildShareTokens } = useChildren();
  const [tokens, setTokens] = useState<ChildShareToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);

  useEffect(() => {
    if (open && child) {
      loadTokens();
    }
  }, [open, child]);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const tokenList = await getChildShareTokens(child.id);
      setTokens(tokenList);
    } catch (error) {
      message.error("שגיאה בטעינת אסימוני השיתוף");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    try {
      await generateShareToken(child.id, 168); // 7 days
      message.success("אסימון שיתוף נוצר בהצלחה");
      await loadTokens(); // Refresh the list
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "שגיאה ביצירת אסימון שיתוף"
      );
    } finally {
      setGeneratingToken(false);
    }
  };

  const copyToClipboard = async (token: string) => {
    const shareUrl = `${window.location.origin}/shared-child/${token}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      message.success("קישור נועד ללוח");
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
        message.success("קישור נועד ללוח");
      } catch (fallbackError) {
        message.error("לא ניתן להעתיק לבור");
      }
      document.body.removeChild(textArea);
    }
  };

  const formatExpiryDate = (expiresAt: string) => {
    const date = new Date(expiresAt);
    const now = new Date();
    const diffInHours = Math.ceil(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) {
      return "פג תוקף";
    } else if (diffInHours < 24) {
      return `פג תוקף בעוד ${diffInHours} שעות`;
    } else {
      const diffInDays = Math.ceil(diffInHours / 24);
      return `פג תוקף בעוד ${diffInDays} ימים`;
    }
  };

  return (
    <Modal
      title={`שיתוף ילד: ${child.firstName} ${child.lastName}`}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          סגור
        </Button>,
      ]}
      width={600}>
      <div>
        <Paragraph>
          <Text>
            כאן תוכל ליצור קישורים לשיתוף הילד עם הורים אחרים. כל קישור תקף למשך
            יומיים ויכול להיות משומש פעם אחת בלבד.
          </Text>
        </Paragraph>

        <Divider />

        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleGenerateToken}
            loading={generatingToken}>
            צור קישור שיתוף חדש
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <Spin />
          </div>
        ) : tokens.length === 0 ? (
          <Empty
            description="אין קישורי שיתוף פעילים"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            header={<Title level={5}>קישורי שיתוף פעילים</Title>}
            dataSource={tokens}
            renderItem={token => {
              const shareUrl = `${window.location.origin}/shared-child/${token.token}`;
              const isExpired = new Date(token.expiresAt) < new Date();

              return (
                <List.Item
                  actions={[
                    <Button
                      key="copy"
                      type="link"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(token.token)}
                      disabled={isExpired}>
                      העתק
                    </Button>,
                  ]}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text
                          copyable={{ text: shareUrl }}
                          ellipsis
                          style={{ maxWidth: 300 }}>
                          {shareUrl}
                        </Text>
                        {isExpired && <Tag color="red">פג תוקף</Tag>}
                      </Space>
                    }
                    description={
                      <div>
                        <Text type="secondary">
                          {formatExpiryDate(token.expiresAt)}
                        </Text>
                        <br />
                        <Text type="secondary">
                          נוצר:{" "}
                          {new Date(token.createdAt).toLocaleDateString(
                            "he-IL"
                          )}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </Modal>
  );
}
