import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { Form } from "antd";
import { PendingApprovalSheet } from "../pages/pendingApprovals/PendingApprovalSheet";
import {
  EMPTY_CHILD_LINK_DRAFT,
  childLinkValue,
  type ChildLinkDraft,
} from "../components/childAccountLink";
import type {
  ApprovalFormController,
  ApprovalFormValues,
} from "../pages/pendingApprovals/usePendingApprovalsController";
import type { Child, PendingApproval, UserRole } from "../types";

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

const unlinkedStudents: Child[] = [
  makeChild("s1", "נועה", "לוי", 2),
  makeChild("s2", "איתי", "כהן", 4),
  makeChild("s3", "מאיה", "אברהם", 4),
];

const approval = (role: UserRole): PendingApproval => ({
  id: "approval-1",
  userId: "user-1",
  role,
  approved: false,
  createdAt: "2026-10-01T08:15:00Z",
  updatedAt: "2026-10-01T08:15:00Z",
  user: {
    id: "user-1",
    email: "noa.levi@example.com",
    firstName: "נועה",
    lastName: "לוי",
    createdAt: "2026-10-01T08:15:00Z",
    updatedAt: "2026-10-01T08:15:00Z",
  },
});

// A local stand-in for usePendingApprovalsController's form state: the real
// form instance and child-link draft, with no Supabase calls.
function SheetHarness({
  role,
  canChooseScope,
}: {
  role: UserRole;
  canChooseScope: boolean;
}) {
  const [form] = Form.useForm<ApprovalFormValues>();
  const chosenRole = Form.useWatch<UserRole | undefined>("role", form);
  const [childLink, setChildLink] = useState<ChildLinkDraft>(
    EMPTY_CHILD_LINK_DRAFT
  );
  const [open, setOpen] = useState(true);

  useEffect(() => {
    form.setFieldsValue({ role, scope: "prod" });
  }, [form, role]);

  const controller: ApprovalFormController = {
    selectedApproval: approval(role),
    open,
    form,
    needsChildLink: chosenRole === "child",
    childLink,
    setChildLink,
    childLinkComplete: childLinkValue(childLink) !== undefined,
    unlinkedStudents,
    unlinkedLoading: false,
    canChooseScope,
    submitting: false,
    close: () => setOpen(false),
    confirm: async () => setOpen(false),
  };

  return <PendingApprovalSheet controller={controller} />;
}

const meta: Meta<typeof SheetHarness> = {
  title: "Components/PendingApprovalSheet",
  component: SheetHarness,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile2" },
  },
};

export default meta;
type Story = StoryObj<typeof SheetHarness>;

export const Parent: Story = {
  args: { role: "parent", canChooseScope: false },
};

export const ChildWithLinkAndScope: Story = {
  args: { role: "child", canChooseScope: true },
};
