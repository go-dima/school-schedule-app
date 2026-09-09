import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import ClassSelectionCard from "../components/ClassSelectionCard";
import type { TimeSlot, ClassWithTimeSlot } from "../types";

const meta: Meta<typeof ClassSelectionCard> = {
  title: "Components/ClassSelectionCard",
  component: ClassSelectionCard,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    Story => (
      <div style={{ maxWidth: 400, direction: "rtl" }}>
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

const mockTimeSlots: TimeSlot[] = [mockTimeSlot, mockTimeSlot2];

const englishClass: ClassWithTimeSlot = {
  id: "class-kangaroo",
  title: "Kangaroo 1",
  description: "שיעור אנגלית מתקדם בשיטת קנגורו, המשלב משחק ולמידה חווייתית.",
  teacher: "ג'ון נאש",
  slots: [{ dayOfWeek: 0, timeSlotId: "1", timeSlot: mockTimeSlot }],
  grades: [3, 4],
  isMandatory: false,
  isDouble: false,
  groupNumber: 1,
  trackNumber: null,
  room: "אנגלית",
  scope: "test",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const hebrewClass: ClassWithTimeSlot = {
  id: "class-math",
  title: "מתמטיקה",
  description:
    "שיעור מתמטיקה מתקדם לכיתה ג. נלמדות פעולות חשבון, גיאומטריה בסיסית ופתרון בעיות.",
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
  grades: [3],
  isMandatory: false,
  isDouble: true,
  groupNumber: null,
  trackNumber: null,
  room: "מעבדת שפות",
  scope: "test",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const lockedClass: ClassWithTimeSlot = {
  ...hebrewClass,
  id: "class-locked",
  trackNumber: 2,
};

const noRoomClass: ClassWithTimeSlot = {
  ...hebrewClass,
  id: "class-no-room",
  room: "",
};

function CardWrapper(args: any) {
  const [isSelected, setIsSelected] = useState(args.isSelected);

  return (
    <ClassSelectionCard
      {...args}
      isSelected={isSelected}
      onToggle={() => setIsSelected((prev: boolean) => !prev)}
    />
  );
}

export const Default: Story = {
  render: args => <CardWrapper {...args} />,
  args: {
    cls: englishClass,
    isSelected: false,
    isLocked: false,
    hasConflict: false,
    canSelectClasses: true,
    allTimeSlots: mockTimeSlots,
  },
};

export const Selected: Story = {
  render: args => <CardWrapper {...args} />,
  args: {
    cls: hebrewClass,
    isSelected: true,
    isLocked: false,
    hasConflict: false,
    canSelectClasses: true,
    allTimeSlots: mockTimeSlots,
  },
};

export const DoubleLesson: Story = {
  render: args => <CardWrapper {...args} />,
  args: {
    cls: doubleClass,
    isSelected: false,
    isLocked: false,
    hasConflict: false,
    canSelectClasses: true,
    allTimeSlots: mockTimeSlots,
  },
};

export const Locked: Story = {
  render: args => <CardWrapper {...args} />,
  args: {
    cls: lockedClass,
    isSelected: false,
    isLocked: true,
    hasConflict: false,
    canSelectClasses: true,
    allTimeSlots: mockTimeSlots,
  },
};

export const Conflict: Story = {
  render: args => <CardWrapper {...args} />,
  args: {
    cls: hebrewClass,
    isSelected: false,
    isLocked: false,
    hasConflict: true,
    canSelectClasses: true,
    allTimeSlots: mockTimeSlots,
  },
};

export const GrayedOut: Story = {
  render: args => <CardWrapper {...args} />,
  args: {
    cls: hebrewClass,
    isGrayedOut: true,
    isSelected: false,
    isLocked: false,
    hasConflict: false,
    canSelectClasses: true,
    allTimeSlots: mockTimeSlots,
  },
};

export const NoRoom: Story = {
  render: args => <CardWrapper {...args} />,
  args: {
    cls: noRoomClass,
    isSelected: false,
    isLocked: false,
    hasConflict: false,
    canSelectClasses: true,
    allTimeSlots: mockTimeSlots,
  },
};

export const ViewOnly: Story = {
  render: args => <CardWrapper {...args} />,
  args: {
    cls: englishClass,
    isSelected: false,
    isLocked: false,
    hasConflict: false,
    canSelectClasses: false,
    allTimeSlots: mockTimeSlots,
  },
};
