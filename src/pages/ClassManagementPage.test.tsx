// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "../utils/i18n";
import i18n from "../utils/i18n";
import type { ClassWithTimeSlot, TimeSlot } from "../types";
import { DAYS_OF_WEEK } from "../types";
import { GetGradeName } from "@/utils/grades";
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
  teacher: string,
  overrides: Partial<ClassWithTimeSlot> = {}
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
  ...overrides,
});

// The table sorts by day, then title, so rows come out א, ב, ד, then ג
// (the only Monday class).
// Each class differs from k1 (grade 3, Sunday, no track) in at most one
// filterable field, so each filter below narrows to a known set.
const classes = [
  makeClass("k1", "א אמנות", "מירב אלון"),
  makeClass("k2", "ב ביולוגיה", "אורית שמש", { grades: [4] }),
  makeClass("k3", "ג גיאוגרפיה", "מירב אלון", {
    slots: [{ dayOfWeek: 1, timeSlotId: slot.id, timeSlot: slot }],
  }),
  makeClass("k4", "ד דרמה", "Dana Levi", { trackNumber: 1 }),
];

const { getClasses } = vi.hoisted(() => ({ getClasses: vi.fn() }));

vi.mock("../services/api", () => ({
  classesApi: { getClasses },
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

beforeEach(() => {
  getClasses.mockReset();
  getClasses.mockImplementation(() => Promise.resolve(classes));
});

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

const t = (key: string, options?: Record<string, unknown>) =>
  i18n.t(`classManagement.page.${key}`, options);

// A filter label as shown on screen: the text with exactly one trailing
// colon, whether the colon comes from the i18n string or from FilterField.
const shownLabel = (labelKey: string) => `${t(labelKey).replace(/:$/, "")}:`;

// Each filter pair in the bar, in DOM order: a Space whose last item is the
// label. The clear button isn't a pair, so it's skipped.
const filterPairs = () =>
  Array.from(
    document.querySelectorAll(
      ".filters-row > .ant-space:first-child > .ant-space-item > .ant-space"
    )
  );

const filterLabels = () =>
  filterPairs().map(pair => pair.lastElementChild?.textContent?.trim() ?? "");

// A filter's control, found through the label rendered beside it.
const pairFor = (labelKey: string) =>
  filterPairs().find(
    pair => pair.lastElementChild?.textContent?.trim() === shownLabel(labelKey)
  );

const comboboxFor = (labelKey: string) =>
  pairFor(labelKey)?.querySelector("[role=combobox]") as HTMLInputElement;

const pick = (labelKey: string, optionText: string) => {
  fireEvent.mouseDown(comboboxFor(labelKey));
  const option = visibleOptionElements().find(
    o => o.textContent === optionText
  ) as HTMLElement;
  fireEvent.click(option);
};

const typeTitle = (value: string) =>
  fireEvent.change(comboboxFor("searchLabel"), { target: { value } });

const clearFilters = () =>
  fireEvent.click(
    screen.getByRole("button", { name: t("clearFiltersButton") })
  );

const dayName = (key: number) =>
  DAYS_OF_WEEK.find(day => day.key === key)?.name as string;

const allTitles = ["א אמנות", "ב ביולוגיה", "ד דרמה", "ג גיאוגרפיה"];

// Characterization: pins today's filter behaviour so the #174 layout move
// can't change it.
describe("ClassManagementPage filters (current behavior)", () => {
  beforeAll(stubMatchMedia);

  it("narrows by class title", async () => {
    await renderPage();

    typeTitle("ביו");

    expect(rowTitles()).toEqual(["ב ביולוגיה"]);
  });

  it("narrows by grade", async () => {
    await renderPage();

    pick("gradeFilterLabel", GetGradeName(4));

    expect(rowTitles()).toEqual(["ב ביולוגיה"]);
  });

  it("narrows by day", async () => {
    await renderPage();

    pick("dayFilterLabel", dayName(1));

    expect(rowTitles()).toEqual(["ג גיאוגרפיה"]);
  });

  it("narrows by track, including 'no track'", async () => {
    await renderPage();

    pick("trackFilterLabel", t("trackFilterOptionNone"));
    expect(rowTitles()).toEqual(["א אמנות", "ב ביולוגיה", "ג גיאוגרפיה"]);

    pick("trackFilterLabel", t("trackFilterOption", { track: 1 }));
    expect(rowTitles()).toEqual(["ד דרמה"]);
  });

  it("clear resets title, grade, day and track", async () => {
    await renderPage();
    pick("gradeFilterLabel", GetGradeName(3));
    pick("dayFilterLabel", dayName(0));
    pick("trackFilterLabel", t("trackFilterOptionNone"));
    typeTitle("א");
    expect(rowTitles()).toEqual(["א אמנות"]);

    clearFilters();

    expect(rowTitles()).toEqual(allTitles);
    expect(comboboxFor("searchLabel").value).toBe("");
  });

  it("clear also resets the teacher search (#231)", async () => {
    const { teacherBox, typeTeacher } = await renderPage();
    typeTeacher("dana");
    expect(rowTitles()).toEqual(["ד דרמה"]);

    clearFilters();

    expect(teacherBox.value).toBe("");
    expect(rowTitles()).toEqual(allTitles);
  });

  it("refresh locks the controls while it refetches", async () => {
    await renderPage();
    let resolve: (value: ClassWithTimeSlot[]) => void = () => {};
    getClasses.mockImplementationOnce(
      () => new Promise<ClassWithTimeSlot[]>(r => (resolve = r))
    );
    const refresh = () =>
      screen.getByRole("button", {
        name: new RegExp(i18n.t("common.buttons.refresh")),
      }) as HTMLButtonElement;

    fireEvent.click(refresh());

    await waitFor(() => expect(refresh().disabled).toBe(true));
    expect(comboboxFor("gradeFilterLabel").disabled).toBe(true);
    expect(getClasses).toHaveBeenCalledTimes(2);

    resolve(classes);

    await waitFor(() => expect(refresh().disabled).toBe(false));
    expect(comboboxFor("gradeFilterLabel").disabled).toBe(false);
  });
});

const filterGroups = () =>
  Array.from(document.querySelectorAll(".filters-row > .ant-space"));

const textsOf = (root: Element, selector: string) =>
  Array.from(root.querySelectorAll(selector)).map(el => el.textContent?.trim());

// Structural (#174): one shared FiltersBar holds every filter and action.
describe("ClassManagementPage filters bar", () => {
  beforeAll(stubMatchMedia);

  it("renders a single FiltersBar with no caption or old wrappers", async () => {
    await renderPage();

    expect(document.querySelectorAll(".filters-section")).toHaveLength(1);
    expect(screen.queryByText("מסננים")).toBeNull();
    expect(document.querySelector(".header-main")).toBeNull();
    expect(document.querySelector(".class-management-controls")).toBeNull();
  });

  // DOM order. The bar's groups are ltr, so the first child is leftmost:
  // on screen, right to left, class search ... track, then clear.
  it("puts clear first and the class search last (DOM order)", async () => {
    await renderPage();
    const [filters] = filterGroups();

    expect(filters.firstElementChild?.textContent?.trim()).toBe(
      t("clearFiltersButton")
    );
    expect(filterLabels()).toEqual([
      shownLabel("trackFilterLabel"),
      shownLabel("dayFilterLabel"),
      shownLabel("gradeFilterLabel"),
      shownLabel("searchTeacherLabel"),
      shownLabel("searchLabel"),
    ]);
  });

  // Refresh last in the DOM is rightmost of the ltr actions group.
  it("puts Add, then refresh last, in the actions group (DOM order)", async () => {
    await renderPage();
    const groups = filterGroups();

    expect(groups).toHaveLength(2);
    expect(textsOf(groups[1], "button")).toEqual([
      t("addNewClass"),
      i18n.t("common.buttons.refresh"),
    ]);
  });
});

// Characterization (#40): pins the grade filter's behaviour and the filter
// labels, so moving FilterSelect onto FilterField can't change them.
describe("ClassManagementPage grade filter", () => {
  beforeAll(stubMatchMedia);

  it("narrows to the picked grade", async () => {
    await renderPage();

    pick("gradeFilterLabel", GetGradeName(4));

    expect(rowTitles()).toEqual(["ב ביולוגיה"]);
  });

  it("the select's own clear icon brings every row back", async () => {
    await renderPage();
    pick("gradeFilterLabel", GetGradeName(4));
    const clearIcon = pairFor("gradeFilterLabel")?.querySelector(
      ".ant-select-clear"
    ) as HTMLElement;

    fireEvent.mouseDown(clearIcon);

    expect(rowTitles()).toEqual(allTitles);
  });

  it("'clear filters' resets the grade", async () => {
    await renderPage();
    pick("gradeFilterLabel", GetGradeName(4));

    clearFilters();

    expect(rowTitles()).toEqual(allTitles);
    expect(
      pairFor("gradeFilterLabel")?.querySelector(".ant-select-selection-item")
    ).toBeNull();
  });

  it("shows every filter label with a single colon", async () => {
    await renderPage();

    const labels = filterLabels();

    expect(labels).toHaveLength(5);
    labels.forEach(label => expect(label).toMatch(/[^:]:$/));
  });
});

describe("ClassManagementPage clear filters", () => {
  beforeAll(stubMatchMedia);

  const pickFirstOption = (box: HTMLInputElement) => {
    fireEvent.mouseDown(box);
    fireEvent.click(visibleOptionElements()[0]);
  };
  // Picked values in the filters bar only -- the table's page-size Select
  // also shows a selection item once rows are back.
  const selectedItems = () =>
    document.querySelectorAll(".filters-section .ant-select-selection-item");

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
    expect(rowTitles()).toEqual(allTitles);
  });
});
