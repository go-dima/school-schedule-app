import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  Typography,
  Table,
  Button,
  Space,
  Alert,
  Spin,
  Tag,
  message,
  Popconfirm,
  Badge,
  Select,
  Modal,
  Form,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
  UserOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  HomeOutlined,
  CrownOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useAuth } from "../contexts/AuthContext";
import { usersApi } from "../services/api";
import type { PendingApproval, UserRole } from "../types";
import { ROLE_TAG_COLORS } from "../constants/roleColors";
import "./PendingApprovalsPage.css";

const { Title, Text } = Typography;

interface PendingApprovalsPageProps {}

const PendingApprovalsPage: React.FC<PendingApprovalsPageProps> = () => {
  const { t } = useTranslation();
  const { permissions } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  // True only until the first load resolves. Gates the full-page spinner;
  // subsequent reloads (refresh button, after approve/reject) use `loading`
  // to show a local Table overlay and lock the header instead of unmounting
  // the whole page.
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedApproval, setSelectedApproval] =
    useState<PendingApproval | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await usersApi.getPendingApprovalsWithUsers();
      setPendingApprovals(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load pending approvals"
      );
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const handleApproveWithRole = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    form.setFieldsValue({ role: approval.role }); // Set default role
    setRoleModalVisible(true);
  };

  const handleConfirmApproval = async (values: { role: UserRole }) => {
    if (!selectedApproval) return;

    setActionLoading(selectedApproval.id);
    try {
      await usersApi.approveUserWithRole(selectedApproval.userId, values.role);
      message.success(
        t("pendingApprovals.page.approveSuccess", {
          email: selectedApproval.user.email,
          role: t(`roles.${values.role}`, values.role),
        })
      );
      await loadData();
      setRoleModalVisible(false);
      setSelectedApproval(null);
      form.resetFields();
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("pendingApprovals.page.approveError")
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (
    approvalId: string,
    userEmail: string,
    role: UserRole
  ) => {
    setActionLoading(approvalId);
    try {
      await usersApi.rejectRole(approvalId);
      message.success(
        t("pendingApprovals.page.rejectSuccess", {
          role: t(`roles.${role}`, role),
          email: userEmail,
        })
      );
      await loadData();
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("pendingApprovals.page.rejectError")
      );
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleOptions = () => [
    {
      value: "parent" as UserRole,
      label: (
        <Space>
          <HomeOutlined />
          {t("pendingApprovals.page.roleOptions.parent")}
        </Space>
      ),
    },
    {
      value: "staff" as UserRole,
      label: (
        <Space>
          <TeamOutlined />
          {t("pendingApprovals.page.roleOptions.staff")}
        </Space>
      ),
    },
    {
      value: "child" as UserRole,
      label: (
        <Space>
          <UserOutlined />
          {t("pendingApprovals.page.roleOptions.child")}
        </Space>
      ),
    },
    {
      value: "admin" as UserRole,
      label: (
        <Space>
          <CrownOutlined />
          {t("pendingApprovals.page.roleOptions.admin")}
        </Space>
      ),
    },
    {
      value: "moderator" as UserRole,
      label: (
        <Space>
          <CrownOutlined />
          {t("roles.moderator")}
        </Space>
      ),
    },
  ];

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("he-IL", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const columns: ColumnsType<PendingApproval> = [
    {
      title: t("pendingApprovals.table.fullNameColumn"),
      key: "fullName",
      width: 200,
      render: (_, record) => {
        const firstName = record.user.firstName || "";
        const lastName = record.user.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim();

        return (
          <Space>
            <UserOutlined />
            <div>
              {fullName ? (
                <Text strong>{fullName}</Text>
              ) : (
                <Text type="secondary">
                  {t("pendingApprovals.table.noName")}
                </Text>
              )}
            </div>
          </Space>
        );
      },
    },
    {
      title: t("pendingApprovals.table.emailColumn"),
      dataIndex: ["user", "email"],
      key: "email",
      width: 220,
      render: (email: string) => <Text>{email}</Text>,
    },
    {
      title: t("pendingApprovals.table.roleColumn"),
      dataIndex: "role",
      key: "role",
      width: 120,
      render: (role: UserRole) => (
        <Tag color={ROLE_TAG_COLORS[role]}>{t(`roles.${role}`, role)}</Tag>
      ),
    },
    {
      title: t("pendingApprovals.table.createdAtColumn"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (date: string) => (
        <Space>
          <ClockCircleOutlined />
          <Text>{formatDate(date)}</Text>
        </Space>
      ),
    },
    {
      title: t("pendingApprovals.table.actionsColumn"),
      key: "actions",
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            loading={actionLoading === record.id}
            size="small"
            onClick={() => handleApproveWithRole(record)}>
            {t("pendingApprovals.table.approveButton")}
          </Button>
          <Popconfirm
            title={t("pendingApprovals.table.rejectConfirmTitle")}
            description={t("pendingApprovals.table.rejectConfirmDescription", {
              email: record.user.email,
            })}
            onConfirm={() =>
              handleReject(record.id, record.user.email, record.role)
            }
            okText={t("pendingApprovals.table.rejectButton")}
            cancelText={t("common.buttons.cancel")}
            placement="topRight">
            <Button
              danger
              icon={<CloseOutlined />}
              loading={actionLoading === record.id}
              size="small">
              {t("pendingApprovals.table.rejectButton")}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!permissions.canApproveSignups) {
    return (
      <div className="page-content">
        <Alert
          message={t("pendingApprovals.page.noPermissionMessage")}
          description={t("pendingApprovals.page.noPermissionDescription")}
          type="error"
          showIcon
        />
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="page-content">
        <div className="page-loading">
          <Spin size="large" />
          <Title level={4} style={{ marginTop: 16, color: "#1890ff" }}>
            {t("pendingApprovals.page.loadingTitle")}
          </Title>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="pending-approvals-header">
        <div
          className={`pending-approvals-controls${
            loading ? " pending-approvals-controls--disabled" : ""
          }`}
          aria-disabled={loading}>
          <div className="header-main">
            <Title level={2}>
              <Space>
                {t("pendingApprovals.page.title")}
                {pendingApprovals.length > 0 && (
                  <Badge count={pendingApprovals.length} color="#ff4d4f" />
                )}
              </Space>
            </Title>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadData}
                loading={loading}
                disabled={loading}>
                {t("common.buttons.refresh")}
              </Button>
            </Space>
          </div>
        </div>

        <Alert
          message={t("pendingApprovals.page.alertMessage")}
          description={
            <div>
              {t("pendingApprovals.page.alertDescription")}
              {lastRefresh && (
                <div style={{ marginTop: 8, fontSize: "12px", opacity: 0.8 }}>
                  <ClockCircleOutlined />{" "}
                  {t("pendingApprovals.page.lastRefreshLabel")}
                  {lastRefresh.toLocaleTimeString("he-IL")}
                </div>
              )}
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      </div>

      {error && (
        <Alert
          message={t("pendingApprovals.page.loadErrorAlertMessage")}
          description={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 24 }}
        />
      )}

      <Card className="pending-approvals-table-card">
        {pendingApprovals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <UserOutlined
              style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }}
            />
            <Title level={4} style={{ color: "#999" }}>
              {t("pendingApprovals.page.emptyTitle")}
            </Title>
            <Text type="secondary">
              {t("pendingApprovals.page.emptyDescription")}
            </Text>
          </div>
        ) : (
          <Table<PendingApproval>
            columns={columns}
            dataSource={pendingApprovals}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                t("pendingApprovals.table.pagination", {
                  start: range[0],
                  end: range[1],
                  total,
                }),
            }}
            scroll={{ x: 800 }}
            size="small"
          />
        )}
      </Card>

      {/* Role Assignment Modal */}
      <Modal
        title={
          <Space>
            <UserOutlined />
            {t("pendingApprovals.modal.title")}
          </Space>
        }
        open={roleModalVisible}
        onCancel={() => {
          setRoleModalVisible(false);
          setSelectedApproval(null);
          form.resetFields();
        }}
        footer={null}
        width={500}>
        {selectedApproval && (
          <>
            <Alert
              message={t("pendingApprovals.modal.userAlertMessage", {
                email: selectedApproval.user.email,
              })}
              description={
                <div>
                  <p>
                    <strong>{t("pendingApprovals.modal.nameLabel")}</strong>{" "}
                    {`${selectedApproval.user.firstName || ""} ${
                      selectedApproval.user.lastName || ""
                    }`.trim() || t("pendingApprovals.modal.noNameFallback")}
                  </p>
                  <p>
                    <strong>
                      {t("pendingApprovals.modal.originalRoleLabel")}
                    </strong>{" "}
                    {t(`roles.${selectedApproval.role}`, selectedApproval.role)}
                  </p>
                  <p>{t("pendingApprovals.modal.chooseFinalRolePrompt")}</p>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Form
              form={form}
              onFinish={handleConfirmApproval}
              layout="vertical">
              <Form.Item
                name="role"
                label={t("pendingApprovals.modal.roleFieldLabel")}
                rules={[
                  {
                    required: true,
                    message: t("pendingApprovals.modal.roleRequired"),
                  },
                ]}>
                <Select
                  size="large"
                  placeholder={t("pendingApprovals.modal.rolePlaceholder")}
                  options={getRoleOptions()}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: "left" }}>
                <Space>
                  <Button
                    onClick={() => {
                      setRoleModalVisible(false);
                      setSelectedApproval(null);
                      form.resetFields();
                    }}
                    disabled={actionLoading === selectedApproval?.id}>
                    {t("common.buttons.cancel")}
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={actionLoading === selectedApproval?.id}
                    icon={<CheckOutlined />}>
                    {t("pendingApprovals.modal.submitButton")}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default PendingApprovalsPage;
