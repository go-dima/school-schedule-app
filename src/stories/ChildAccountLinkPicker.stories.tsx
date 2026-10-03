import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Alert, Button, Divider, Modal, Select, Space, Typography } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { ChildAccountLinkPicker } from "../components/ChildAccountLinkPicker";
import {
  EMPTY_CHILD_LINK_DRAFT,
  childLinkValue,
  type ChildLinkDraft,
} from "../components/childAccountLink";
import type { Child, UserRole } from "../types";
import i18n from "../utils/i18n";

const { Text } = Typography;
const t = i18n.t.bind(i18n);

const makeChild = (
  id: string,
  firstName: string,
  lastName: string,
  grade: number
): Child => ({
  id,
  firstName,
  lastName,
  grade,
  groupNumber: null,
  trackNumber: null,
  scope: "test",
  createdBy: null,
  createdByName: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

// Students with no linked account (childrenApi.getUnlinkedChildren).
const unlinkedStudents: Child[] = [
  makeChild("s1", "נועה", "לוי", 2),
  makeChild("s2", "איתי", "כהן", 4),
  makeChild("s3", "מאיה", "אברהם", 4),
  makeChild("s4", "יונתן", "מזרחי", 6),
];

// Mimics the PendingApprovals approval modal (the page itself needs Supabase):
// the info alert, the role Select, and -- once the role is child -- the
// picker. The confirm button stays disabled until the picker is complete.
function ApprovalModalDemo({
  initialDraft,
  students = unlinkedStudents,
}: {
  initialDraft: ChildLinkDraft;
  students?: Child[];
}) {
  const [role, setRole] = useState<UserRole>("child");
  const [draft, setDraft] = useState<ChildLinkDraft>(initialDraft);
  const complete = role !== "child" || childLinkValue(draft) !== undefined;

  return (
    <Modal
      open
      title={t("pendingApprovals.modal.title")}
      closable={false}
      width={520}
      footer={
        <Space>
          {!complete && (
            <Text type="danger" style={{ fontSize: 13 }}>
              {t("pendingApprovals.childLink.incomplete")}
            </Text>
          )}
          <Button>{t("common.buttons.cancel")}</Button>
          <Button type="primary" icon={<CheckOutlined />} disabled={!complete}>
            {t("pendingApprovals.modal.submitButton")}
          </Button>
        </Space>
      }>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message={t("pendingApprovals.modal.userAlertMessage", {
          email: "noa.student@email.com",
        })}
        description={
          <p style={{ margin: 0 }}>
            <strong>{t("pendingApprovals.modal.originalRoleLabel")}</strong>{" "}
            {t("roles.child")}
          </p>
        }
      />
      <Text strong>{t("pendingApprovals.modal.roleFieldLabel")}</Text>
      <Select<UserRole>
        size="large"
        value={role}
        onChange={setRole}
        style={{ width: "100%", marginTop: 8 }}
        options={(["parent", "staff", "child"] as UserRole[]).map(r => ({
          value: r,
          label: t(`roles.${r}`),
        }))}
      />
      {role === "child" && (
        <>
          <Divider orientation="right" plain>
            <Text strong>{t("pendingApprovals.childLink.title")}</Text>
          </Divider>
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            {t("pendingApprovals.childLink.description")}
          </Text>
          <ChildAccountLinkPicker
            students={students}
            value={draft}
            onChange={setDraft}
          />
        </>
      )}
    </Modal>
  );
}

const meta: Meta = {
  title: "Components/ChildAccountLinkPicker",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

export const ExistingStudent: Story = {
  render: () => <ApprovalModalDemo initialDraft={EMPTY_CHILD_LINK_DRAFT} />,
};

export const ExistingStudentChosen: Story = {
  render: () => (
    <ApprovalModalDemo
      initialDraft={{ mode: "existing", childId: "s2", newChild: {} }}
    />
  ),
};

export const ExistingStudentNoneUnlinked: Story = {
  render: () => (
    <ApprovalModalDemo initialDraft={EMPTY_CHILD_LINK_DRAFT} students={[]} />
  ),
};

export const NewStudent: Story = {
  render: () => (
    <ApprovalModalDemo initialDraft={{ mode: "new", newChild: {} }} />
  ),
};

export const NewStudentFilled: Story = {
  render: () => (
    <ApprovalModalDemo
      initialDraft={{
        mode: "new",
        newChild: {
          firstName: "נועה",
          lastName: "לוי",
          grade: 2,
          groupNumber: 1,
        },
      }}
    />
  ),
};
