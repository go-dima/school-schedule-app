import { describe, expect, it, vi } from "vitest";
import { buildOptions, TEXT_SEARCH_EXTRA_VALUE } from "./textSearchOptions";

interface Person {
  id: string;
  name: string;
}

const people: Person[] = [
  { id: "p1", name: "Noa Cohen" },
  { id: "p2", name: "Yoav Levi" },
  { id: "p3", name: "Dana Levi" },
];

const getText = (p: Person) => p.name;
const getKey = (p: Person) => p.id;

const pick = (
  query: string,
  extra: Partial<Parameters<typeof buildOptions<Person>>[0]> = {}
) =>
  buildOptions<Person>(
    { items: people, getText, ...extra },
    query,
    getKey,
    getKey,
    TEXT_SEARCH_EXTRA_VALUE
  );

describe("buildOptions", () => {
  it("lists every item for an empty query, in order", () => {
    expect(pick("").map(o => o.value)).toEqual(["p1", "p2", "p3"]);
  });

  it("keeps the trimmed, case-insensitive matches", () => {
    expect(pick("  LEVI ").map(o => o.label)).toEqual([
      "Yoav Levi",
      "Dana Levi",
    ]);
  });

  it("keeps the plain text as label and renderOption as content", () => {
    const [option] = pick("noa", { renderOption: p => `* ${p.name}` });
    expect(option).toEqual({
      key: "p1",
      value: "p1",
      label: "Noa Cohen",
      content: "* Noa Cohen",
    });
  });

  it("lists an item whose key repeats only once", () => {
    const items = [...people, { id: "p2", name: "Yoav Levi (copy)" }];
    expect(pick("", { items }).map(o => o.label)).toEqual([
      "Noa Cohen",
      "Yoav Levi",
      "Dana Levi",
    ]);
  });

  it("dedupes by text when the value is the text", () => {
    const items = [...people, { id: "p4", name: "Noa Cohen" }];
    const options = buildOptions<Person>(
      { items, getText },
      "noa",
      getText,
      (_p, index) => String(index),
      "noa"
    );
    expect(options).toHaveLength(1);
  });

  it("returns only the extra row, with the trimmed query, when nothing matches", () => {
    const label = vi.fn((q: string) => `add ${q}`);
    const extraOption = { label, onSelect: vi.fn() };
    expect(pick(" zzz ", { extraOption })).toEqual([
      {
        key: TEXT_SEARCH_EXTRA_VALUE,
        value: TEXT_SEARCH_EXTRA_VALUE,
        label: "add zzz",
        content: "add zzz",
        isExtra: true,
      },
    ]);
    expect(label).toHaveBeenCalledWith("zzz");
  });

  it("hides the extra row while something matches or the query is blank", () => {
    const extraOption = { label: (q: string) => q, onSelect: vi.fn() };
    expect(pick("levi", { extraOption }).some(o => o.isExtra)).toBe(false);
    expect(pick("   ", { extraOption })).toHaveLength(3);
  });

  it("returns nothing when nothing matches and there is no extra row", () => {
    expect(pick("zzz")).toEqual([]);
  });
});
