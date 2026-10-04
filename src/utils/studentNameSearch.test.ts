import { describe, expect, it } from "vitest";
import { filterByStudentName, matchesStudentName } from "./studentNameSearch";

const dana = { firstName: "Dana", lastName: "Levi" };
const noa = { firstName: "נועה", lastName: "כהן" };

describe("matchesStudentName", () => {
  it("matches everyone on an empty search", () => {
    expect(matchesStudentName(dana, "")).toBe(true);
  });

  it("matches a substring of the first name", () => {
    expect(matchesStudentName(dana, "an")).toBe(true);
  });

  it("matches a substring of the last name", () => {
    expect(matchesStudentName(dana, "lev")).toBe(true);
  });

  it("matches across first and last name", () => {
    expect(matchesStudentName(dana, "a le")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesStudentName(dana, "DANA")).toBe(true);
  });

  it("matches Hebrew names", () => {
    expect(matchesStudentName(noa, "נועה כ")).toBe(true);
  });

  it("rejects a non-matching search", () => {
    expect(matchesStudentName(dana, "noa")).toBe(false);
  });
});

describe("filterByStudentName", () => {
  it("keeps the matching students in their original order", () => {
    const list = [dana, noa, { firstName: "Danny", lastName: "Cohen" }];
    expect(filterByStudentName(list, "dan")).toEqual([list[0], list[2]]);
  });

  it("returns every student when the search is empty", () => {
    const list = [dana, noa];
    expect(filterByStudentName(list, "")).toEqual(list);
  });
});
