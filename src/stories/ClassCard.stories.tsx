import type { Meta, StoryObj } from "@storybook/react";
import ClassCard from "../components/ClassCard";
import type { TimeSlot, ClassWithTimeSlot } from "../types";

const meta: Meta<typeof ClassCard> = {
  title: "Components/ClassCard",
  component: ClassCard,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    Story => (
      <div style={{ maxWidth: 300, direction: "rtl" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockTimeSlot: TimeSlot = {
  id: "1",
  name: "שיעור ראשון",
  startTime: "11:00",
  endTime: "11:45",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockTimeSlot2: TimeSlot = {
  id: "2",
  name: "שיעור שני",
  startTime: "11:45",
  endTime: "12:25",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const singleClass: ClassWithTimeSlot = {
  id: "class-math",
  title: "מתמטיקה",
  description: "שיעור מתמטיקה מתקדם לכיתה ג.",
  teacher: "מורה שרה כהן",
  slots: [{ dayOfWeek: 0, timeSlotId: "1", timeSlot: mockTimeSlot }],
  grades: [3],
  isMandatory: true,
  isDouble: false,
  groupNumber: null,
  trackNumber: null,
  room: "כיתה 301",
  scope: "test",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const doubleClass: ClassWithTimeSlot = {
  id: "class-english-double",
  title: "אנגלית",
  description: "שיעור אנגלית כפול לכיתה ג.",
  teacher: "מורה ג'ון סמית",
  slots: [
    { dayOfWeek: 0, timeSlotId: "1", timeSlot: mockTimeSlot },
    { dayOfWeek: 0, timeSlotId: "2", timeSlot: mockTimeSlot2 },
  ],
  grades: [3, 4],
  isMandatory: false,
  isDouble: true,
  groupNumber: null,
  trackNumber: null,
  room: "מעבדת שפות",
  scope: "test",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

export const Single: Story = {
  args: {
    cls: singleClass,
    isContinuation: false,
  },
};

export const DoubleLessonContinuation: Story = {
  args: {
    cls: doubleClass,
    isContinuation: true,
  },
};

export const WithEnrollmentBadge: Story = {
  args: {
    cls: singleClass,
    isContinuation: false,
    showEnrollmentCount: true,
    enrollmentCount: 12,
  },
};

export const WithoutEnrollmentBadge: Story = {
  args: {
    cls: singleClass,
    isContinuation: false,
    showEnrollmentCount: false,
    enrollmentCount: 12,
  },
};
