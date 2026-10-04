// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "../utils/i18n";
import i18n from "../utils/i18n";
import type { ClassWithTimeSlot, EnrolledChild, TimeSlot } from "../types";

const getClassEnrolledChildren = vi.fn();
const printClassRoster = vi.fn();

vi.mock("../services/api", () => ({
  scheduleApi: {
    getClassEnrolledChildren: (id: string) => getClassEnrolledChildren(id),
  },
  classesApi: { updateClass: vi.fn() },
}));
vi.mock("../hooks/useStaffMembers", () => ({
  useStaffMembers: () => ({ members: [], loading: false }),
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ roleFlags: { isAdmin: false } }),
}));
vi.mock("../contexts/AllChildrenContext", () => ({
  useAllChildrenContext: () => ({ createChild: vi.fn() }),
}));
vi.mock("../services/supabase", () => ({ supabase: {} }));
vi.mock("../utils/env", () => ({
  isTestScopeEnabled: () => true,
  getAllowedScopes: () => ["prod", "test"],
  env: {},
}));
vi.mock("@/utils/printClassRoster", () => ({
  printClassRoster: (args: unknown) => printClassRoster(args),
}));

const { default: ClassEnrollmentDrawer } = await import(
  "./ClassEnrollmentDrawer"
);

const slot: TimeSlot = {
  id: "slot-1",
  name: "שיעור ראשון",
  startTime: "08:00",
  endTime: "08:45",
  createdAt: "",
  updatedAt: "",
};

const makeClass = (id: string): ClassWithTimeSlot => ({
  id,
  title: "מתמטיקה",
  description: "",
  teacher: "דנה כהן",
  userId: null,
  slots: [{ dayOfWeek: 0, timeSlotId: slot.id, timeSlot: slot }],
  grades: [3],
  isMandatory: false,
  isDouble: false,
  groupNumber: null,
  trackNumber: null,
  room: "",
  scope: "test",
  createdAt: "",
  updatedAt: "",
});

const makeChild = (
  id: string,
  firstName: string,
  lastName: string
): EnrolledChild =>
  ({
    id,
    firstName,
    lastName,
    grade: 3,
    groupNumber: 1,
    trackNumber: null,
    scope: "test",
    createdAt: "",
    updatedAt: "",
    addedByUserId: "u1",
    addedByFirstName: null,
    addedByLastName: null,
    addedByDisplayName: null,
    addedByAt: "",
  }) as EnrolledChild;

const roster = [
  makeChild("c1", "נועה", "כהן"),
  makeChild("c2", "יואב", "לוי"),
  makeChild("c3", "נועם", "פרץ"),
];

const renderDrawer = (classInfo = makeClass("class-1"), open = true) => {
  const props = {
    onClose: () => {},
    onEdit: () => {},
    onDelete: () => {},
    onUpdated: () => {},
  };
  const view = render(
    <ClassEnrollmentDrawer {...props} open={open} classInfo={classInfo} />
  );
  return {
    ...view,
    rerenderWith: (next: ClassWithTimeSlot, nextOpen = true) =>
      view.rerender(
        <ClassEnrollmentDrawer {...props} open={nextOpen} classInfo={next} />
      ),
  };
};

// The roster search is the drawer's only combobox while nothing is being
// edited inline (antd renders the AutoComplete placeholder as a span).
const searchBox = () => screen.getByRole("combobox");

const typeSearch = (value: string) =>
  fireEvent.change(searchBox(), { target: { value } });

const rosterNames = () =>
  Array.from(document.querySelectorAll(".roster-item-name")).map(
    el => el.textContent
  );

describe("ClassEnrollmentDrawer roster search", () => {
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

  beforeEach(() => {
    getClassEnrolledChildren.mockReset().mockResolvedValue(roster);
    printClassRoster.mockReset().mockResolvedValue(undefined);
  });

  it("filters the roster by name and shows the filtered count", async () => {
    renderDrawer();
    await screen.findByText(
      i18n.t("schedule.enrollment.students", { count: 3 })
    );

    typeSearch("נוע");

    expect(rosterNames()).toEqual(["נועה כהן", "נועם פרץ"]);
    expect(
      screen.getByText(
        i18n.t("classManagement.enrollmentDrawer.filteredCount", {
          shown: 2,
          count: 3,
        })
      )
    ).toBeTruthy();
  });

  it("does not trim the search", async () => {
    renderDrawer();
    await screen.findByText(
      i18n.t("schedule.enrollment.students", { count: 3 })
    );

    typeSearch(" נוע");

    expect(rosterNames()).toEqual([]);
  });

  it("filters the list in place without a suggestions dropdown", async () => {
    renderDrawer();
    await screen.findByText(
      i18n.t("schedule.enrollment.students", { count: 3 })
    );

    fireEvent.mouseDown(searchBox());
    typeSearch("נוע");

    expect(document.querySelectorAll(".ant-select-item-option")).toHaveLength(
      0
    );
  });

  it("keeps the search visible and shows an empty state when nothing matches", async () => {
    renderDrawer();
    await screen.findByText(
      i18n.t("schedule.enrollment.students", { count: 3 })
    );

    typeSearch("xyz");

    expect(searchBox()).toBeTruthy();
    expect(rosterNames()).toEqual([]);
    expect(
      screen.getByText(
        i18n.t("classManagement.enrollmentDrawer.noSearchResults")
      )
    ).toBeTruthy();
  });

  it("prints the full roster even while filtering", async () => {
    renderDrawer();
    await screen.findByText(
      i18n.t("schedule.enrollment.students", { count: 3 })
    );
    typeSearch("יואב");

    fireEvent.click(screen.getByTitle(i18n.t("schedule.page.exportButton")));

    await waitFor(() => expect(printClassRoster).toHaveBeenCalled());
    expect(printClassRoster.mock.calls[0][0].children).toEqual(roster);
  });

  it("resets the search when switching to another class", async () => {
    const { rerenderWith } = renderDrawer();
    await screen.findByText(
      i18n.t("schedule.enrollment.students", { count: 3 })
    );
    typeSearch("יואב");

    rerenderWith(makeClass("class-2"));
    await waitFor(() => expect(rosterNames()).toHaveLength(3));

    expect((searchBox() as HTMLInputElement).value).toBe("");
  });

  it("keeps the search when the same class is updated in place", async () => {
    const { rerenderWith } = renderDrawer();
    await screen.findByText(
      i18n.t("schedule.enrollment.students", { count: 3 })
    );
    typeSearch("יואב");

    rerenderWith({ ...makeClass("class-1"), room: "101" });

    expect((searchBox() as HTMLInputElement).value).toBe("יואב");
    expect(rosterNames()).toEqual(["יואב לוי"]);
  });
});
