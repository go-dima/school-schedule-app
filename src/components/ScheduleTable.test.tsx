// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import "../utils/i18n";
import type {
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  TimeSlot,
} from "../types";

vi.mock("../services/supabase", () => ({ supabase: {} }));
vi.mock("../services/enrollmentService", () => ({
  EnrollmentService: {
    getClassEnrollmentCounts: vi.fn().mockResolvedValue(new Map()),
  },
}));

const { default: ScheduleTable } = await import("./ScheduleTable");
const { ScheduleService } = await import("../services/scheduleService");

const timeSlot = (
  id: string,
  name: string,
  startTime: string,
  endTime: string
): TimeSlot => ({ id, name, startTime, endTime, createdAt: "", updatedAt: "" });

const first = timeSlot("ts-1", "שיעור ראשון", "09:10", "09:50");
const second = timeSlot("ts-2", "שיעור שני", "09:50", "10:30");
const timeSlots = [first, second];

const makeClass = (
  overrides: Partial<ClassWithTimeSlot>
): ClassWithTimeSlot => ({
  id: "class",
  title: "שיעור",
  description: "",
  teacher: "אורית שמש",
  slots: [],
  grades: [4],
  isMandatory: false,
  isDouble: false,
  groupNumber: null,
  trackNumber: null,
  room: "",
  scope: "prod",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

// A double lesson on Sunday (slots 1+2) and a second lesson that shares
// only its SECOND slot -- the Staff View case where a tutor's שילוב sits in
// the continuation half of their own double lesson.
const double = makeClass({
  id: "double",
  title: "חשבון",
  isDouble: true,
  slots: [
    { dayOfWeek: 0, timeSlotId: first.id, timeSlot: first },
    { dayOfWeek: 0, timeSlotId: second.id, timeSlot: second },
  ],
});
const sharesSecondSlot = makeClass({
  id: "integration",
  title: "שילוב",
  slots: [{ dayOfWeek: 0, timeSlotId: second.id, timeSlot: second }],
});

const asSelection = (cls: ClassWithTimeSlot): ScheduleSelectionWithClass => ({
  id: `sel-${cls.id}`,
  userId: "",
  classId: cls.id,
  status: "committed",
  createdAt: "",
  updatedAt: "",
  class: cls,
});

const renderWeek = (classes: ClassWithTimeSlot[]) =>
  render(
    <ScheduleTable
      timeSlots={timeSlots}
      classes={classes}
      weeklySchedule={ScheduleService.buildWeeklySchedule(classes)}
      selectedClasses={classes.map(c => c.id)}
      userSelections={classes.map(asSelection)}
      canSelectClasses={false}
      canViewClasses={false}
    />
  );

describe("ScheduleTable double-lesson continuation cell", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  it("also shows another selected lesson that shares the second slot", () => {
    renderWeek([double, sharesSecondSlot]);

    // The conflict is real, so the other lesson must be visible, not just
    // implied by a red border.
    expect(screen.getByText("שילוב")).toBeTruthy();
    // The double lesson still shows in both of its slots.
    expect(screen.getAllByText("חשבון")).toHaveLength(2);
  });

  it("flags the continuation cell as a conflict", () => {
    const { container } = renderWeek([double, sharesSecondSlot]);

    const continuation = container.querySelector(".double-continuation");
    expect(continuation?.classList.contains("conflict")).toBe(true);
  });

  it("keeps a lone double lesson conflict-free in both slots", () => {
    const { container } = renderWeek([double]);

    expect(screen.getAllByText("חשבון")).toHaveLength(2);
    expect(container.querySelectorAll(".conflict")).toHaveLength(0);
  });
});
