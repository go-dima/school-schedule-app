import type { Child } from "../../types";

// Shared mock students for stories, with invented names only.

const makeStudent = (
  id: string,
  firstName: string,
  lastName: string,
  grade: number
): Child => ({
  id,
  firstName,
  lastName,
  grade,
  groupNumber: 1,
  trackNumber: null,
  scope: "test",
  createdBy: null,
  createdByName: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

export const mockStudents: Child[] = [
  makeStudent("student-1", "תמר", "גולן", 1),
  makeStudent("student-2", "אביב", "שגיא", 2),
  makeStudent("student-3", "ליה", "ברק", 3),
  makeStudent("student-4", "רון", "אדלר", 3),
  makeStudent("student-5", "שירה", "נחום", 4),
  makeStudent("student-6", "עומר", "גולן", 5),
  makeStudent("student-7", "יעלי", "רביב", 6),
];
