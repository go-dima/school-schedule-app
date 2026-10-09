import React from "react";
import { useTranslation } from "react-i18next";
import { Space } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { BottomSheet } from "../../components/BottomSheet";
import type { ApprovalFormController } from "./usePendingApprovalsController";
import { PendingApprovalForm } from "./PendingApprovalForm";
import "./PendingApprovalSheet.css";

// The approve-with-role form as a bottom sheet, for mobile UI Mode. Same
// form as the desktop modal; the sheet body scrolls while its action row
// stays pinned to the bottom, above the on-screen keyboard and home bar.
export const PendingApprovalSheet: React.FC<{
  controller: ApprovalFormController;
}> = ({ controller }) => {
  const { t } = useTranslation();
  return (
    <BottomSheet
      className="pending-approval-sheet"
      open={controller.open}
      onClose={controller.close}
      maskClosable={!controller.submitting}
      closable={!controller.submitting}
      title={
        <Space>
          <UserOutlined />
          {t("pendingApprovals.modal.title")}
        </Space>
      }>
      <PendingApprovalForm controller={controller} />
    </BottomSheet>
  );
};
