// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "../utils/i18n";
import type { Child } from "../types";
import { GetGradeName } from "@/utils/grades";
import { ChildTabs } from "./ChildTabs";

const makeChild = (
  id: string,
  firstName: string,
  grade: number,
  groupNumber: number | null
): Child => ({
  id,
  firstName,
  lastName: "כהן",
  grade,
  groupNumber,
  trackNumber: null,
  scope: "test",
  createdBy: null,
  createdByName: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

const A = makeChild("a", "אבי", 1, null);
const B = makeChild("b", "בני", 2, 1);
const C = makeChild("c", "גלי", 3, 2);
const ALL = [A, B, C];

const ADD_LABEL = "הוסף ילד";

const renderTabs = (props: Partial<ComponentProps<typeof ChildTabs>> = {}) => {
  const onSelect = vi.fn();
  const onAddClick = vi.fn();
  const utils = render(
    <ChildTabs
      childList={ALL}
      selectedChildId={B.id}
      onSelect={onSelect}
      onAddClick={onAddClick}
      {...props}
    />
  );
  return { ...utils, onSelect, onAddClick };
};

// The `.ant-tabs-tab` wrapper that owns a given role="tab" button.
const tabWrapper = (tab: HTMLElement) =>
  tab.closest(".ant-tabs-tab") as HTMLElement;

const activeTabs = () =>
  screen
    .getAllByRole("tab")
    .filter(tab => tabWrapper(tab).classList.contains("ant-tabs-tab-active"));

describe("ChildTabs", () => {
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

  afterEach(() => cleanup());

  it("renders one tab per child in order, with the add button after them", () => {
    renderTabs();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(3);
    expect(tabs[0].textContent?.includes(A.firstName)).toBe(true);
    expect(tabs[1].textContent?.includes(B.firstName)).toBe(true);
    expect(tabs[2].textContent?.includes(C.firstName)).toBe(true);

    const add = screen.getByRole("button", { name: ADD_LABEL });
    const position = tabs[2].compareDocumentPosition(add);
    expect(Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("marks only the selected child as active", () => {
    renderTabs({ selectedChildId: B.id });
    const active = activeTabs();
    expect(active.length).toBe(1);
    expect(active[0].textContent?.includes(B.firstName)).toBe(true);

    const selected = screen
      .getAllByRole("tab")
      .filter(tab => tab.getAttribute("aria-selected") === "true");
    expect(selected.length).toBe(1);
    expect(selected[0].textContent?.includes(B.firstName)).toBe(true);
  });

  it("marks no tab active when nothing is selected", () => {
    renderTabs({ selectedChildId: undefined });
    expect(activeTabs().length).toBe(0);
    const selected = screen
      .getAllByRole("tab")
      .filter(tab => tab.getAttribute("aria-selected") === "true");
    expect(selected.length).toBe(0);
  });

  it("calls onSelect with the clicked child", () => {
    const { onSelect, onAddClick } = renderTabs();
    const tabC = screen
      .getAllByRole("tab")
      .find(tab => tab.textContent?.includes(C.firstName)) as HTMLElement;
    fireEvent.click(tabC);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBe(C);
    expect(onAddClick).not.toHaveBeenCalled();
  });

  it("calls onAddClick from the add button without changing selection", () => {
    const { onSelect, onAddClick } = renderTabs({ selectedChildId: B.id });
    fireEvent.click(screen.getByRole("button", { name: ADD_LABEL }));
    expect(onAddClick).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    const active = activeTabs();
    expect(active.length).toBe(1);
    expect(active[0].textContent?.includes(B.firstName)).toBe(true);
  });

  it("shows the grade name and group number in the label", () => {
    renderTabs();
    const tabC = screen
      .getAllByRole("tab")
      .find(tab => tab.textContent?.includes(C.firstName)) as HTMLElement;
    expect(
      tabC.textContent?.includes(`(${GetGradeName(C.grade)}${C.groupNumber})`)
    ).toBe(true);
  });

  it("renders only the add button when there are no children", () => {
    renderTabs({ childList: [], selectedChildId: undefined });
    expect(screen.queryAllByRole("tab").length).toBe(0);
    expect(screen.getByRole("button", { name: ADD_LABEL })).toBeTruthy();
  });
});
