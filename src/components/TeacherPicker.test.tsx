// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { StaffMember } from "../services/staffScheduleService";
import {
  pressEnter,
  stubMatchMedia,
  visibleOptionElements,
  visibleOptions,
} from "../testUtils/antdDom";
import { TeacherPicker } from "./TeacherPicker";

const members: StaffMember[] = [
  { key: { kind: "user", id: "user-1" }, label: "אורית שמש", teaches: true },
  { key: { kind: "user", id: "user-2" }, label: "מירב אלון", teaches: true },
  { key: { kind: "name", name: "עידו כץ" }, label: "עידו כץ", teaches: true },
  {
    key: { kind: "name", name: "Dana Levi" },
    label: "Dana Levi",
    teaches: true,
  },
];

const Controlled = ({ onChange }: { onChange?: (v: string) => void }) => {
  const [value, setValue] = useState<string>("");
  return (
    <TeacherPicker
      members={members}
      value={value}
      onChange={v => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
};

describe("TeacherPicker", () => {
  beforeAll(stubMatchMedia);

  it("shows every staff member on focus, before typing", () => {
    render(<Controlled />);
    fireEvent.mouseDown(screen.getByRole("combobox"));

    expect(visibleOptions()).toEqual([
      "אורית שמש",
      "מירב אלון",
      "עידו כץ",
      "Dana Levi",
    ]);
  });

  it("narrows the suggestions to names containing the typed text", () => {
    render(<Controlled />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "מי" } });

    expect(visibleOptions()).toEqual(["מירב אלון"]);
  });

  it("trims the typed text before matching", () => {
    render(<Controlled />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "  מי " } });

    expect(visibleOptions()).toEqual(["מירב אלון"]);
  });

  it("matches case-sensitively", () => {
    render(<Controlled />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "dana" } });

    expect(visibleOptions()).toEqual([]);
  });

  it("fills in the picked suggestion's name", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "מי" } });
    fireEvent.click(visibleOptionElements()[0]);

    expect(onChange).toHaveBeenLastCalledWith("מירב אלון");
    expect(input.value).toBe("מירב אלון");
  });

  it("keeps the typed text on Enter even when a suggestion matches", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "מי" } });
    pressEnter(input);

    expect(input.value).toBe("מי");
    expect(onChange).toHaveBeenLastCalledWith("מי");
  });

  it("shows no suggestions for a name that isn't listed", () => {
    render(<Controlled />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "מורה חדש" } });

    expect(visibleOptions()).toEqual([]);
  });

  it("keeps free text that matches no staff member, including on Enter", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "מורה חדש" } });
    pressEnter(input);
    fireEvent.blur(input);

    expect(input.value).toBe("מורה חדש");
    expect(onChange).toHaveBeenLastCalledWith("מורה חדש");
  });
});
