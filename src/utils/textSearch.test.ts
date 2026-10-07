import { describe, expect, it } from "vitest";
import { filterByText, matchesText } from "./textSearch";
import { studentName } from "./personName";

const dana = { firstName: "Dana", lastName: "Levi" };
const noa = { firstName: "נועה", lastName: "כהן" };

describe("matchesText", () => {
  it("matches everyone on an empty search", () => {
    expect(matchesText("Dana Levi", "")).toBe(true);
  });

  it("matches everyone on an all-space search", () => {
    expect(matchesText("Dana Levi", "   ")).toBe(true);
  });

  it("matches a substring of the first name", () => {
    expect(matchesText(studentName(dana), "an")).toBe(true);
  });

  it("matches a substring of the last name", () => {
    expect(matchesText(studentName(dana), "lev")).toBe(true);
  });

  it("matches across first and last name", () => {
    expect(matchesText(studentName(dana), "a le")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesText(studentName(dana), "DANA")).toBe(true);
  });

  it("trims the search", () => {
    expect(matchesText(studentName(dana), "  dana ")).toBe(true);
  });

  it("matches Hebrew names", () => {
    expect(matchesText(studentName(noa), "נועה כ")).toBe(true);
  });

  it("rejects a non-matching search", () => {
    expect(matchesText(studentName(dana), "noa")).toBe(false);
  });
});

describe("filterByText", () => {
  it("keeps the matching items in their original order", () => {
    const list = [dana, noa, { firstName: "Danny", lastName: "Cohen" }];
    expect(filterByText(list, "dan", studentName)).toEqual([list[0], list[2]]);
  });

  it("returns every item when the search is empty", () => {
    const list = [dana, noa];
    expect(filterByText(list, "", studentName)).toEqual(list);
  });

  it("works on plain strings", () => {
    const teachers = ["מירב אלון", "אורית שמש"];
    expect(filterByText(teachers, "אור", t => t)).toEqual(["אורית שמש"]);
  });
});
