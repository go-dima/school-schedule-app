import type { Meta, StoryObj } from "@storybook/react";
import PrintableSchedule from "../components/PrintableSchedule";
import {
  mockTimeSlots,
  mockWeeklySchedule,
  selectedClassIds,
} from "./fixtures/scheduleFixtures";
import type { Child } from "../types";

// Renders the same markup/CSS used inside the print popup window, so the
// print layout and colors can be inspected and tweaked here directly instead
// of opening a real print dialog.
const mockChild: Child = {
  id: "child-1",
  firstName: "נועה",
  lastName: "כהן",
  grade: 4,
  groupNumber: null,
  trackNumber: null,
  scope: "test",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const meta: Meta<typeof PrintableSchedule> = {
  title: "Components/PrintableSchedule",
  component: PrintableSchedule,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    child: mockChild,
    timeSlots: mockTimeSlots,
    weeklySchedule: mockWeeklySchedule,
    selectedClasses: selectedClassIds,
  },
};

export const NoSelections: Story = {
  args: {
    child: mockChild,
    timeSlots: mockTimeSlots,
    weeklySchedule: mockWeeklySchedule,
    selectedClasses: [],
  },
};
