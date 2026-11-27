import type { Meta, StoryObj } from "@storybook/react";
import UserManagementPage from "../pages/UserManagementPage";
import { AuthContext } from "../contexts/AuthContextObject";
import { usersApi } from "../services/api";
import type { UserRole, UserWithRoles } from "../types";
import { mockAdminAuth } from "./fixtures/mockAuth";
import { StubbedApis } from "./fixtures/stubApis";
import { never } from "./fixtures/never";

// UserManagementPage loads its rows through usersApi.getAllUsersWithRoles.
// StubbedApis swaps that call for fixtures while the story is mounted, so the
// story makes no Supabase request. Sign-in dates are far in the past, so the
// "last sign in" column shows a fixed date whatever the clock says.
const makeUser = (
  id: string,
  roles: UserRole[],
  names: { firstName?: string; lastName?: string; displayName?: string },
  lastSignInAt?: string
): UserWithRoles => ({
  id,
  email: `${id}@example.com`,
  ...names,
  scope: "prod",
  createdAt: "2026-01-10T08:00:00Z",
  lastSignInAt,
  roles: roles.map(role => ({
    id: `${id}-${role}`,
    userId: id,
    role,
    approved: true,
    createdAt: "2026-01-10T08:00:00Z",
    updatedAt: "2026-01-10T08:00:00Z",
  })),
});

const users: UserWithRoles[] = [
  makeUser(
    "u1",
    ["admin", "staff"],
    { firstName: "אורית", lastName: "שמש", displayName: "המורה אורית" },
    "2026-02-01T09:00:00Z"
  ),
  makeUser(
    "u2",
    ["parent"],
    { firstName: "נועה", lastName: "כהן" },
    "2026-02-03T17:30:00Z"
  ),
  makeUser(
    "u3",
    ["staff"],
    { firstName: "דנה", lastName: "לוי", displayName: "דנה" },
    "2026-01-20T11:00:00Z"
  ),
  makeUser("u4", ["child"], { firstName: "יואב", lastName: "לוי" }),
  makeUser("u5", ["parent", "staff"], { firstName: "יעל", lastName: "בר" }),
];

const meta: Meta<typeof UserManagementPage> = {
  title: "Pages/UserManagementPage",
  component: UserManagementPage,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story, { parameters }) => (
      <AuthContext.Provider value={mockAdminAuth}>
        <StubbedApis
          patches={[
            [
              usersApi,
              "getAllUsersWithRoles",
              parameters.fetchUsers ?? (async () => users),
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

export const NoUsers: Story = {
  parameters: { fetchUsers: async () => [] },
};

export const Loading: Story = {
  parameters: { fetchUsers: never },
};
