import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "antd";
import MobileAppLayout from "../layouts/MobileAppLayout";
import { MobileShell } from "./fixtures/mobileShell";

const page = <Card>תוכן העמוד מוצג כאן ברוחב מלא</Card>;

const meta: Meta<typeof MobileAppLayout> = {
  title: "Layouts/MobileAppLayout",
  component: MobileAppLayout,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile2" },
  },
};

export default meta;
type Story = StoryObj<typeof MobileAppLayout>;

export const Parent: Story = {
  render: () => <MobileShell page={page} />,
};

// A computer with "mobile view" switched on in the profile menu.
export const ComputerWithMobileViewOn: Story = {
  render: () => <MobileShell page={page} detected="desktop" />,
};
