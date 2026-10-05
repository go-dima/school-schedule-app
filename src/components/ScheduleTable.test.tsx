// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import "../utils/i18n";
import type {
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  TimeSlot,
} from "../types";
import { stubMatchMedia } from "../testUtils/antdDom";

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
// only its SECOND slot -- e.g. a tutor's חונכות during the continuation
// half of their own double lesson in the Staff View.
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
  id: "mentoring",
  title: "חונכות",
  slots: [{ dayOfWeek: 0, timeSlotId: second.id, timeSlot: second }],
});
// שילוב happens inside another lesson, so it's shown but never a conflict.
const integration = makeClass({
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
    expect(screen.getByText("חונכות")).toBeTruthy();
    // The double lesson still shows in both of its slots.
    expect(screen.getAllByText("חשבון")).toHaveLength(2);
  });

  it("flags the continuation cell as a conflict", () => {
    const { container } = renderWeek([double, sharesSecondSlot]);

    const continuation = container.querySelector(".double-continuation");
    expect(continuation?.classList.contains("conflict")).toBe(true);
  });

  it("flags only the cell where the lessons overlap, not the double's other half", () => {
    const { container } = renderWeek([double, sharesSecondSlot]);

    const conflicted = [...container.querySelectorAll(".conflict")];
    expect(conflicted).toHaveLength(1);
    expect(conflicted[0].classList.contains("double-continuation")).toBe(true);
  });

  it("shows שילוב in the same cell without flagging a conflict", () => {
    const { container } = renderWeek([double, integration]);

    expect(screen.getByText("שילוב")).toBeTruthy();
    expect(container.querySelectorAll(".conflict")).toHaveLength(0);
  });

  it("keeps a lone double lesson conflict-free in both slots", () => {
    const { container } = renderWeek([double]);

    expect(screen.getAllByText("חשבון")).toHaveLength(2);
    expect(container.querySelectorAll(".conflict")).toHaveLength(0);
  });
});

describe("ScheduleTable meeting and break slots", () => {
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

  const meeting = timeSlot("ts-meeting", "מפגש בוקר", "08:30", "09:00");
  const meetingGroup = makeClass({
    id: "meeting-group",
    title: "קבוצת נועה",
    slots: [{ dayOfWeek: 0, timeSlotId: meeting.id, timeSlot: meeting }],
  });

  const renderMeeting = ({
    selected,
    canAssignNonLessonSlots,
  }: {
    selected: boolean;
    canAssignNonLessonSlots: boolean;
  }) =>
    render(
      <ScheduleTable
        timeSlots={[meeting, first]}
        classes={[meetingGroup]}
        weeklySchedule={ScheduleService.buildWeeklySchedule([meetingGroup])}
        selectedClasses={selected ? [meetingGroup.id] : []}
        userSelections={selected ? [asSelection(meetingGroup)] : []}
        canSelectClasses
        canViewClasses
        canAssignNonLessonSlots={canAssignNonLessonSlots}
      />
    );

  const meetingCell = (container: HTMLElement) =>
    container.querySelector(
      "tr[data-row-key^='08:30'] td.day-column"
    ) as HTMLElement;

  it("shows a selected class in place of the slot label", () => {
    const { container } = renderMeeting({
      selected: true,
      canAssignNonLessonSlots: false,
    });

    const sunday = meetingCell(container);
    expect(sunday.textContent).toContain("קבוצת נועה");
    expect(sunday.textContent).not.toContain("מפגש בוקר");
    // The row grows to fit the card, so the time column names the slot.
    const row = sunday.closest("tr") as HTMLElement;
    expect(row.classList.contains("compact-row")).toBe(false);
    expect(row.querySelector(".time-name")?.textContent).toBe("מפגש בוקר");
  });

  it("keeps the label when the slot's class isn't selected", () => {
    const { container } = renderMeeting({
      selected: false,
      canAssignNonLessonSlots: true,
    });

    expect(screen.queryByText("קבוצת נועה")).toBeNull();
    expect(screen.getAllByText("מפגש בוקר")).toHaveLength(5);
    expect(
      meetingCell(container).closest("tr")?.classList.contains("compact-row")
    ).toBe(true);
  });

  it("opens the drawer on a meeting cell for staff", () => {
    const { container } = renderMeeting({
      selected: false,
      canAssignNonLessonSlots: true,
    });

    fireEvent.click(
      meetingCell(container).querySelector(".schedule-cell") as HTMLElement
    );
    expect(screen.getByText("קבוצת נועה")).toBeTruthy();
  });

  it("keeps a meeting cell closed for parents", () => {
    const { container } = renderMeeting({
      selected: true,
      canAssignNonLessonSlots: false,
    });

    const cell = meetingCell(container).querySelector(
      ".schedule-cell"
    ) as HTMLElement;
    expect(cell.classList.contains("clickable")).toBe(false);
    fireEvent.click(cell);
    expect(document.querySelector(".ant-drawer")).toBeNull();
  });
});

describe("ScheduleTable class search highlight", () => {
  beforeAll(stubMatchMedia);

  const onDay = (id: string, title: string, day: number, grade: number) =>
    makeClass({
      id,
      title,
      grades: [grade],
      slots: [{ dayOfWeek: day, timeSlotId: first.id, timeSlot: first }],
    });
  // Sunday and Tuesday in grade 4, Monday in grade 5.
  const week = [
    onDay("drama-4", "Drama", 0, 4),
    onDay("drama-5", "Drama Club", 1, 5),
    onDay("math-4", "חשבון", 2, 4),
  ];

  // The days (0 = Sunday) whose first-slot cell is highlighted.
  const highlightedDays = (searchTerm: string, userGrade?: number) => {
    const { container } = render(
      <ScheduleTable
        timeSlots={timeSlots}
        classes={week}
        weeklySchedule={ScheduleService.buildWeeklySchedule(week)}
        userGrade={userGrade}
        canSelectClasses
        canViewClasses
        searchTerm={searchTerm}
      />
    );
    const cells = container.querySelectorAll<HTMLElement>(
      "tr[data-row-key^='09:10'] td.day-column"
    );
    return [...cells].flatMap((cell, day) =>
      cell.querySelector(".search-highlighted") ? [day] : []
    );
  };

  it("highlights nothing for an empty or all-space search", () => {
    expect(highlightedDays("", 4)).toEqual([]);
    expect(highlightedDays("   ", 4)).toEqual([]);
  });

  it("highlights the cells whose class title matches, case-insensitively", () => {
    expect(highlightedDays("drama")).toEqual([0, 1]);
    expect(highlightedDays("חשב")).toEqual([2]);
  });

  it("trims the search, like its suggestions", () => {
    expect(highlightedDays(" חשבון ")).toEqual([2]);
  });

  it("only matches classes in the shown grade", () => {
    expect(highlightedDays("drama", 4)).toEqual([0]);
    expect(highlightedDays("drama", 5)).toEqual([1]);
  });
});
