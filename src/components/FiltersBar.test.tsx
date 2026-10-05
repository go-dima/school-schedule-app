// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import "../utils/i18n";
import i18n from "../utils/i18n";
import { stubMatchMedia } from "../testUtils/antdDom";
import { FiltersBar } from "./FiltersBar";

const groups = () =>
  Array.from(document.querySelectorAll(".filters-row > .ant-space"));

const refreshButton = () =>
  screen.getByRole("button", {
    name: new RegExp(i18n.t("common.buttons.refresh")),
  }) as HTMLButtonElement;

describe("FiltersBar", () => {
  beforeAll(stubMatchMedia);

  it("puts children in the first group and actions, then refresh, in the second (DOM order)", () => {
    render(
      <FiltersBar actions={<button>action</button>} canRefresh>
        <span>filter-a</span>
        <span>filter-b</span>
      </FiltersBar>
    );

    const [filters, actions] = groups();
    expect(filters.textContent).toBe("filter-afilter-b");
    const buttons = Array.from(actions.querySelectorAll("button"));
    expect(buttons.map(b => b.textContent?.trim())).toEqual([
      "action",
      i18n.t("common.buttons.refresh"),
    ]);
  });

  it("renders no actions group when there are no actions and no refresh", () => {
    render(
      <FiltersBar>
        <span>filter</span>
      </FiltersBar>
    );

    expect(groups()).toHaveLength(1);
  });

  it("calls onRefresh when refresh is clicked", () => {
    const onRefresh = vi.fn();
    render(
      <FiltersBar canRefresh onRefresh={onRefresh}>
        <span>filter</span>
      </FiltersBar>
    );

    fireEvent.click(refreshButton());

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("shows refresh as loading while refreshing", () => {
    render(
      <FiltersBar canRefresh refreshing>
        <span>filter</span>
      </FiltersBar>
    );

    expect(refreshButton().classList.contains("ant-btn-loading")).toBe(true);
  });

  it("locks the whole bar when disabled", () => {
    render(
      <FiltersBar canRefresh disabled actions={<button>action</button>}>
        <input aria-label="filter" />
      </FiltersBar>
    );

    const section = document.querySelector(
      ".filters-section"
    ) as HTMLFieldSetElement;
    expect(section.disabled).toBe(true);
    expect(section.classList.contains("filters-section--disabled")).toBe(true);
    expect(refreshButton().disabled).toBe(true);
  });

  it("defaults to the boxed variant", () => {
    render(
      <FiltersBar>
        <span>filter</span>
      </FiltersBar>
    );

    const section = document.querySelector(".filters-section") as HTMLElement;
    expect(section.classList.contains("filters-section--boxed")).toBe(true);
    expect(section.classList.contains("filters-section--disabled")).toBe(false);
  });

  it("renders the flat variant", () => {
    render(
      <FiltersBar variant="flat">
        <span>filter</span>
      </FiltersBar>
    );

    const section = document.querySelector(".filters-section") as HTMLElement;
    expect(section.classList.contains("filters-section--flat")).toBe(true);
  });
});
