// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToggleRadioGroup } from "./ToggleRadioGroup";

type Role = "staff" | "parent" | "child";

const OPTIONS = [
  { value: "staff" as const, label: "צוות", color: "orange" as const },
  { value: "parent" as const, label: "הורה", color: "blue" as const },
  { value: "child" as const, label: "תלמיד", color: "green" as const },
];

const renderGroup = (value: Role | undefined, dir: "rtl" | "ltr" = "rtl") => {
  const onChange = vi.fn();
  render(
    <div dir={dir}>
      <ToggleRadioGroup<Role>
        options={OPTIONS}
        value={value}
        onChange={onChange}
        aria-label="role"
      />
    </div>
  );
  return { onChange };
};

afterEach(cleanup);

describe("ToggleRadioGroup", () => {
  it("renders a radiogroup with nothing checked when value is undefined", () => {
    renderGroup(undefined);
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    radios.forEach(r => expect(r.getAttribute("aria-checked")).toBe("false"));
    // With nothing checked, the first option is the Tab stop.
    expect(radios.map(r => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it("marks the selected option checked, with its role color", () => {
    renderGroup("parent");
    const parent = screen.getByRole("radio", { name: "הורה" });
    expect(parent.getAttribute("aria-checked")).toBe("true");
    expect(parent.className).toContain(
      "toggle-filter-group__option--active-blue"
    );
    expect(parent.tabIndex).toBe(0);
    expect(screen.getByRole("radio", { name: "צוות" }).className).not.toContain(
      "--active"
    );
  });

  it("calls onChange with the clicked value", () => {
    const { onChange } = renderGroup(undefined);
    fireEvent.click(screen.getByRole("radio", { name: "תלמיד" }));
    expect(onChange).toHaveBeenCalledWith("child");
  });

  it("does not call onChange when clicking the already-selected option", () => {
    const { onChange } = renderGroup("child");
    fireEvent.click(screen.getByRole("radio", { name: "תלמיד" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ArrowLeft selects the next option in RTL", () => {
    const { onChange } = renderGroup("staff", "rtl");
    fireEvent.keyDown(screen.getByRole("radio", { name: "צוות" }), {
      key: "ArrowLeft",
    });
    expect(onChange).toHaveBeenCalledWith("parent");
  });

  it("ArrowRight selects the next option in LTR", () => {
    const { onChange } = renderGroup("staff", "ltr");
    fireEvent.keyDown(screen.getByRole("radio", { name: "צוות" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenCalledWith("parent");
  });

  it("ArrowDown/ArrowUp wrap around", () => {
    const { onChange } = renderGroup("child");
    fireEvent.keyDown(screen.getByRole("radio", { name: "תלמיד" }), {
      key: "ArrowDown",
    });
    expect(onChange).toHaveBeenLastCalledWith("staff");
    fireEvent.keyDown(screen.getByRole("radio", { name: "תלמיד" }), {
      key: "ArrowUp",
    });
    expect(onChange).toHaveBeenLastCalledWith("parent");
  });
});
