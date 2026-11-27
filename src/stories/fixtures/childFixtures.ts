import type { Child } from "../../types";

// Fixed students for page stories. Dates are constants, never "now".
export const makeChild = (
  id: string,
  firstName: string,
  lastName: string,
  grade: number,
  overrides: Partial<Child> = {}
): Child => ({
  id,
  firstName,
  lastName,
  grade,
  groupNumber: null,
  trackNumber: null,
  scope: "prod",
  createdBy: null,
  createdByName: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

// "child-1" is the child the schedule fixtures' overrides belong to.
export const mockChildren: Child[] = [
  makeChild("child-1", "נועה", "כהן", 2, { groupNumber: 1 }),
  makeChild("child-2", "איתי", "כהן", 4, { trackNumber: 1 }),
];

export const mockAllStudents = [
  { ...mockChildren[0], assignedParent: true },
  { ...mockChildren[1], assignedParent: true },
  { ...makeChild("child-3", "יואב", "לוי", 1), assignedParent: false },
  { ...makeChild("child-4", "מיכל", "אברהם", 3), assignedParent: true },
  { ...makeChild("child-5", "עידו", "שמש", 5), assignedParent: false },
  { ...makeChild("child-6", "תמר", "דהן", 6), assignedParent: true },
];
