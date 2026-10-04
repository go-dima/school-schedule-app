// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  pressEnter,
  shownText,
  stubMatchMedia,
  visibleOptionElements,
  visibleOptions,
} from "../testUtils/antdDom";
import { NameSearch } from "./NameSearch";
import type { NameSearchExtraOption } from "./NameSearch";

interface Person {
  id: string;
  name: string;
  grayed?: boolean;
}

const people: Person[] = [
  { id: "p1", name: "נועה כהן" },
  { id: "p2", name: "Dana Levi" },
  { id: "p3", name: "נועם לוי", grayed: true },
];

const input = () => screen.getByRole("combobox") as HTMLInputElement;
const open = () => fireEvent.mouseDown(input());
const type = (value: string) =>
  fireEvent.change(input(), { target: { value } });

const Pick = ({
  initial,
  onSelect,
  extraOption,
}: {
  initial?: string;
  onSelect?: (p: Person | undefined) => void;
  extraOption?: NameSearchExtraOption;
}) => {
  const [value, setValue] = useState<string | undefined>(initial);
  return (
    <NameSearch
      mode="pick"
      items={people}
      getName={p => p.name}
      getKey={p => p.id}
      renderOption={p =>
        p.grayed ? <span className="grayed">{p.name}</span> : p.name
      }
      extraOption={extraOption}
      value={value}
      onSelect={p => {
        setValue(p?.id);
        onSelect?.(p);
      }}
    />
  );
};

const Filter = ({
  onChange,
  extraOption,
}: {
  onChange?: (text: string) => void;
  extraOption?: NameSearchExtraOption;
}) => {
  const [text, setText] = useState("");
  return (
    <NameSearch
      mode="filter"
      items={people}
      getName={p => p.name}
      extraOption={extraOption}
      value={text}
      onChange={t => {
        setText(t);
        onChange?.(t);
      }}
    />
  );
};

describe("NameSearch", () => {
  beforeAll(stubMatchMedia);

  describe('mode="pick"', () => {
    it("lists every item on open, through renderOption", () => {
      render(<Pick />);
      open();

      expect(visibleOptions()).toEqual(["נועה כהן", "Dana Levi", "נועם לוי"]);
      expect(visibleOptionElements()[2].querySelector(".grayed")).toBeTruthy();
    });

    it("matches trimmed, case-insensitive substrings", () => {
      render(<Pick />);
      open();
      type("  DANA ");

      expect(visibleOptions()).toEqual(["Dana Levi"]);
    });

    it("reports the clicked item and shows its plain name", () => {
      const onSelect = vi.fn();
      render(<Pick onSelect={onSelect} />);
      open();
      type("לוי");
      fireEvent.click(visibleOptionElements()[0]);

      expect(onSelect).toHaveBeenLastCalledWith(people[2]);
      expect(shownText()).toBe("נועם לוי");
      expect(document.querySelector(".ant-select-selector .grayed")).toBeNull();
    });

    it("picks the highlighted option on Enter", () => {
      const onSelect = vi.fn();
      render(<Pick onSelect={onSelect} />);
      open();
      type("נוע");
      pressEnter(input());

      expect(onSelect).toHaveBeenLastCalledWith(people[0]);
    });

    it("keeps the selection while typing and shows it again on blur", () => {
      const onSelect = vi.fn();
      render(<Pick initial="p1" onSelect={onSelect} />);
      open();
      type("xyz");
      fireEvent.blur(input());

      expect(onSelect).not.toHaveBeenCalled();
      expect(shownText()).toBe("נועה כהן");
    });

    it("clears to undefined", () => {
      const onSelect = vi.fn();
      render(<Pick initial="p1" onSelect={onSelect} />);
      fireEvent.mouseDown(document.querySelector(".ant-select-clear")!);

      expect(onSelect).toHaveBeenLastCalledWith(undefined);
      expect(shownText()).toBe("");
    });

    it("shows a value that matches no item as-is", () => {
      render(<Pick initial="unknown" />);

      expect(shownText()).toBe("unknown");
    });

    it("offers the extra row, with the trimmed query, when nothing matches", () => {
      const extra = { label: (q: string) => `הוסף: ${q}`, onSelect: vi.fn() };
      const onSelect = vi.fn();
      render(<Pick extraOption={extra} onSelect={onSelect} />);
      open();
      type(" שירה גל ");

      expect(visibleOptions()).toEqual(["הוסף: שירה גל"]);
      fireEvent.click(visibleOptionElements()[0]);

      expect(extra.onSelect).toHaveBeenCalledWith("שירה גל");
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("hides the extra row while something matches", () => {
      const extra = { label: (q: string) => `הוסף: ${q}`, onSelect: vi.fn() };
      render(<Pick extraOption={extra} />);
      open();
      type("נוע");

      expect(visibleOptions()).toEqual(["נועה כהן", "נועם לוי"]);
    });
  });

  describe('mode="filter"', () => {
    it("lists every item on focus", () => {
      render(<Filter />);
      open();

      expect(visibleOptions()).toEqual(["נועה כהן", "Dana Levi", "נועם לוי"]);
    });

    it("reports the typed text and suggests trimmed, case-insensitive matches", () => {
      const onChange = vi.fn();
      render(<Filter onChange={onChange} />);
      type(" dana");

      expect(onChange).toHaveBeenLastCalledWith(" dana");
      expect(visibleOptions()).toEqual(["Dana Levi"]);
    });

    it("fills in a picked suggestion's name", () => {
      const onChange = vi.fn();
      render(<Filter onChange={onChange} />);
      type("לוי");
      fireEvent.click(visibleOptionElements()[0]);

      expect(onChange).toHaveBeenLastCalledWith("נועם לוי");
      expect(input().value).toBe("נועם לוי");
    });

    it("keeps the typed text on Enter", () => {
      const onChange = vi.fn();
      render(<Filter onChange={onChange} />);
      type("נוע");
      pressEnter(input());

      expect(input().value).toBe("נוע");
    });

    it("clears to an empty string", () => {
      const onChange = vi.fn();
      render(<Filter onChange={onChange} />);
      type("נוע");
      fireEvent.mouseDown(document.querySelector(".ant-select-clear")!);

      expect(onChange).toHaveBeenLastCalledWith("");
    });

    it("runs the extra row with the trimmed query and clears the text", () => {
      const extra = { label: (q: string) => `הוסף: ${q}`, onSelect: vi.fn() };
      const onChange = vi.fn();
      render(<Filter extraOption={extra} onChange={onChange} />);
      type("שירה גל ");

      expect(visibleOptions()).toEqual(["הוסף: שירה גל"]);
      fireEvent.click(visibleOptionElements()[0]);

      expect(extra.onSelect).toHaveBeenCalledWith("שירה גל");
      expect(onChange).toHaveBeenLastCalledWith("");
    });
  });
});
