import type { Meta, StoryObj } from "@storybook/react";
import PendingApprovalsPage from "../pages/pendingApprovals/PendingApprovalsPage";
import { AuthContext } from "../contexts/AuthContextObject";
import { usersApi } from "../services/api";
import type { PendingApproval, UserRole } from "../types";
import { mockAdminAuth } from "./fixtures/mockAuth";
import { StubbedApis } from "./fixtures/stubApis";
import { never } from "./fixtures/never";

// The desktop page (the mobile one is covered by PendingApprovalCard and
// PendingApprovalSheet). It loads through usePendingApprovalsController, which
// calls usersApi.getPendingApprovalsWithUsers; StubbedApis swaps that call for
// fixtures while the story is mounted, so the story makes no Supabase request.
// The page's "last refresh" time comes from the real clock, so a visual diff
// must freeze it (the harness does).
const approval = (
  role: UserRole,
  firstName?: string,
  lastName?: string
): PendingApproval => ({
  id: `approval-${role}-${firstName ?? "none"}`,
  userId: `user-${role}-${firstName ?? "none"}`,
  role,
  approved: false,
  createdAt: "2026-10-01T08:15:00Z",
  updatedAt: "2026-10-01T08:15:00Z",
  user: {
    id: `user-${role}-${firstName ?? "none"}`,
    email: `${role}.${firstName ?? "none"}@example.com`,
    firstName,
    lastName,
    createdAt: "2026-10-01T08:15:00Z",
    updatedAt: "2026-10-01T08:15:00Z",
  },
});

const approvals: PendingApproval[] = [
  approval("parent", "דנה", "כהן"),
  approval("staff", "יוסי", "לוי"),
  approval("child"),
  approval("parent", "אברהם-יהושע", "בן-דוד וייסברגר"),
];

const meta: Meta<typeof PendingApprovalsPage> = {
  title: "Pages/PendingApprovalsPage",
  component: PendingApprovalsPage,
  tags: ["visual-desktop"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story, { parameters }) => (
      <AuthContext.Provider value={mockAdminAuth}>
        <StubbedApis
          patches={[
            [
              usersApi,
              "getPendingApprovalsWithUsers",
              parameters.fetchApprovals ?? (async () => approvals),
            ],
          ]}>
          <Story />
        </StubbedApis>
      </AuthContext.Provider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoPendingApprovals: Story = {
  parameters: { fetchApprovals: async () => [] },
};

export const Loading: Story = {
  parameters: { fetchApprovals: never },
};
