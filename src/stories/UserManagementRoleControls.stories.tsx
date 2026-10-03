import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button, Modal, Typography } from "antd";

const { Text } = Typography;
import { ToggleFilterGroup } from "../components/ToggleFilterGroup";
import { RoleTagPicker } from "../components/RoleTagPicker";
import { ChildAccountLinkPicker } from "../components/ChildAccountLinkPicker";
import {
  EMPTY_CHILD_LINK_DRAFT,
  childLinkValue,
  type ChildLinkDraft,
} from "../components/childAccountLink";
import { ROLE_TAG_COLORS } from "../constants/roleColors";
import { ALL_ROLES } from "../constants/roles";
import { validateRoleSet, type RoleSetError } from "../services/roleRules";
import type { Child, UserRole } from "../types";

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

const linkStudents: Child[] = [
  {
    id: "s1",
    firstName: "נועה",
    lastName: "לוי",
    grade: 2,
    groupNumber: null,
    trackNumber: null,
    scope: "test",
    createdBy: null,
    createdByName: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

function RoleEditModalDemo({
  initialRoles = ["parent"],
}: {
  initialRoles?: UserRole[];
}) {
  const [open, setOpen] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(initialRoles);
  const [linkDraft, setLinkDraft] = useState<ChildLinkDraft>(
    EMPTY_CHILD_LINK_DRAFT
  );
  const roleSetError = validateRoleSet(selectedRoles);
  // Granting child alone needs a linked student, like approval does.
  const needsLink = !roleSetError && selectedRoles.includes("child");
  const canSave = !roleSetError && (!needsLink || !!childLinkValue(linkDraft));

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
        okButtonProps={{ disabled: !canSave }}
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
        {needsLink && (
          <ChildAccountLinkPicker
            students={linkStudents}
            value={linkDraft}
            onChange={setLinkDraft}
          />
        )}
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

// Granting child on its own shows the student link picker.
export const GrantChildWithLink: Story = {
  render: () => <RoleEditModalDemo initialRoles={["child"]} />,
};
