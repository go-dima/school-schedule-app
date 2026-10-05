// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { FilterSelect } from "./FilterSelect";
import {
  stubMatchMedia,
  visibleOptionElements,
  visibleOptions,
} from "../testUtils/antdDom";

const options = [
  { value: 1, label: "א׳" },
  { value: 2, label: "ב׳" },
  { value: 4, label: "ד׳" },
];

const renderSelect = (
  props: Partial<ComponentProps<typeof FilterSelect<number>>> = {}
) => {
  const onChange = vi.fn();
  render(
    <FilterSelect<number>
      label="כיתה"
      placeholder="כל הכיתות"
      value={null}
      onChange={onChange}
      options={options}
      {...props}
    />
  );
  return { onChange };
};

const combobox = () => screen.getByRole("combobox");
const clearButton = () => screen.queryByRole("button");

describe("FilterSelect", () => {
  beforeAll(stubMatchMedia);

  it("renders the control, then its label with one colon (DOM order)", () => {
    const { container } = render(
      <FilterSelect<number>
        label="כיתה"
        value={null}
        onChange={() => {}}
        options={options}
      />
    );
    const items = Array.from(
      container.querySelectorAll(".ant-space > .ant-space-item")
    );

    const [control, label] = items.slice(-2);

    expect(label.textContent).toBe("כיתה:");
    expect(control.querySelector("[role=combobox]")).not.toBeNull();
  });

  it("names the combobox after its label", () => {
    renderSelect();

    expect(screen.getByRole("combobox", { name: "כיתה" })).toBeTruthy();
  });

  it("sizes the select through a class, not an inline style", () => {
    renderSelect();
    const select = combobox().closest(".ant-select") as HTMLElement;

    expect(select.classList).toContain("filter-select");
    expect(select.getAttribute("style")).toBeNull();
  });

  it("lists the options in order", () => {
    renderSelect();

    fireEvent.mouseDown(combobox());

    expect(visibleOptions()).toEqual(["א׳", "ב׳", "ד׳"]);
  });

  it("calls onChange with the picked value", () => {
    const { onChange } = renderSelect();
    fireEvent.mouseDown(combobox());

    fireEvent.click(
      visibleOptionElements().find(o => o.textContent === "ד׳") as HTMLElement
    );

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("shows the placeholder and no X when the value is null", () => {
    renderSelect();

    expect(screen.getByText("כל הכיתות")).toBeTruthy();
    expect(clearButton()).toBeNull();
  });

  it("shows the X when a value is set, and the X clears to null", () => {
    const { onChange } = renderSelect({ value: 2 });

    fireEvent.click(clearButton() as HTMLElement);

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("puts the X before the select, with no inline style (DOM order)", () => {
    renderSelect({ value: 2 });
    const x = clearButton() as HTMLElement;

    expect(x.classList).toContain("filter-select__clear");
    expect(x.getAttribute("style")).toBeNull();
    expect(
      x.compareDocumentPosition(combobox()) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("the select's own clear icon also clears to null", () => {
    const { onChange } = renderSelect({ value: 2 });

    fireEvent.mouseDown(
      document.querySelector(".ant-select-clear") as HTMLElement
    );

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("blocks the select and the X when disabled", () => {
    renderSelect({ value: 2, disabled: true });

    fireEvent.mouseDown(combobox());

    expect(visibleOptionElements()).toEqual([]);
    expect((clearButton() as HTMLButtonElement).disabled).toBe(true);
    expect((combobox() as HTMLInputElement).disabled).toBe(true);
  });
});
