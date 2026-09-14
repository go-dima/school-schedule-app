import type { Meta, StoryObj } from "@storybook/react";
import { AddedByTooltip } from "../elements/AddedByTooltip";

const meta: Meta<typeof AddedByTooltip> = {
  title: "Elements/AddedByTooltip",
  component: AddedByTooltip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Info tooltip shown in the Class Management enrollment roster, revealing who committed a child's class selection and when.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const NamedCommitter: Story = {
  args: {
    firstName: "שרה",
    lastName: "כהן",
    at: "2024-09-01T08:30:00.000Z",
  },
};

export const MissingName: Story = {
  args: {
    firstName: null,
    lastName: null,
    at: "2024-09-01T08:30:00.000Z",
  },
};

export const RecentDate: Story = {
  args: {
    firstName: "דוד",
    lastName: "לוי",
    at: new Date().toISOString(),
  },
};

export const OlderDate: Story = {
  args: {
    firstName: "מיכל",
    lastName: "רוזן",
    at: "2023-01-15T12:00:00.000Z",
  },
};
