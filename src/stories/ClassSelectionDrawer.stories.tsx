import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button } from "antd";
import ClassSelectionDrawer from "../components/ClassSelectionDrawer";
import type { TimeSlot, ClassWithTimeSlot } from "../types";

const meta: Meta<typeof ClassSelectionDrawer> = {
  title: "Components/ClassSelectionDrawer",
  component: ClassSelectionDrawer,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockTimeSlot: TimeSlot = {
  id: "1",
  name: "שיעור ראשון",
  startTime: "09:15",
  endTime: "09:55",
  dayOfWeek: 0,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockClasses: ClassWithTimeSlot[] = [
  {
    id: "class-1",
    title: "מתמטיקה",
    description:
      "שיעור מתמטיקה מתקדם לכיתה ג. נלמדות פעולות חשבון, גיאומטריה בסיסית ופתרון בעיות.",
    teacher: "מורה שרה כהן",
    timeSlotId: "1",
    grades: [3],
    isMandatory: true,
    isDouble: false,
    room: "כיתה 301",
    scope: "test",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    timeSlot: mockTimeSlot,
  },
  {
    id: "class-2",
    title: "אנגלית",
    description:
      "שיעור אנגלית לכיתה ג - שיעור כפול. למידת אוצר מילים, דקדוק בסיסי וביטוי בכתב.",
    teacher: "מורה ג'ון סמית",
    timeSlotId: "1",
    grades: [3],
    isMandatory: false,
    isDouble: true,
    room: "מעבדת שפות",
    scope: "test",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    timeSlot: mockTimeSlot,
  },
  {
    id: "class-3",
    title: "אומנות",
    description: "שיעור אומנות יצירתי לכיתה ג. ציור, פיסול וביטוי אמנותי.",
    teacher: "מורה מיכל לוי",
    timeSlotId: "1",
    grades: [3],
    isMandatory: false,
    isDouble: false,
    room: "אולם אומנות",
    scope: "test",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    timeSlot: mockTimeSlot,
  },
];

const conflictingClasses: ClassWithTimeSlot[] = [mockClasses[1]];

// Wrapper component for interactive stories
function DrawerWrapper(args: any) {
  const [open, setOpen] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    args.selectedClasses || []
  );

  const handleClassSelect = (classId: string) => {
    setSelectedClasses(prev => [...prev, classId]);
  };

  const handleClassUnselect = (classId: string) => {
    setSelectedClasses(prev => prev.filter(id => id !== classId));
  };

  return (
    <div style={{ padding: "20px", direction: "rtl" }}>
      <Button type="primary" onClick={() => setOpen(true)}>
        פתח מגירת בחירת שיעורים
      </Button>

      <ClassSelectionDrawer
        {...args}
        open={open}
        onClose={() => setOpen(false)}
        selectedClasses={selectedClasses}
        onClassSelect={handleClassSelect}
        onClassUnselect={handleClassUnselect}
      />
    </div>
  );
}

export const Default: Story = {
  render: args => <DrawerWrapper {...args} />,
  args: {
    timeSlot: mockTimeSlot,
    dayOfWeek: 0,
    classes: mockClasses,
  },
};

export const WithSelectedClasses: Story = {
  render: args => <DrawerWrapper {...args} />,
  args: {
    timeSlot: mockTimeSlot,
    dayOfWeek: 0,
    classes: mockClasses,
    selectedClasses: ["class-1"],
  },
};

export const WithConflicts: Story = {
  render: args => <DrawerWrapper {...args} />,
  args: {
    timeSlot: mockTimeSlot,
    dayOfWeek: 0,
    classes: mockClasses,
    selectedClasses: ["class-2"],
    conflictingClasses: conflictingClasses,
  },
};

export const EmptyClassList: Story = {
  render: args => <DrawerWrapper {...args} />,
  args: {
    timeSlot: mockTimeSlot,
    dayOfWeek: 0,
    classes: [],
  },
};

export const SingleClass: Story = {
  render: args => <DrawerWrapper {...args} />,
  args: {
    timeSlot: mockTimeSlot,
    dayOfWeek: 0,
    classes: [mockClasses[0]],
  },
};

export const WithMandatoryClasses: Story = {
  render: args => <DrawerWrapper {...args} />,
  args: {
    timeSlot: mockTimeSlot,
    dayOfWeek: 0,
    classes: mockClasses,
    selectedClasses: ["class-1"], // Mandatory math class is pre-selected
  },
};
