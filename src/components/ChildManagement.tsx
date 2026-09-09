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
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { ChildForm } from "./ChildForm";
import { GroupTrackTags } from "./GroupTrackTags";
import { useChildren } from "../hooks/useChildren";
import { TrackSelectionService } from "../services/trackSelectionService";
import { childrenApi } from "../services/api";
import type { Child, Scope } from "../types";
import { GetGradeName } from "@/utils/grades";

const { Title, Text } = Typography;

export function ChildManagement() {
  const { t } = useTranslation();
  const { children, loading, error, createChild, updateChild, removeChild } =
    useChildren();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | undefined>();
  const [editingChildCommittedTrack, setEditingChildCommittedTrack] = useState<
    number | null
  >(null);
  const [formLoading, setFormLoading] = useState(false);

  const handleCreateChild = async (data: {
    firstName: string;
    lastName: string;
    grade: number;
    groupNumber: number | null;
    trackNumber?: number | null;
    scope?: Scope;
  }) => {
    setFormLoading(true);
    try {
      const newChild = await createChild(
        data.firstName,
        data.lastName,
        data.grade,
        data.groupNumber,
        data.trackNumber ?? null
      );
      if (data.trackNumber) {
        await TrackSelectionService.syncTrackClasses(
          newChild,
          data.trackNumber,
          "draft"
        );
      }
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
    groupNumber: number | null;
    trackNumber?: number | null;
    scope?: Scope;
  }) => {
    if (!editingChild) return;

    setFormLoading(true);
    try {
      const updatedChild = await updateChild(editingChild.id, data);
      // trackNumber is undefined when the form's Track field was read-only
      // (showing the committed value) -- this form never touched draft
      // track in that case, so there's nothing to sync.
      if (data.trackNumber !== undefined) {
        const newTrackNumber = data.trackNumber ?? null;
        if (editingChild.trackNumber !== newTrackNumber) {
          await TrackSelectionService.syncTrackClasses(
            updatedChild,
            newTrackNumber,
            "draft"
          );
        }
      }
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

  const openEditModal = async (child: Child) => {
    setEditingChild(child);
    setEditingChildCommittedTrack(null);
    setIsFormModalOpen(true);
    try {
      const committedChild = await childrenApi.getChildById(
        child.id,
        "committed"
      );
      setEditingChildCommittedTrack(committedChild.trackNumber);
    } catch {
      // Read-only display only -- if this fails, the field just shows
      // empty rather than blocking the rest of the edit form.
      setEditingChildCommittedTrack(null);
    }
  };

  const openCreateModal = () => {
    setEditingChild(undefined);
    setIsFormModalOpen(true);
  };

  const closeModals = () => {
    setIsFormModalOpen(false);
    setEditingChild(undefined);
    setEditingChildCommittedTrack(null);
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
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}>
          {t("child.management.addButton")}
        </Button>
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
                        <Tag color="blue">{GetGradeName(child.grade)}</Tag>
                        <GroupTrackTags
                          groupNumber={child.groupNumber}
                          trackNumber={child.trackNumber}
                        />
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
          committedTrackNumber={editingChildCommittedTrack}
          trackNumberReadOnly={!!editingChild}
          onSubmit={editingChild ? handleUpdateChild : handleCreateChild}
          onCancel={closeModals}
          loading={formLoading}
        />
      </Modal>
    </div>
  );
}
