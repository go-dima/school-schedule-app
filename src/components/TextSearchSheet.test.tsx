// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../utils/i18n";
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

  it("shows no clear control while nothing is picked", () => {
    render(<Demo />);
    expect(
      screen.queryByRole("button", { name: i18n.t("common.clear") })
    ).toBeNull();
  });

  it("clears through a visible clear control, reporting undefined", () => {
    const onSelect = vi.fn();
    render(<Demo onSelect={onSelect} />);
    fireEvent.click(field());
    fireEvent.click(screen.getByRole("option", { name: "Noa Cohen" }));
    onSelect.mockClear();

    // getByRole skips `visibility: hidden` elements, which is how rc-input
    // hides `allowClear` on a read-only field.
    const clear = screen.getByRole("button", { name: i18n.t("common.clear") });
    expect(getComputedStyle(clear).visibility).not.toBe("hidden");
    fireEvent.click(clear);

    expect(onSelect).toHaveBeenCalledWith(undefined);
    expect((field() as HTMLInputElement).value).toBe("");
    expect(screen.queryAllByRole("option")).toEqual([]);
    expect(
      screen.queryByRole("button", { name: i18n.t("common.clear") })
    ).toBeNull();
  });

  it("lists an item whose key repeats only once", () => {
    render(
      <TextSearchSheet<Person>
        mode="pick"
        items={[...PEOPLE, { id: "p2", name: "Yoav Levi (copy)" }]}
        getText={p => p.name}
        getKey={p => p.id}
        value={undefined}
        placeholder="pick"
        onSelect={() => {}}
      />
    );
    fireEvent.click(field());
    expect(options()).toEqual(["Noa Cohen", "Yoav Levi", "Dana Levi"]);
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
