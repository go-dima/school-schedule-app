import type { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import { Button, Space } from "antd";
import { PrinterOutlined, ReloadOutlined } from "@ant-design/icons";
import { ChildTabs } from "../components/ChildTabs";
import type { Child } from "../types";

const makeChild = (
  id: string,
  firstName: string,
  lastName: string,
  grade: number,
  groupNumber: number | null
): Child => ({
  id,
  firstName,
  lastName,
  grade,
  groupNumber,
  trackNumber: null,
  scope: "test",
  createdBy: null,
  createdByName: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

const CHILDREN: Child[] = [
  makeChild("child-1", "נועה", "לוי", 1, 2),
  makeChild("child-2", "איתי", "לוי", 3, null),
  makeChild("child-3", "מאיה", "לוי", 5, null),
];

// Presentational strip only: in the app, SchedulePage owns the selected
// child and AddChildButton owns the add-child modal behind the add tab.
const meta: Meta<typeof ChildTabs> = {
  title: "Components/ChildTabs",
  component: ChildTabs,
  parameters: {
    layout: "padded",
  },
  args: {
    onSelect: action("onSelect"),
    onAddClick: action("onAddClick"),
  },
};

export default meta;
type Story = StoryObj<typeof ChildTabs>;

export const ThreeChildren: Story = {
  args: {
    childList: CHILDREN,
    selectedChildId: CHILDREN[1].id,
  },
};

export const OneChild: Story = {
  args: {
    childList: [CHILDREN[0]],
    selectedChildId: CHILDREN[0].id,
  },
};

export const NoneSelected: Story = {
  args: {
    childList: CHILDREN,
    selectedChildId: undefined,
  },
};

export const NoChildren: Story = {
  args: {
    childList: [],
    selectedChildId: undefined,
  },
};

export const Disabled: Story = {
  args: {
    childList: CHILDREN,
    selectedChildId: CHILDREN[0].id,
    disabled: true,
  },
};

// As on the schedule page: refresh + print at the end of the tab bar.
export const WithPageActions: Story = {
  args: {
    childList: CHILDREN,
    selectedChildId: CHILDREN[0].id,
    extra: (
      <Space>
        <Button icon={<ReloadOutlined />}>רענן</Button>
        <Button icon={<PrinterOutlined />}>הדפס מערכת של נועה לוי</Button>
      </Space>
    ),
  },
};
