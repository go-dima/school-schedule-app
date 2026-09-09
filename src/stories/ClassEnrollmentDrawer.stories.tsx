import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import ClassEnrollmentDrawer from "../components/ClassEnrollmentDrawer";
import type { ClassWithTimeSlot, TimeSlot } from "../types";

// Note: ClassEnrollmentDrawer fetches its roster internally via
// scheduleApi.getClassEnrolledChildren (a real Supabase call). There is no
// mocking setup for Supabase calls in this Storybook instance, so these
// stories demonstrate the drawer's header/loading shell rather than a
// populated roster - the fetch will simply fail (or hang) in this
// environment and the drawer will show its loading/error state.
const meta: Meta<typeof ClassEnrollmentDrawer> = {
  title: "Components/ClassEnrollmentDrawer",
  component: ClassEnrollmentDrawer,
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
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockClassInfo: ClassWithTimeSlot = {
  id: "class-1",
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

// Wrapper component for interactive stories - the drawer is shown open, with
// no trigger button, since that's the only thing these stories demonstrate.
function DrawerWrapper(args: any) {
  const [open, setOpen] = useState(true);

  return (
    <ClassEnrollmentDrawer
      {...args}
      open={open}
      onClose={() => setOpen(false)}
    />
  );
}

export const Default: Story = {
  render: args => <DrawerWrapper {...args} />,
  args: {
    classInfo: mockClassInfo,
  },
};

export const NoClassSelected: Story = {
  render: args => <DrawerWrapper {...args} />,
  args: {
    classInfo: null,
  },
};
