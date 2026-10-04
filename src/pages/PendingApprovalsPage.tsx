import React from "react";
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
  Popconfirm,
  Badge,
  Modal,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { PendingApproval, UserRole } from "../types";
import { ROLE_TAG_COLORS } from "../constants/roleColors";
import {
  formatApprovalDate,
  usePendingApprovalsController,
} from "../hooks/usePendingApprovalsController";
import { PendingApprovalForm } from "../components/PendingApprovalForm";
import "./PendingApprovalsPage.css";

const { Title, Text } = Typography;

interface PendingApprovalsPageProps {}

const PendingApprovalsPage: React.FC<PendingApprovalsPageProps> = () => {
  const { t } = useTranslation();
  const {
    canApproveSignups,
    pendingApprovals,
    loading,
    initialLoading,
    error,
    actionLoading,
    lastRefresh,
    loadData,
    startApproval,
    reject,
    approvalForm,
  } = usePendingApprovalsController();

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
          <Text>{formatApprovalDate(date)}</Text>
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
            onClick={() => startApproval(record)}>
            {t("pendingApprovals.table.approveButton")}
          </Button>
          <Popconfirm
            title={t("pendingApprovals.table.rejectConfirmTitle")}
            description={t("pendingApprovals.table.rejectConfirmDescription", {
              email: record.user.email,
            })}
            onConfirm={() => reject(record)}
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

  if (!canApproveSignups) {
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
        open={approvalForm.open}
        onCancel={approvalForm.close}
        footer={null}
        width={500}>
        <PendingApprovalForm controller={approvalForm} />
      </Modal>
    </div>
  );
};

export default PendingApprovalsPage;
