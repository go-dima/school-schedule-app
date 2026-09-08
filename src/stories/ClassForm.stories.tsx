import type { Meta, StoryObj } from "@storybook/react";
import ClassForm from "../components/ClassForm";
import type { ClassWithTimeSlot, TimeSlot } from "../types";

const meta: Meta<typeof ClassForm> = {
  title: "Components/ClassForm",
  component: ClassForm,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockTimeSlots: TimeSlot[] = [
  {
    id: "1",
    name: "שיעור ראשון",
    startTime: "09:15",
    endTime: "09:55",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "2",
    name: "שיעור שני",
    startTime: "09:55",
    endTime: "10:30",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "3",
    name: "שיעור שלישי",
    startTime: "11:00",
    endTime: "11:45",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

const mockDoubleLessonClass: ClassWithTimeSlot = {
  id: "class-1",
  title: "עברית",
  description: "שיעור עברית לכיתה ג - שיעור כפול",
  teacher: "מורה רחל",
  slots: [
    { dayOfWeek: 0, timeSlotId: "1", timeSlot: mockTimeSlots[0] },
    { dayOfWeek: 0, timeSlotId: "2", timeSlot: mockTimeSlots[1] },
  ],
  grades: [3],
  isMandatory: true,
  isDouble: true,
  groupNumber: null,
  trackNumber: null,
  room: "כיתה 302",
  scope: "test",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockMultiSlotClass: ClassWithTimeSlot = {
  id: "class-2",
  title: "חינוך גופני",
  description: "שיעור חינוך גופני, פעמיים בשבוע",
  teacher: "מורה דוד",
  slots: [
    { dayOfWeek: 0, timeSlotId: "1", timeSlot: mockTimeSlots[0] },
    { dayOfWeek: 2, timeSlotId: "3", timeSlot: mockTimeSlots[2] },
  ],
  grades: [4],
  isMandatory: false,
  isDouble: false,
  groupNumber: null,
  trackNumber: null,
  room: "אולם ספורט",
  scope: "test",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

export const NewClass: Story = {
  args: {
    timeSlots: mockTimeSlots,
    onSubmit: async values => console.log("Submit new class:", values),
    onCancel: () => console.log("Cancelled"),
    isNewLesson: true,
  },
};

export const EditDoubleLesson: Story = {
  args: {
    initialValues: mockDoubleLessonClass,
    timeSlots: mockTimeSlots,
    onSubmit: async values => console.log("Submit updated class:", values),
    onCancel: () => console.log("Cancelled"),
    isNewLesson: false,
  },
};

export const EditCrossDayMultiSlot: Story = {
  args: {
    initialValues: mockMultiSlotClass,
    timeSlots: mockTimeSlots,
    onSubmit: async values => console.log("Submit updated class:", values),
    onCancel: () => console.log("Cancelled"),
    isNewLesson: false,
  },
};

export const Loading: Story = {
  args: {
    timeSlots: mockTimeSlots,
    onSubmit: async values => console.log("Submit new class:", values),
    onCancel: () => console.log("Cancelled"),
    isNewLesson: true,
    loading: true,
  },
};
