import { useEffect, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import ClassManagementPage from "../pages/ClassManagementPage";
import {
  AuthContext,
  type AuthContextType,
} from "../contexts/AuthContextObject";
import { classesApi, timeSlotsApi } from "../services/api";
import { EnrollmentService } from "../services/enrollmentService";
import type { ClassWithTimeSlot, TimeSlot, UserRoleData } from "../types";

// ClassManagementPage fetches its data itself through classesApi,
// timeSlotsApi and EnrollmentService. The StubbedData decorator below swaps
// those three calls for fixtures while the story is mounted, so the story
// shows a populated table instead of a failed Supabase fetch.
//
// Expected filters bar, right to left (same order as on main; the buttons
// that used to sit in the row above keep רענן rightmost, then הוסף):
//   [חיפוש:][class search] · [חיפוש מורה:][teacher search] · [כיתה:][grade]
//   · [יום בשבוע:][day] · [מסלול:][track] · נקה מסננים
//   ‖ רענן · הוסף שיעור חדש · scope (admin, leftmost).
// Inside each pair the label renders to the right of its control, with one
// colon. Grade, day and track are FilterSelects, cleared with the Select's
// own clear icon.
const slot: TimeSlot = {
  id: "slot-1",
  name: "שיעור ראשון",
  startTime: "08:00",
  endTime: "08:45",
  createdAt: "",
  updatedAt: "",
};

const makeClass = (
  id: string,
  title: string,
  teacher: string,
  dayOfWeek: number,
  grades: number[]
): ClassWithTimeSlot => ({
  id,
  title,
  description: "",
  teacher,
  userId: null,
  slots: [{ dayOfWeek, timeSlotId: slot.id, timeSlot: slot }],
  grades,
  isMandatory: false,
  isDouble: false,
  groupNumber: null,
  trackNumber: null,
  room: "",
  scope: "prod",
  createdAt: "",
  updatedAt: "",
});

const fixtureClasses = [
  makeClass("c1", "אמנות", "מירב אלון", 0, [1, 2]),
  makeClass("c2", "ביולוגיה", "אורית שמש", 1, [4]),
  makeClass("c3", "דרמה", "דנה לוי", 3, [5, 6]),
];

const originals = {
  getClasses: classesApi.getClasses,
  getTimeSlots: timeSlotsApi.getTimeSlots,
  getClassEnrollmentCounts: EnrollmentService.getClassEnrollmentCounts,
};

const installStubs = () => {
  classesApi.getClasses = async () => fixtureClasses;
  timeSlotsApi.getTimeSlots = async () => [slot];
  EnrollmentService.getClassEnrollmentCounts = async () => new Map([["c1", 3]]);
};

const restoreStubs = () => {
  classesApi.getClasses = originals.getClasses;
  timeSlotsApi.getTimeSlots = originals.getTimeSlots;
  EnrollmentService.getClassEnrollmentCounts =
    originals.getClassEnrollmentCounts;
};

// Stubs are installed during render, before the page's own mount effect
// fetches, and restored when the story unmounts. Re-installing in the effect
// keeps them in place if React re-runs effects (StrictMode).
function StubbedData({ children }: { children: ReactNode }) {
  installStubs();
  useEffect(() => {
    installStubs();
    return restoreStubs;
  }, []);
  return <>{children}</>;
}

const adminRole: UserRoleData = {
  id: "role-1",
  userId: "user-1",
  role: "admin",
  approved: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockAuthValue: AuthContextType = {
  user: null,
  userRoles: [adminRole],
  currentRole: adminRole,
  loading: false,
  error: null,
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  switchRole: () => {},
  hasRole: () => true,
  permissions: {
    canManageClasses: true,
    canCreateClasses: true,
    canDeleteClasses: true,
    canViewAllSchedules: true,
    canManageRoster: true,
    canApproveSignups: true,
    canAdjustRoles: true,
    canPickSchedule: false,
    canManageChildren: false,
  },
  roleFlags: {
    isAdmin: true,
    isStaff: false,
    isModerator: false,
    isParent: false,
    isChild: false,
  },
};

function MockAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={mockAuthValue}>
      {children}
    </AuthContext.Provider>
  );
}

const meta: Meta<typeof ClassManagementPage> = {
  title: "Pages/ClassManagementPage",
  component: ClassManagementPage,
  decorators: [
    Story => (
      <MockAuthProvider>
        <StubbedData>
          <Story />
        </StubbedData>
      </MockAuthProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
