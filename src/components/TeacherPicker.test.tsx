// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { StaffMember } from "../services/staffScheduleService";
import { TeacherPicker } from "./TeacherPicker";

const members: StaffMember[] = [
  { key: { kind: "user", id: "user-1" }, label: "אורית שמש", teaches: true },
  { key: { kind: "user", id: "user-2" }, label: "מירב אלון", teaches: true },
  { key: { kind: "name", name: "עידו כץ" }, label: "עידו כץ", teaches: true },
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

const visibleOptions = () =>
  Array.from(
    document.querySelectorAll(
      ".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option"
    )
  ).map(o => o.textContent);

describe("TeacherPicker", () => {
  it("narrows the suggestions to names containing the typed text", () => {
    render(<Controlled />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "מי" } });

    expect(visibleOptions()).toEqual(["מירב אלון"]);
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
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    fireEvent.blur(input);

    expect(input.value).toBe("מורה חדש");
    expect(onChange).toHaveBeenLastCalledWith("מורה חדש");
  });
});
