import type { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import { Button, Space } from "antd";
import { PrinterOutlined, ReloadOutlined } from "@ant-design/icons";
import { ScheduleTabsBar } from "../components/ScheduleTabsBar";

// The schedule page's top tab bar for class managers, in the page's order.
// RTL: תלמידים renders rightmost, צוות leftmost. המערכת שלי only appears
// once the signed-in staff member has a display name.
const VIEW_TABS = [
  { key: "student", label: "תלמידים" },
  { key: "mine", label: "המערכת שלי" },
  { key: "staff", label: "צוות" },
];

const meta: Meta<typeof ScheduleTabsBar> = {
  title: "Components/ScheduleViewTabs",
  component: ScheduleTabsBar,
  parameters: {
    layout: "padded",
  },
  args: {
    items: VIEW_TABS,
    onChange: action("onChange"),
    extra: (
      <Space>
        <Button icon={<ReloadOutlined />}>רענן</Button>
        <Button icon={<PrinterOutlined />}>הדפס את המערכת שלי</Button>
      </Space>
    ),
  },
};

export default meta;
type Story = StoryObj<typeof ScheduleTabsBar>;

export const MySchedule: Story = {
  args: { activeKey: "mine" },
};

export const Students: Story = {
  args: { activeKey: "student", extra: undefined },
};

// A staff member without a display name: no המערכת שלי tab.
export const WithoutDisplayName: Story = {
  args: {
    items: VIEW_TABS.filter(tab => tab.key !== "mine"),
    activeKey: "staff",
    extra: undefined,
  },
};
