import { describe, expect, it } from "vitest";
import { filterByName, matchesName } from "./nameSearch";
import { studentName } from "./personName";

const dana = { firstName: "Dana", lastName: "Levi" };
const noa = { firstName: "נועה", lastName: "כהן" };

describe("matchesName", () => {
  it("matches everyone on an empty search", () => {
    expect(matchesName("Dana Levi", "")).toBe(true);
  });

  it("matches everyone on an all-space search", () => {
    expect(matchesName("Dana Levi", "   ")).toBe(true);
  });

  it("matches a substring of the first name", () => {
    expect(matchesName(studentName(dana), "an")).toBe(true);
  });

  it("matches a substring of the last name", () => {
    expect(matchesName(studentName(dana), "lev")).toBe(true);
  });

  it("matches across first and last name", () => {
    expect(matchesName(studentName(dana), "a le")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesName(studentName(dana), "DANA")).toBe(true);
  });

  it("trims the search", () => {
    expect(matchesName(studentName(dana), "  dana ")).toBe(true);
  });

  it("matches Hebrew names", () => {
    expect(matchesName(studentName(noa), "נועה כ")).toBe(true);
  });

  it("rejects a non-matching search", () => {
    expect(matchesName(studentName(dana), "noa")).toBe(false);
  });
});

describe("filterByName", () => {
  it("keeps the matching items in their original order", () => {
    const list = [dana, noa, { firstName: "Danny", lastName: "Cohen" }];
    expect(filterByName(list, "dan", studentName)).toEqual([list[0], list[2]]);
  });

  it("returns every item when the search is empty", () => {
    const list = [dana, noa];
    expect(filterByName(list, "", studentName)).toEqual(list);
  });

  it("works on plain strings", () => {
    const teachers = ["מירב אלון", "אורית שמש"];
    expect(filterByName(teachers, "אור", t => t)).toEqual(["אורית שמש"]);
  });
});
