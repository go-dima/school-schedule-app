// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import "../utils/i18n";
import i18n from "../utils/i18n";
import type { ClassWithTimeSlot, TimeSlot } from "../types";
import {
  stubMatchMedia,
  visibleOptionElements,
  visibleOptions,
} from "../testUtils/antdDom";

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
  teacher: string
): ClassWithTimeSlot => ({
  id,
  title,
  description: "",
  teacher,
  userId: null,
  slots: [{ dayOfWeek: 0, timeSlotId: slot.id, timeSlot: slot }],
  grades: [3],
  isMandatory: false,
  isDouble: false,
  groupNumber: null,
  trackNumber: null,
  room: "",
  scope: "prod",
  createdAt: "",
  updatedAt: "",
});

// Titles sort the table (default ascending), so rows come out א..ה.
const classes = [
  makeClass("k1", "א אמנות", "מירב אלון"),
  makeClass("k2", "ב ביולוגיה", "אורית שמש"),
  makeClass("k3", "ג גיאוגרפיה", "מירב אלון"),
  makeClass("k4", "ד דרמה", "Dana Levi"),
];

vi.mock("../services/api", () => ({
  classesApi: { getClasses: () => Promise.resolve(classes) },
  timeSlotsApi: { getTimeSlots: () => Promise.resolve([slot]) },
}));
vi.mock("../services/enrollmentService", () => ({
  EnrollmentService: {
    getClassEnrollmentCounts: () => Promise.resolve(new Map()),
  },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentRole: { role: "staff" },
    roleFlags: { isAdmin: false },
    permissions: {
      canManageClasses: true,
      canCreateClasses: true,
      canDeleteClasses: true,
    },
  }),
}));
vi.mock("../components/ClassEnrollmentDrawer", () => ({ default: () => null }));
vi.mock("../components/ClassForm", () => ({ default: () => null }));
vi.mock("../utils/env", () => ({
  isTestScopeEnabled: () => false,
  getAllowedScopes: () => ["prod"],
  env: {},
}));
vi.mock("../utils/analytics", () => ({
  trackEvent: vi.fn(),
  trackWithActor: vi.fn(),
  AnalyticsEvent: {},
}));

const { default: ClassManagementPage } = await import("./ClassManagementPage");

const rowTitles = () =>
  Array.from(document.querySelectorAll(".ant-table-row")).map(row =>
    row.querySelector("td")?.textContent?.trim()
  );

// Found by its placeholder while it's still empty, then reused.
const comboboxByPlaceholder = (key: string) =>
  screen
    .getAllByRole("combobox")
    .find(el =>
      el.closest(".ant-select")?.textContent?.includes(i18n.t(key))
    ) as HTMLInputElement;

const renderPage = async () => {
  render(<ClassManagementPage />);
  await waitFor(() => expect(rowTitles()).toHaveLength(4));
  const teacherBox = comboboxByPlaceholder(
    "classManagement.page.searchTeacherPlaceholder"
  );
  const typeTeacher = (value: string) =>
    fireEvent.change(teacherBox, { target: { value } });
  return { teacherBox, typeTeacher };
};

describe("ClassManagementPage teacher filter", () => {
  beforeAll(stubMatchMedia);

  it("lists every teacher, once and sorted, before typing", async () => {
    const { teacherBox } = await renderPage();
    fireEvent.mouseDown(teacherBox);

    expect(visibleOptions()).toEqual(["Dana Levi", "אורית שמש", "מירב אלון"]);
  });

  it("filters the table by teacher, case-insensitively", async () => {
    const { typeTeacher } = await renderPage();

    typeTeacher("מירב");
    expect(rowTitles()).toEqual(["א אמנות", "ג גיאוגרפיה"]);

    typeTeacher("dana");
    expect(rowTitles()).toEqual(["ד דרמה"]);
  });

  it("trims the typed text", async () => {
    const { typeTeacher } = await renderPage();

    typeTeacher(" מירב ");

    expect(rowTitles()).toEqual(["א אמנות", "ג גיאוגרפיה"]);
    expect(visibleOptions()).toEqual(["מירב אלון"]);
  });

  it("suggests each matching teacher once, sorted", async () => {
    const { typeTeacher } = await renderPage();

    typeTeacher("ו");

    expect(visibleOptions()).toEqual(["אורית שמש", "מירב אלון"]);
  });

  it("fills in a picked suggestion and filters to it", async () => {
    const { teacherBox, typeTeacher } = await renderPage();
    typeTeacher("אור");

    fireEvent.click(visibleOptionElements()[0]);

    expect(teacherBox.value).toBe("אורית שמש");
    expect(rowTitles()).toEqual(["ב ביולוגיה"]);
  });
});

describe("ClassManagementPage clear filters", () => {
  beforeAll(stubMatchMedia);

  const pickFirstOption = (box: HTMLInputElement) => {
    fireEvent.mouseDown(box);
    fireEvent.click(visibleOptionElements()[0]);
  };
  // Picked values in the filters card only -- the table's page-size Select
  // also shows a selection item once rows are back.
  const selectedItems = () =>
    document.querySelectorAll(
      ".ant-card:not(.classes-table-card) .ant-select-selection-item"
    );

  it("resets every filter and shows every class again", async () => {
    const { teacherBox, typeTeacher } = await renderPage();
    const titleBox = comboboxByPlaceholder(
      "classManagement.page.searchPlaceholder"
    );
    const selectBoxes = [
      "classManagement.page.dayFilterPlaceholder",
      "classManagement.page.gradeFilterPlaceholder",
      "classManagement.page.trackFilterPlaceholder",
    ].map(comboboxByPlaceholder);

    typeTeacher("מירב");
    fireEvent.change(titleBox, { target: { value: "אמנות" } });
    selectBoxes.forEach(pickFirstOption);
    expect(rowTitles()).toEqual([]);
    expect(selectedItems()).toHaveLength(3);

    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("classManagement.page.clearFiltersButton"),
      })
    );

    expect(teacherBox.value).toBe("");
    expect(titleBox.value).toBe("");
    expect(selectedItems()).toHaveLength(0);
    expect(rowTitles()).toEqual([
      "א אמנות",
      "ב ביולוגיה",
      "ג גיאוגרפיה",
      "ד דרמה",
    ]);
  });
});
