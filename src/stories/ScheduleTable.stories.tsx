import type { Meta, StoryObj } from '@storybook/react';
import ScheduleTable from '../components/ScheduleTable';
import type { TimeSlot, ClassWithTimeSlot, WeeklySchedule } from '../types';

const meta: Meta<typeof ScheduleTable> = {
  title: 'Components/ScheduleTable',
  component: ScheduleTable,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockTimeSlots: TimeSlot[] = [
  {
    id: '1',
    name: 'שיעור ראשון',
    startTime: '09:15',
    endTime: '09:50',
    dayOfWeek: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'שיעור שני',
    startTime: '09:50',
    endTime: '10:30',
    dayOfWeek: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'שיעור שלישי',
    startTime: '11:00',
    endTime: '11:40',
    dayOfWeek: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'שיעור ראשון',
    startTime: '09:15',
    endTime: '09:50',
    dayOfWeek: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockClasses: ClassWithTimeSlot[] = [
  {
    id: 'class-1',
    title: 'מתמטיקה',
    description: 'שיעור מתמטיקה לכיתה ג',
    teacher: 'מורה שרה',
    timeSlotId: '1',
    grades: [3],
    isMandatory: true,
    scope: 'test',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    timeSlot: mockTimeSlots[0],
  },
  {
    id: 'class-2',
    title: 'עברית',
    description: 'שיעור עברית לכיתה ג',
    teacher: 'מורה רחל',
    timeSlotId: '2',
    grades: [3],
    isMandatory: true,
    scope: 'test',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    timeSlot: mockTimeSlots[1],
  },
  {
    id: 'class-3',
    title: 'אנגלית',
    description: 'שיעור אנגלית לכיתה ד',
    teacher: 'מורה דוד',
    timeSlotId: '1',
    grades: [4],
    isMandatory: false,
    scope: 'test',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    timeSlot: mockTimeSlots[0],
  },
  {
    id: 'class-4',
    title: 'מדעים',
    description: 'שיעור מדעים לכיתה ה',
    teacher: 'מורה מיכל',
    timeSlotId: '3',
    grades: [5],
    isMandatory: false,
    scope: 'test',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    timeSlot: mockTimeSlots[2],
  },
];

const mockWeeklySchedule: WeeklySchedule = {
  0: { // Sunday
    '1': [mockClasses[0], mockClasses[2]], // Multiple classes in same time slot
    '2': [mockClasses[1]], // Single class
  },
  1: { // Monday
    '3': [mockClasses[3]],
  },
};

export const Default: Story = {
  args: {
    timeSlots: mockTimeSlots,
    classes: mockClasses,
    weeklySchedule: mockWeeklySchedule,
    canSelectClasses: false,
  },
};

export const WithSelection: Story = {
  args: {
    timeSlots: mockTimeSlots,
    classes: mockClasses,
    weeklySchedule: mockWeeklySchedule,
    selectedClasses: ['class-1', 'class-4'],
    canSelectClasses: true,
    onClassSelect: (classId: string) => console.log('Select class:', classId),
    onClassUnselect: (classId: string) => console.log('Unselect class:', classId),
  },
};

export const FilteredByGrade: Story = {
  args: {
    timeSlots: mockTimeSlots,
    classes: mockClasses,
    weeklySchedule: mockWeeklySchedule,
    userGrade: 3,
    canSelectClasses: true,
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