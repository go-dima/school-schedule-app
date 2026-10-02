import { describe, expect, it } from "vitest";
import { childLinkValue } from "./childAccountLink";

describe("childLinkValue", () => {
  it("existing mode needs a chosen student", () => {
    expect(childLinkValue({ mode: "existing", newChild: {} })).toBeUndefined();
    expect(
      childLinkValue({ mode: "existing", childId: "c1", newChild: {} })
    ).toEqual({ childId: "c1" });
  });

  it("new mode needs first name, last name and grade; group is optional", () => {
    expect(
      childLinkValue({
        mode: "new",
        newChild: { firstName: "נועה", lastName: " ", grade: 2 },
      })
    ).toBeUndefined();
    expect(
      childLinkValue({
        mode: "new",
        newChild: { firstName: " נועה ", lastName: "לוי", grade: 2 },
      })
    ).toEqual({
      newChild: {
        firstName: "נועה",
        lastName: "לוי",
        grade: 2,
        groupNumber: null,
      },
    });
  });

  it("ignores the other mode's leftover input", () => {
    expect(
      childLinkValue({
        mode: "new",
        childId: "c1",
        newChild: {},
      })
    ).toBeUndefined();
  });
});
