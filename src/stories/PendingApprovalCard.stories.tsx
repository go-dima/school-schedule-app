import type { Meta, StoryObj } from "@storybook/react";
import { PendingApprovalCard } from "../pages/pendingApprovals/PendingApprovalCard";
import type { PendingApproval, UserRole } from "../types";

const approval = (
  role: UserRole,
  firstName?: string,
  lastName?: string,
  email = `${role}.with.a.long.address@example.com`
): PendingApproval => ({
  id: `approval-${role}`,
  userId: `user-${role}`,
  role,
  approved: false,
  createdAt: "2026-10-01T08:15:00Z",
  updatedAt: "2026-10-01T08:15:00Z",
  user: {
    id: `user-${role}`,
    email,
    firstName,
    lastName,
    createdAt: "2026-10-01T08:15:00Z",
    updatedAt: "2026-10-01T08:15:00Z",
  },
});

const meta: Meta<typeof PendingApprovalCard> = {
  title: "Components/PendingApprovalCard",
  component: PendingApprovalCard,
  args: { busy: false, onApprove: () => {}, onReject: () => {} },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  decorators: [
    Story => (
      <div style={{ padding: 12, background: "#f8fafc", maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PendingApprovalCard>;

export const Parent: Story = {
  args: { approval: approval("parent", "דנה", "כהן") },
};

export const ChildWithoutName: Story = {
  args: { approval: approval("child") },
};

export const Busy: Story = {
  args: { approval: approval("staff", "יוסי", "לוי"), busy: true },
};

export const List: Story = {
  render: args => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <PendingApprovalCard
        {...args}
        approval={approval("parent", "דנה", "כהן")}
      />
      <PendingApprovalCard {...args} approval={approval("child")} />
      <PendingApprovalCard
        {...args}
        approval={approval("staff", "אברהם-יהושע", "בן-דוד וייסברגר")}
      />
    </div>
  ),
};
