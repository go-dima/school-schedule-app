import { describe, it, expect } from "vitest";
import { decideDuplicateWarning } from "./childDuplicateWarning";

describe("decideDuplicateWarning", () => {
  it("returns none when there are no matches", () => {
    expect(decideDuplicateWarning([])).toEqual({ kind: "none" });
  });

  it("returns redirect when the current user already created a match", () => {
    const matches = [
      {
        id: "c1",
        grade: 6,
        createdByUserId: "u1",
        createdByName: "Me",
        createdByIsSelf: true,
        hasLinkedParent: false,
        linkedParentName: null,
        linkedToMe: false,
      },
    ];
    expect(decideDuplicateWarning(matches)).toEqual({
      kind: "redirect",
      childId: "c1",
    });
  });

  it("returns confirm when someone else created a match", () => {
    const matches = [
      {
        id: "c1",
        grade: 6,
        createdByUserId: "u2",
        createdByName: "Other",
        createdByIsSelf: false,
        hasLinkedParent: false,
        linkedParentName: null,
        linkedToMe: false,
      },
    ];
    expect(decideDuplicateWarning(matches)).toEqual({
      kind: "confirm",
      match: matches[0],
    });
  });

  it("returns redirect when the current user is already linked as a parent", () => {
    const matches = [
      {
        id: "c1",
        grade: 6,
        createdByUserId: "u2",
        createdByName: "Other",
        createdByIsSelf: false,
        hasLinkedParent: true,
        linkedParentName: "Other",
        linkedToMe: true,
      },
    ];
    expect(decideDuplicateWarning(matches)).toEqual({
      kind: "redirect",
      childId: "c1",
    });
  });

  it("prefers redirect even if a self match is not first in the list", () => {
    const matches = [
      {
        id: "c1",
        grade: 6,
        createdByUserId: "u2",
        createdByName: "Other",
        createdByIsSelf: false,
        hasLinkedParent: false,
        linkedParentName: null,
        linkedToMe: false,
      },
      {
        id: "c2",
        grade: 6,
        createdByUserId: "u1",
        createdByName: "Me",
        createdByIsSelf: true,
        hasLinkedParent: false,
        linkedParentName: null,
        linkedToMe: false,
      },
    ];
    expect(decideDuplicateWarning(matches)).toEqual({
      kind: "redirect",
      childId: "c2",
    });
  });
});
