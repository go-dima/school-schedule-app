import React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Divider, Form, Select, Space, Typography } from "antd";
import {
  CheckOutlined,
  CrownOutlined,
  HomeOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { UserRole } from "../../types";
import { ChildAccountLinkPicker } from "../../components/ChildAccountLinkPicker";
import { ScopeSelector } from "../../components/ScopeSelector";
import type { ApprovalFormController } from "./usePendingApprovalsController";

const { Text } = Typography;

// The approve-with-role form: shown in a Modal on desktop and a bottom sheet
// on mobile. Only the container differs; the fields and rules are shared.
export const PendingApprovalForm: React.FC<{
  controller: ApprovalFormController;
}> = ({ controller }) => {
  const { t } = useTranslation();
  const {
    selectedApproval,
    form,
    needsChildLink,
    childLink,
    setChildLink,
    childLinkComplete,
    unlinkedStudents,
    unlinkedLoading,
    canChooseScope,
    submitting,
    close,
    confirm,
  } = controller;

  if (!selectedApproval) return null;

  const roleOptions = [
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

  return (
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
              <strong>{t("pendingApprovals.modal.originalRoleLabel")}</strong>{" "}
              {t(`roles.${selectedApproval.role}`, selectedApproval.role)}
            </p>
            <p>{t("pendingApprovals.modal.chooseFinalRolePrompt")}</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form form={form} onFinish={confirm} layout="vertical">
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
            options={roleOptions}
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
              disabled={submitting}
            />
          </div>
        )}

        <Form.Item
          className="pending-approval-form-actions"
          style={{ marginBottom: 0, textAlign: "left" }}>
          <Space wrap>
            {needsChildLink && !childLinkComplete && (
              <Text type="danger" style={{ fontSize: 13 }}>
                {t("pendingApprovals.childLink.incomplete")}
              </Text>
            )}
            <Button onClick={close} disabled={submitting}>
              {t("common.buttons.cancel")}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              disabled={needsChildLink && !childLinkComplete}
              loading={submitting}
              icon={<CheckOutlined />}>
              {t("pendingApprovals.modal.submitButton")}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </>
  );
};
