import type { Meta, StoryObj } from "@storybook/react";
import ScheduleTable from "../components/ScheduleTable";
import {
  mockTimeSlots,
  mockClasses,
  mockWeeklySchedule,
  selectedClassIds,
} from "./fixtures/scheduleFixtures";

const meta: Meta<typeof ScheduleTable> = {
  title: "Components/ScheduleTable",
  component: ScheduleTable,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    timeSlots: mockTimeSlots,
    classes: mockClasses,
    weeklySchedule: mockWeeklySchedule,
    canSelectClasses: false,
    canViewClasses: true,
  },
};

export const WithSelection: Story = {
  args: {
    timeSlots: mockTimeSlots,
    classes: mockClasses,
    weeklySchedule: mockWeeklySchedule,
    selectedClasses: selectedClassIds,
    canSelectClasses: true,
    canViewClasses: true,
    onClassSelect: (classId: string) => console.log("Select class:", classId),
    onClassUnselect: (classId: string) =>
      console.log("Unselect class:", classId),
  },
};

export const FilteredByGrade: Story = {
  args: {
    timeSlots: mockTimeSlots,
    classes: mockClasses,
    weeklySchedule: mockWeeklySchedule,
    userGrade: 3,
    canSelectClasses: true,
    canViewClasses: true,
  },
};

export const EmptySchedule: Story = {
  args: {
    timeSlots: mockTimeSlots,
    classes: [],
    weeklySchedule: {},
    canSelectClasses: false,
  },
};
