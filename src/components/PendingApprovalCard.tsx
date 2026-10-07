import React from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, Popconfirm, Tag, Typography } from "antd";
import {
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import type { PendingApproval } from "../types";
import { ROLE_TAG_COLORS } from "../constants/roleColors";
import { formatApprovalDate } from "../hooks/usePendingApprovalsController";
import "./PendingApprovalCard.css";

const { Text } = Typography;

// One pending signup on the mobile Pending Approvals page: the same fields
// and actions as a row of the desktop table.
export const PendingApprovalCard: React.FC<{
  approval: PendingApproval;
  busy: boolean;
  onApprove: (approval: PendingApproval) => void;
  onReject: (approval: PendingApproval) => void;
}> = ({ approval, busy, onApprove, onReject }) => {
  const { t } = useTranslation();
  const { firstName, lastName, email } = approval.user;
  const fullName = `${firstName || ""} ${lastName || ""}`.trim();

  return (
    <Card size="small" className="pending-approval-card">
      {/* Name, email and requested role on one line (RTL: name rightmost,
          role tag leftmost), the request date below. */}
      <div className="pending-approval-card-head">
        {fullName ? (
          <Text strong className="pending-approval-card-name">
            {fullName}
          </Text>
        ) : (
          <Text type="secondary" className="pending-approval-card-name">
            {t("pendingApprovals.table.noName")}
          </Text>
        )}
        <Text
          type="secondary"
          className="pending-approval-card-email"
          title={email}>
          {email}
        </Text>
        <Tag color={ROLE_TAG_COLORS[approval.role]}>
          {t(`roles.${approval.role}`, approval.role)}
        </Tag>
      </div>
      <Text type="secondary" className="pending-approval-card-date">
        <ClockCircleOutlined /> {formatApprovalDate(approval.createdAt)}
      </Text>

      {/* RTL: approve renders rightmost (first), reject leftmost. */}
      <div className="pending-approval-card-actions">
        <Button
          type="primary"
          icon={<CheckOutlined />}
          loading={busy}
          onClick={() => onApprove(approval)}>
          {t("pendingApprovals.table.approveButton")}
        </Button>
        <Popconfirm
          title={t("pendingApprovals.table.rejectConfirmTitle")}
          description={t("pendingApprovals.table.rejectConfirmDescription", {
            email,
          })}
          onConfirm={() => onReject(approval)}
          okText={t("pendingApprovals.table.rejectButton")}
          cancelText={t("common.buttons.cancel")}
          okButtonProps={{ size: "large" }}
          cancelButtonProps={{ size: "large" }}
          placement="top">
          <Button danger icon={<CloseOutlined />} loading={busy}>
            {t("pendingApprovals.table.rejectButton")}
          </Button>
        </Popconfirm>
      </div>
    </Card>
  );
};
