import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button, Modal, Typography } from "antd";

const { Text } = Typography;
import { ToggleFilterGroup } from "../components/ToggleFilterGroup";
import { RoleTagPicker } from "../components/RoleTagPicker";
import { ROLE_TAG_COLORS } from "../constants/roleColors";
import { ALL_ROLES } from "../constants/roles";
import { validateRoleSet, type RoleSetError } from "../services/roleRules";
import type { UserRole } from "../types";

// UserManagementPage's role filter bar and role-edit modal both need real
// Supabase data to render via the full page, so these stories exercise the
// two pieces directly with local state -- letting the shared role-color
// scheme (ROLE_TAG_COLORS) be iterated on without a backend.

const ROLE_SET_ERRORS: Record<RoleSetError, string> = {
  noRoles: "יש לבחור לפחות תפקיד אחד",
  exclusiveCombined: "תפקיד תלמיד לא ניתן לשילוב עם תפקידים אחרים",
  elevatedWithoutBase:
    "תפקיד מנהל או אחראי/ת מערכת דורש תפקיד בסיס נוסף (הורה או צוות)",
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "מנהל",
  moderator: "אחראי/ת מערכת",
  staff: "צוות",
  parent: "הורה",
  child: "תלמיד/ה",
};

const meta: Meta = {
  title: "Pages/UserManagementPage/RoleControls",
  parameters: {
    layout: "padded",
  },
  decorators: [
    Story => (
      <div style={{ direction: "rtl" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj;

function FilterBarDemo() {
  const [roleFilter, setRoleFilter] = useState<UserRole[]>(ALL_ROLES);

  return (
    <ToggleFilterGroup<UserRole>
      value={roleFilter}
      onChange={setRoleFilter}
      options={ALL_ROLES.map(role => ({
        value: role,
        label: ROLE_LABELS[role],
        color: ROLE_TAG_COLORS[role],
      }))}
    />
  );
}

export const RoleFilterBar: Story = {
  render: () => <FilterBarDemo />,
};

// The picker lists every role, child included, to preview the exclusivity
// rule; the page itself only offers child once granting it can link a
// student record.
function RoleEditModalDemo({
  initialRoles = ["parent"],
}: {
  initialRoles?: UserRole[];
}) {
  const [open, setOpen] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(initialRoles);
  const roleSetError = validateRoleSet(selectedRoles);

  const toggleRole = (role: UserRole, checked: boolean) => {
    setSelectedRoles(prev =>
      checked ? [...prev, role] : prev.filter(r => r !== role)
    );
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>פתח חלון עריכת תפקידים</Button>
      <Modal
        title="עריכת תפקידים"
        open={open}
        onOk={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        okText="שמור"
        cancelText="ביטול"
        okButtonProps={{ disabled: !!roleSetError }}
        footer={(_, { OkBtn, CancelBtn }) => (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 12,
            }}>
            {roleSetError && (
              <Text type="danger" style={{ fontSize: 13 }}>
                {ROLE_SET_ERRORS[roleSetError]}
              </Text>
            )}
            <CancelBtn />
            <OkBtn />
          </div>
        )}>
        <Typography.Paragraph>
          בחר את התפקידים המאושרים עבור המשתמש:{" "}
          <strong>someparent@email.com</strong>:
        </Typography.Paragraph>
        <div style={{ marginBottom: 16 }}>
          <RoleTagPicker
            roles={ALL_ROLES}
            selected={selectedRoles}
            onToggle={toggleRole}
          />
        </div>
      </Modal>
    </>
  );
}

export const RoleEditModal: Story = {
  render: () => <RoleEditModalDemo />,
};

// Child plus any other role is rejected; Save stays disabled.
export const ChildExclusivityError: Story = {
  render: () => <RoleEditModalDemo initialRoles={["parent", "child"]} />,
};
