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
  Divider,
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
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useAuth } from "../contexts/AuthContext";
import { childrenApi, usersApi } from "../services/api";
import type { Child, PendingApproval, Scope, UserRole } from "../types";
import { ChildAccountLinkPicker } from "../components/ChildAccountLinkPicker";
import {
  EMPTY_CHILD_LINK_DRAFT,
  childLinkValue,
  type ChildLinkDraft,
} from "../components/childAccountLink";
import { ROLE_TAG_COLORS } from "../constants/roleColors";
import { trackEvent, AnalyticsEvent } from "../utils/analytics";
import { isTestScopeEnabled } from "../utils/env";
import "./PendingApprovalsPage.css";
import { ScopeSelector } from "../components/ScopeSelector";

const { Title, Text } = Typography;

interface ApprovalFormValues {
  role: UserRole;
  // Only present when the scope field is shown (non-prod); new users are
  // always approved as "prod" otherwise.
  scope?: Scope;
}

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
  const chosenRole = Form.useWatch<UserRole | undefined>("role", form);
  // A child account must be linked to a student record at approval.
  const [childLink, setChildLink] = useState<ChildLinkDraft>(
    EMPTY_CHILD_LINK_DRAFT
  );
  const [unlinkedStudents, setUnlinkedStudents] = useState<Child[]>([]);
  const [unlinkedLoading, setUnlinkedLoading] = useState(false);
  const needsChildLink = chosenRole === "child";
  const childLinkComplete = childLinkValue(childLink) !== undefined;
  // Admin-only (this page is admin-gated) and never in production.
  const canChooseScope = permissions.canApproveSignups && isTestScopeEnabled();

  useEffect(() => {
    if (!roleModalVisible || !needsChildLink) return;
    let cancelled = false;
    setUnlinkedLoading(true);
    childrenApi
      .getUnlinkedChildren()
      .then(students => {
        if (!cancelled) setUnlinkedStudents(students);
      })
      .catch(err => {
        if (!cancelled) {
          message.error(
            err instanceof Error
              ? err.message
              : t("pendingApprovals.childLink.loadError")
          );
        }
      })
      .finally(() => {
        if (!cancelled) setUnlinkedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roleModalVisible, needsChildLink, t]);

  const closeRoleModal = () => {
    setRoleModalVisible(false);
    setSelectedApproval(null);
    setChildLink(EMPTY_CHILD_LINK_DRAFT);
    form.resetFields();
  };

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
        err instanceof Error
          ? err.message
          : t("pendingApprovals.page.loadErrorFallback")
      );
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const handleApproveWithRole = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    // Default to the requested role; new users are always "prod" by default.
    form.setFieldsValue({ role: approval.role, scope: "prod" });
    setRoleModalVisible(true);
  };

  const handleConfirmApproval = async (values: ApprovalFormValues) => {
    if (!selectedApproval) return;

    const link = childLinkValue(childLink);
    if (values.role === "child" && !link) return;

    setActionLoading(selectedApproval.id);
    try {
      // Set the scope first: if it fails, nothing has been approved yet and
      // the admin can simply retry.
      if (canChooseScope && values.scope === "test") {
        await usersApi.adminSetUserScope(selectedApproval.userId, "test");
      }
      if (values.role === "child" && link) {
        await usersApi.approveChildUser(selectedApproval.userId, link);
      } else {
        await usersApi.approveUserWithRole(
          selectedApproval.userId,
          values.role
        );
      }
      message.success(
        t("pendingApprovals.page.approveSuccess", {
          email: selectedApproval.user.email,
          role: t(`roles.${values.role}`, values.role),
        })
      );
      trackEvent(AnalyticsEvent.SignupApproved, { role: values.role });
      await loadData();
      closeRoleModal();
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
      trackEvent(AnalyticsEvent.SignupRejected, { role });
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
          {t("roles.parent")}
        </Space>
      ),
    },
    {
      value: "staff" as UserRole,
      label: (
        <Space>
          <TeamOutlined />
          {t("roles.staff")}
        </Space>
      ),
    },
    {
      value: "child" as UserRole,
      label: (
        <Space>
          <UserOutlined />
          {t("roles.child")}
        </Space>
      ),
    },
    {
      value: "admin" as UserRole,
      label: (
        <Space>
          <CrownOutlined />
          {t("roles.admin")}
        </Space>
      ),
    },
    {
      value: "moderator" as UserRole,
      label: (
        <Space>
          <SafetyCertificateOutlined />
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
        <fieldset
          className={`pending-approvals-controls${
            loading ? " pending-approvals-controls--disabled" : ""
          }`}
          disabled={loading}
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
        </fieldset>

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
        onCancel={closeRoleModal}
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

              {canChooseScope && (
                <ScopeSelector extra={t("pendingApprovals.modal.scopeHelp")} />
              )}

              {needsChildLink && (
                <div style={{ marginBottom: 24 }}>
                  <Divider orientation="right" plain>
                    <Text strong>{t("pendingApprovals.childLink.title")}</Text>
                  </Divider>
                  <Text
                    type="secondary"
                    style={{ display: "block", marginBottom: 12 }}>
                    {t("pendingApprovals.childLink.description")}
                  </Text>
                  <ChildAccountLinkPicker
                    students={unlinkedStudents}
                    value={childLink}
                    onChange={setChildLink}
                    loading={unlinkedLoading}
                    disabled={actionLoading === selectedApproval.id}
                  />
                </div>
              )}

              <Form.Item style={{ marginBottom: 0, textAlign: "left" }}>
                <Space>
                  {needsChildLink && !childLinkComplete && (
                    <Text type="danger" style={{ fontSize: 13 }}>
                      {t("pendingApprovals.childLink.incomplete")}
                    </Text>
                  )}
                  <Button
                    onClick={closeRoleModal}
                    disabled={actionLoading === selectedApproval?.id}>
                    {t("common.buttons.cancel")}
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    disabled={needsChildLink && !childLinkComplete}
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
