import React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Badge, Button, Modal, Space, Spin, Typography } from "antd";
import { ReloadOutlined, UserOutlined } from "@ant-design/icons";
import { usePendingApprovalsController } from "./usePendingApprovalsController";
import { PendingApprovalCard } from "./PendingApprovalCard";
import { PendingApprovalForm } from "./PendingApprovalForm";
import "./MobilePendingApprovalsPage.css";

const { Title, Text } = Typography;

// Pending Approvals in mobile UI Mode: a card per pending signup instead of
// the desktop table, on the same controller.
const MobilePendingApprovalsPage: React.FC = () => {
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

  if (!canApproveSignups) {
    return (
      <Alert
        message={t("pendingApprovals.page.noPermissionMessage")}
        description={t("pendingApprovals.page.noPermissionDescription")}
        type="error"
        showIcon
      />
    );
  }

  if (initialLoading) {
    return (
      <div className="mobile-approvals-loading">
        <Spin size="large" />
        <Text type="secondary">{t("pendingApprovals.page.loadingTitle")}</Text>
      </div>
    );
  }

  return (
    <div className="mobile-approvals">
      <div className="mobile-approvals-header">
        <Title level={4} className="mobile-approvals-title">
          <Space>
            {t("pendingApprovals.page.title")}
            {pendingApprovals.length > 0 && (
              <Badge count={pendingApprovals.length} color="#ff4d4f" />
            )}
          </Space>
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadData}
          loading={loading}
          aria-label={t("common.buttons.refresh")}
          className="mobile-approvals-refresh"
        />
      </div>
      {lastRefresh && (
        <Text type="secondary" className="mobile-approvals-last-refresh">
          {t("pendingApprovals.page.lastRefreshLabel")}
          {lastRefresh.toLocaleTimeString("he-IL")}
        </Text>
      )}

      {error && (
        <Alert
          message={t("pendingApprovals.page.loadErrorAlertMessage")}
          description={error}
          type="error"
          showIcon
          closable
        />
      )}

      <Spin spinning={loading && !initialLoading}>
        {pendingApprovals.length === 0 ? (
          <div className="mobile-approvals-empty">
            <UserOutlined className="mobile-approvals-empty-icon" />
            <Title level={5} type="secondary">
              {t("pendingApprovals.page.emptyTitle")}
            </Title>
            <Text type="secondary">
              {t("pendingApprovals.page.emptyDescription")}
            </Text>
          </div>
        ) : (
          <div className="mobile-approvals-list">
            {pendingApprovals.map(approval => (
              <PendingApprovalCard
                key={approval.id}
                approval={approval}
                busy={actionLoading === approval.id}
                onApprove={startApproval}
                onReject={reject}
              />
            ))}
          </div>
        )}
      </Spin>

      <Modal
        title={
          <Space>
            <UserOutlined />
            {t("pendingApprovals.modal.title")}
          </Space>
        }
        open={approvalForm.open}
        onCancel={approvalForm.close}
        footer={null}>
        <PendingApprovalForm controller={approvalForm} />
      </Modal>
    </div>
  );
};

export default MobilePendingApprovalsPage;
