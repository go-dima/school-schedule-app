// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import "../utils/i18n";
import { stubMatchMedia } from "../testUtils/antdDom";
import { TextSearchSheet } from "./TextSearchSheet";

interface Person {
  id: string;
  name: string;
}

const PEOPLE: Person[] = [
  { id: "p1", name: "Noa Cohen" },
  { id: "p2", name: "Yoav Levi" },
  { id: "p3", name: "Dana Levi" },
];

const Demo = ({
  onSelect,
  onExtra,
}: {
  onSelect?: (p: Person | undefined) => void;
  onExtra?: (q: string) => void;
}) => {
  const [value, setValue] = useState<string | undefined>();
  return (
    <TextSearchSheet<Person>
      mode="pick"
      items={PEOPLE}
      getText={p => p.name}
      getKey={p => p.id}
      value={value}
      placeholder="pick"
      extraOption={
        onExtra
          ? { label: q => <span>{`add ${q}`}</span>, onSelect: onExtra }
          : undefined
      }
      onSelect={p => {
        setValue(p?.id);
        onSelect?.(p);
      }}
    />
  );
};

const field = () => screen.getAllByPlaceholderText("pick")[0];
const options = () => screen.queryAllByRole("option").map(o => o.textContent);

describe("TextSearchSheet", () => {
  beforeAll(stubMatchMedia);

  it("opens on tap and lists every item", () => {
    render(<Demo />);
    expect(options()).toEqual([]);
    fireEvent.click(field());
    expect(options()).toEqual(["Noa Cohen", "Yoav Levi", "Dana Levi"]);
  });

  it("narrows by the typed text, trimmed and case-insensitive", () => {
    render(<Demo />);
    fireEvent.click(field());
    const search = screen.getAllByPlaceholderText("pick")[1];
    fireEvent.change(search, { target: { value: " LEVI" } });
    expect(options()).toEqual(["Yoav Levi", "Dana Levi"]);
  });

  it("picking a row reports the item and shows it in the field", () => {
    const onSelect = vi.fn();
    render(<Demo onSelect={onSelect} />);
    fireEvent.click(field());
    fireEvent.click(screen.getByRole("option", { name: "Yoav Levi" }));

    expect(onSelect).toHaveBeenCalledWith(PEOPLE[1]);
    expect((field() as HTMLInputElement).value).toBe("Yoav Levi");
  });

  it("clearing reports undefined", () => {
    const onSelect = vi.fn();
    render(<Demo onSelect={onSelect} />);
    fireEvent.click(field());
    fireEvent.click(screen.getByRole("option", { name: "Noa Cohen" }));
    onSelect.mockClear();

    fireEvent.click(document.querySelector(".ant-input-clear-icon")!);
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });

  it("offers the extra row only when nothing matches", () => {
    const onExtra = vi.fn();
    render(<Demo onExtra={onExtra} />);
    fireEvent.click(field());
    const search = screen.getAllByPlaceholderText("pick")[1];
    fireEvent.change(search, { target: { value: "zzz" } });

    expect(options()).toEqual([]);
    fireEvent.click(screen.getByText("add zzz"));
    expect(onExtra).toHaveBeenCalledWith("zzz");
  });
});
