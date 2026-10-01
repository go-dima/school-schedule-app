import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Space, Typography } from "antd";
import { ToggleRadioGroup } from "../components/ToggleRadioGroup";
import { ToggleFilterGroup } from "../components/ToggleFilterGroup";
import { ROLE_TAG_COLORS } from "../constants/roleColors";
import i18n from "../utils/i18n";

const { Text } = Typography;

// The role options the signup page will offer, with i18n labels and
// ROLE_TAG_COLORS. In RTL, staff should render rightmost.
const REQUESTABLE_ROLES = ["staff", "parent", "child"] as const;
type RequestableRole = (typeof REQUESTABLE_ROLES)[number];

const roleOptions = REQUESTABLE_ROLES.map(role => ({
  value: role,
  label: i18n.t(`roles.${role}`),
  color: ROLE_TAG_COLORS[role],
}));

function RoleRadio({ initial }: { initial?: RequestableRole }) {
  const [value, setValue] = useState<RequestableRole | undefined>(initial);
  return (
    <Space direction="vertical">
      <ToggleRadioGroup<RequestableRole>
        options={roleOptions}
        value={value}
        onChange={setValue}
        aria-label="תפקיד"
      />
      <Text type="secondary">נבחר: {value ?? "—"}</Text>
    </Space>
  );
}

const meta: Meta = {
  title: "Components/ToggleRadioGroup",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

export const NothingSelected: Story = {
  render: () => <RoleRadio />,
};

export const StaffSelected: Story = {
  render: () => <RoleRadio initial="staff" />,
};

export const ParentSelected: Story = {
  render: () => <RoleRadio initial="parent" />,
};

export const ChildSelected: Story = {
  render: () => <RoleRadio initial="child" />,
};

export const Disabled: Story = {
  render: () => (
    <ToggleRadioGroup<RequestableRole>
      options={roleOptions}
      value="parent"
      onChange={() => {}}
      disabled
    />
  ),
};

function ComparisonDemo() {
  const [radio, setRadio] = useState<RequestableRole | undefined>("child");
  const [filter, setFilter] = useState<RequestableRole[]>([
    ...REQUESTABLE_ROLES,
  ]);
  return (
    <Space direction="vertical" size="large">
      <Space direction="vertical">
        <Text strong>ToggleRadioGroup (בחירה אחת)</Text>
        <ToggleRadioGroup<RequestableRole>
          options={roleOptions}
          value={radio}
          onChange={setRadio}
        />
      </Space>
      <Space direction="vertical">
        <Text strong>ToggleFilterGroup (כל האפשרויות פעילות)</Text>
        <ToggleFilterGroup<RequestableRole>
          options={roleOptions}
          value={filter}
          onChange={setFilter}
        />
      </Space>
    </Space>
  );
}

// Both controls side by side: active colors must match option for option.
export const ComparedWithToggleFilterGroup: Story = {
  render: () => <ComparisonDemo />,
};
