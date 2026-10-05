// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import "../utils/i18n";
import i18n from "../utils/i18n";
import type { Child } from "../types";
import { GetGradeName } from "@/utils/grades";
import {
  stubMatchMedia,
  visibleOptionElements,
  visibleOptions,
} from "../testUtils/antdDom";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    roleFlags: { isAdmin: false, isParent: false },
    user: { id: "me" },
    permissions: { canManageRoster: true },
  }),
}));
vi.mock("../services/api", () => ({ childrenApi: {} }));
vi.mock("../utils/env", () => ({
  isTestScopeEnabled: () => false,
  getAllowedScopes: () => ["prod"],
  env: {},
}));
vi.mock("../utils/analytics", () => ({
  trackEvent: vi.fn(),
  AnalyticsEvent: {},
}));

const makeChild = (
  id: string,
  firstName: string,
  lastName: string,
  grade: number
) =>
  ({
    id,
    firstName,
    lastName,
    grade,
    groupNumber: 1,
    trackNumber: null,
    scope: "prod",
    createdAt: "2026-09-01",
    updatedAt: "",
    createdByName: null,
    assignedParent: true,
  }) as unknown as Child;

const children = [
  makeChild("c1", "נועה", "כהן", 3),
  makeChild("c2", "נועם", "לוי", 4),
  makeChild("c3", "Dana", "Levi", 3),
];

vi.mock("../contexts/AllChildrenContext", () => ({
  useAllChildrenContext: () => ({
    children,
    loading: false,
    error: null,
    createChild: vi.fn(),
    updateChild: vi.fn(),
    removeChild: vi.fn(),
    refetch: vi.fn(),
  }),
}));

const { default: StudentsPage } = await import("./StudentsPage");

// The name search comes first in the filters row, then the grade filter.
const searchBox = () => screen.getAllByRole("combobox")[0] as HTMLInputElement;
const typeSearch = (value: string) =>
  fireEvent.change(searchBox(), { target: { value } });

const tableNames = () =>
  Array.from(document.querySelectorAll(".ant-table-row")).map(row =>
    row.querySelector("td")?.textContent?.trim()
  );

const pickGrade = (grade: number) => {
  const gradeSelect = screen.getAllByRole("combobox")[1];
  fireEvent.mouseDown(gradeSelect);
  const dropdown = document.querySelector(
    ".ant-select-dropdown:not(.ant-select-dropdown-hidden)"
  ) as HTMLElement;
  fireEvent.click(within(dropdown).getByText(GetGradeName(grade)));
};

describe("StudentsPage name search (current behavior)", () => {
  beforeAll(stubMatchMedia);

  it("lists every student before searching", () => {
    render(<StudentsPage />);

    expect(tableNames()).toEqual(["נועה כהן", "נועם לוי", "Dana Levi"]);
  });

  it("filters the table by name, case-insensitively", () => {
    render(<StudentsPage />);

    typeSearch("נוע");
    expect(tableNames()).toEqual(["נועה כהן", "נועם לוי"]);

    typeSearch("DANA");
    expect(tableNames()).toEqual(["Dana Levi"]);
  });

  it("trims the search", () => {
    render(<StudentsPage />);

    typeSearch(" נוע ");

    expect(tableNames()).toEqual(["נועה כהן", "נועם לוי"]);
  });

  it("combines the name search with the grade filter", () => {
    render(<StudentsPage />);

    pickGrade(3);
    expect(tableNames()).toEqual(["נועה כהן", "Dana Levi"]);

    typeSearch("נוע");
    expect(tableNames()).toEqual(["נועה כהן"]);
  });

  it("suggests the matching names", () => {
    render(<StudentsPage />);

    typeSearch("נוע");

    expect(visibleOptions()).toEqual(["נועה כהן", "נועם לוי"]);
  });

  it("suggests only students that pass the grade filter", () => {
    render(<StudentsPage />);
    pickGrade(4);

    typeSearch("נוע");

    expect(visibleOptions()).toEqual(["נועם לוי"]);
  });

  it("fills in a picked suggestion and filters to it", () => {
    render(<StudentsPage />);
    typeSearch("נוע");

    fireEvent.click(visibleOptionElements()[1]);

    expect(searchBox().value).toBe("נועם לוי");
    expect(tableNames()).toEqual(["נועם לוי"]);
  });

  it("offers to add a student when nothing matches", () => {
    render(<StudentsPage />);

    typeSearch("שירה גל");

    expect(visibleOptions()).toEqual([
      i18n.t("students.search.addStudent", { name: "שירה גל" }),
    ]);
  });
});

// Structural (#174): the row is the shared FiltersBar, not a styled div.
describe("StudentsPage filters bar", () => {
  beforeAll(stubMatchMedia);

  it("puts the filters and the Add button in one FiltersBar", () => {
    render(<StudentsPage />);

    const sections = document.querySelectorAll(".filters-section");
    expect(sections).toHaveLength(1);
    // DOM order: search, then grade, in the filters group; Add in actions.
    // The groups are ltr, so on screen grade is rightmost, then search.
    const [filters, actions] = Array.from(
      sections[0].querySelectorAll(".filters-row > .ant-space")
    );
    expect(within(filters as HTMLElement).getAllByRole("combobox")).toEqual(
      screen.getAllByRole("combobox").slice(0, 2)
    );
    expect(
      within(actions as HTMLElement)
        .getAllByRole("button")
        .map(b => b.textContent?.trim())
    ).toEqual([i18n.t("students.page.addButton")]);
  });

  it("has no inline style on the bar or its wrapper", () => {
    render(<StudentsPage />);

    const section = document.querySelector(".filters-section") as HTMLElement;
    expect(section.hasAttribute("style")).toBe(false);
    expect(section.parentElement?.hasAttribute("style")).toBe(false);
    expect(document.querySelector(".page-content > [style]")).toBeNull();
  });
});
