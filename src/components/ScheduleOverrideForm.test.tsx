// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import "../utils/i18n";
import i18n from "../utils/i18n";
import type { TimeSlot } from "../types";

vi.mock("../hooks/useStaffMembers", () => ({
  useStaffMembers: () => ({ members: [], loading: false }),
}));
vi.mock("../services/supabase", () => ({ supabase: {} }));
vi.mock("../utils/env", () => ({
  isTestScopeEnabled: () => true,
  getAllowedScopes: () => ["prod", "test"],
  env: {},
}));

const { default: ScheduleOverrideForm } = await import(
  "./ScheduleOverrideForm"
);

const lesson: TimeSlot = {
  id: "slot-1",
  name: "שיעור ראשון",
  startTime: "08:00",
  endTime: "08:45",
  createdAt: "",
  updatedAt: "",
};

const meeting: TimeSlot = {
  id: "slot-meeting",
  name: "מפגש בוקר",
  startTime: "07:30",
  endTime: "08:00",
  createdAt: "",
  updatedAt: "",
};

const openTimeSelect = () => {
  render(
    <ScheduleOverrideForm
      timeSlots={[lesson, meeting]}
      onSubmit={vi.fn()}
      onCancel={() => {}}
    />
  );
  const input = screen
    .getByText(i18n.t("schedule.override.timePlaceholder"))
    .closest(".ant-select")
    ?.querySelector("input") as HTMLElement;
  fireEvent.mouseDown(input);
  return input;
};

describe("ScheduleOverrideForm time slot picker", () => {
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

  it("filters slots by name when searching", async () => {
    const input = openTimeSelect();
    fireEvent.change(input, { target: { value: "מפגש" } });

    expect(await screen.findByText(/מפגש בוקר/)).toBeTruthy();
    expect(screen.queryByText(/שיעור ראשון/)).toBeNull();
  });

  // Same icon and muting as ClassForm's picker.
  it("marks meeting slots with an icon and muted text", async () => {
    openTimeSelect();

    const meetingOption = (await screen.findByText(/מפגש בוקר/)).closest(
      ".time-slot-option"
    ) as HTMLElement;
    expect(meetingOption.classList.contains("non-lesson")).toBe(true);
    expect(meetingOption.querySelector(".anticon-team")).toBeTruthy();

    const lessonOption = screen
      .getByText(/שיעור ראשון/)
      .closest(".time-slot-option") as HTMLElement;
    expect(lessonOption.classList.contains("non-lesson")).toBe(false);
    expect(lessonOption.querySelector(".anticon-read")).toBeTruthy();
  });
});
