import type { Meta, StoryObj } from "@storybook/react";
import MandatoryClassManager from "../components/MandatoryClassManager";

const meta: Meta<typeof MandatoryClassManager> = {
  title: "Components/MandatoryClassManager",
  component: MandatoryClassManager,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithUpdateCallback: Story = {
  args: {
    onUpdate: () => console.log("Classes updated!"),
  },
};
