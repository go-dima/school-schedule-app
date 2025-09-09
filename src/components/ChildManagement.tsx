import { useState } from "react";
import {
  Card,
  Button,
  List,
  Modal,
  Space,
  Typography,
  message,
  Popconfirm,
  Spin,
  Empty,
  Tag,
} from "antd";
import { useTranslation } from "react-i18next";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ShareAltOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { ChildForm } from "./ChildForm";
import { ChildShareModal } from "./ChildShareModal";
import { AcceptSharedChildModal } from "./AcceptSharedChildModal";
import { useChildren } from "../hooks/useChildren";
import type { Child } from "../types";
import { GetGradeName } from "@/utils/grades";

const { Title, Text } = Typography;

export function ChildManagement() {
  const { t } = useTranslation();
  const { children, loading, error, createChild, updateChild, removeChild } =
    useChildren();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | undefined>();
  const [sharingChild, setSharingChild] = useState<Child | undefined>();
  const [formLoading, setFormLoading] = useState(false);

  const handleCreateChild = async (data: {
    firstName: string;
    lastName: string;
    grade: number;
    groupNumber: number;
  }) => {
    setFormLoading(true);
    try {
      await createChild(
        data.firstName,
        data.lastName,
        data.grade,
        data.groupNumber
      );
      setIsFormModalOpen(false);
      setEditingChild(undefined);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateChild = async (data: {
    firstName: string;
    lastName: string;
    grade: number;
    groupNumber: number;
  }) => {
    if (!editingChild) return;

    setFormLoading(true);
    try {
      await updateChild(editingChild.id, data);
      setIsFormModalOpen(false);
      setEditingChild(undefined);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    try {
      await removeChild(childId);
      message.success(t("child.management.removeSuccess"));
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("child.management.removeError")
      );
    }
  };

  const openEditModal = (child: Child) => {
    setEditingChild(child);
    setIsFormModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingChild(undefined);
    setIsFormModalOpen(true);
  };

  const openShareModal = (child: Child) => {
    setSharingChild(child);
    setIsShareModalOpen(true);
  };

  const closeModals = () => {
    setIsFormModalOpen(false);
    setIsShareModalOpen(false);
    setIsAcceptModalOpen(false);
    setEditingChild(undefined);
    setSharingChild(undefined);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
        <Title level={4} style={{ margin: 0 }}>
          {t("child.management.title")}
        </Title>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}>
            {t("child.management.addButton")}
          </Button>
          <Button
            icon={<UserAddOutlined />}
            onClick={() => setIsAcceptModalOpen(true)}>
            {t("child.management.acceptSharedButton")}
          </Button>
        </Space>
      </div>

      {error && (
        <div style={{ marginBottom: 16, color: "red" }}>
          <Text type="danger">{error}</Text>
        </div>
      )}

      {children.length === 0 ? (
        <Card>
          <Empty
            description={t("child.management.noChildren")}
            image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}>
              {t("child.management.addFirstChild")}
            </Button>
          </Empty>
        </Card>
      ) : (
        <List
          grid={{ gutter: 16, column: 1 }}
          dataSource={children}
          renderItem={child => (
            <List.Item>
              <Card
                actions={[
                  <Button
                    key="edit"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => openEditModal(child)}>
                    {t("child.management.editButton")}
                  </Button>,
                  <Button
                    key="share"
                    type="text"
                    icon={<ShareAltOutlined />}
                    onClick={() => openShareModal(child)}>
                    {t("child.management.shareButton")}
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title={t("child.management.deleteConfirmTitle")}
                    description={t("child.management.deleteConfirmDescription")}
                    onConfirm={() => handleDeleteChild(child.id)}
                    okText={t("child.management.confirmDelete")}
                    cancelText={t("common.buttons.cancel")}>
                    <Button type="text" danger icon={<DeleteOutlined />}>
                      {t("child.management.removeButton")}
                    </Button>
                  </Popconfirm>,
                ]}>
                <Card.Meta
                  title={
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}>
                      <span>
                        {child.firstName} {child.lastName}
                      </span>
                      <Space>
                        <Tag color="green">
                          {GetGradeName(child.grade)} {child.groupNumber}
                        </Tag>
                      </Space>
                    </div>
                  }
                  description={
                    <div>
                      <Text type="secondary">
                        {t("child.management.createdDate", {
                          date: new Date(child.createdAt).toLocaleDateString(
                            "he-IL"
                          ),
                        })}
                      </Text>
                    </div>
                  }
                />
              </Card>
            </List.Item>
          )}
        />
      )}

      <Modal
        title={
          editingChild
            ? t("child.management.editModalTitle")
            : t("child.management.addModalTitle")
        }
        open={isFormModalOpen}
        onCancel={closeModals}
        footer={null}
        destroyOnHidden>
        <ChildForm
          child={editingChild}
          onSubmit={editingChild ? handleUpdateChild : handleCreateChild}
          onCancel={closeModals}
          loading={formLoading}
        />
      </Modal>

      {sharingChild && (
        <ChildShareModal
          child={sharingChild}
          open={isShareModalOpen}
          onClose={closeModals}
        />
      )}

      <AcceptSharedChildModal open={isAcceptModalOpen} onClose={closeModals} />
    </div>
  );
}
