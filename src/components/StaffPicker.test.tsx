// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { StaffMember } from "../services/staffScheduleService";
import {
  pressEnter,
  shownText,
  stubMatchMedia,
  visibleOptionElements,
  visibleOptions,
} from "../testUtils/antdDom";
import { StaffPicker } from "./StaffPicker";

// Service order: staff with lessons first, then the rest (grayed).
const members: StaffMember[] = [
  { key: { kind: "user", id: "user-1" }, label: "אורית שמש", teaches: true },
  {
    key: { kind: "name", name: "Dana Levi" },
    label: "Dana Levi",
    teaches: true,
  },
  { key: { kind: "user", id: "user-2" }, label: "מירב אלון", teaches: false },
];

const Controlled = ({
  initial,
  onChange,
}: {
  initial?: string;
  onChange?: (v: string | undefined) => void;
}) => {
  const [value, setValue] = useState<string | undefined>(initial);
  return (
    <StaffPicker
      members={members}
      value={value}
      onChange={v => {
        setValue(v);
        onChange?.(v);
      }}
      placeholder="בחר איש צוות"
    />
  );
};

const input = () => screen.getByRole("combobox") as HTMLInputElement;
const type = (value: string) =>
  fireEvent.change(input(), { target: { value } });
// Grayed: the option itself or its rendered content carries the class.
const isGrayed = (option: HTMLElement) =>
  option.classList.contains("staff-option--no-lessons") ||
  !!option.querySelector(".staff-option--no-lessons");

describe("StaffPicker", () => {
  beforeAll(stubMatchMedia);

  it("lists every member on open, grayed no-lesson staff last", () => {
    render(<Controlled />);
    fireEvent.mouseDown(input());

    expect(visibleOptions()).toEqual(["אורית שמש", "Dana Levi", "מירב אלון"]);
    expect(visibleOptionElements().map(isGrayed)).toEqual([false, false, true]);
  });

  it("narrows the options to labels containing the typed text", () => {
    render(<Controlled />);
    fireEvent.mouseDown(input());
    type("מי");

    expect(visibleOptions()).toEqual(["מירב אלון"]);
  });

  it("matches case-insensitively", () => {
    render(<Controlled />);
    fireEvent.mouseDown(input());
    type("dana");

    expect(visibleOptions()).toEqual(["Dana Levi"]);
  });

  it("trims the typed text", () => {
    render(<Controlled />);
    fireEvent.mouseDown(input());
    type(" dana ");

    expect(visibleOptions()).toEqual(["Dana Levi"]);
  });

  it("selects the clicked member and reports its param", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    fireEvent.mouseDown(input());
    type("מי");
    fireEvent.click(visibleOptionElements()[0]);

    expect(onChange).toHaveBeenLastCalledWith("user-2");
    expect(shownText()).toBe("מירב אלון");
  });

  it("picks the highlighted option on Enter", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    fireEvent.mouseDown(input());
    type("dana");
    pressEnter(input());

    expect(onChange).toHaveBeenLastCalledWith("Dana Levi");
  });

  it("keeps the selection while typing and shows it again on blur", () => {
    const onChange = vi.fn();
    render(<Controlled initial="user-1" onChange={onChange} />);
    expect(shownText()).toBe("אורית שמש");

    fireEvent.mouseDown(input());
    type("xyz");
    fireEvent.blur(input());

    expect(onChange).not.toHaveBeenCalled();
    expect(shownText()).toBe("אורית שמש");
  });

  it("does not gray the selected value itself", () => {
    render(<Controlled initial="user-2" />);

    const selected = document.querySelector(".ant-select-selector")!;
    expect(selected.textContent).toBe("מירב אלון");
    expect(selected.querySelector(".staff-option--no-lessons")).toBeNull();
  });

  it("clears to undefined", () => {
    const onChange = vi.fn();
    render(<Controlled initial="user-1" onChange={onChange} />);
    fireEvent.mouseDown(document.querySelector(".ant-select-clear")!);

    expect(onChange).toHaveBeenLastCalledWith(undefined);
    expect(shownText()).toBe("");
  });

  it("shows an unknown param as-is", () => {
    render(<Controlled initial="מורה שלא ברשימה" />);

    expect(shownText()).toBe("מורה שלא ברשימה");
  });
});
