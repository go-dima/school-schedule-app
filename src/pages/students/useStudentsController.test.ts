// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Child } from "../../types";

const ctx = {
  children: [] as unknown[],
  createChild: vi.fn(),
  updateChild: vi.fn(),
  removeChild: vi.fn(),
  refetch: vi.fn(),
};
const claimChild = vi.fn();
const trackEvent = vi.fn();

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    roleFlags: { isAdmin: true, isParent: false },
    permissions: { canManageRoster: true },
  }),
}));
vi.mock("../../contexts/AllChildrenContext", () => ({
  useAllChildrenContext: () => ({
    children: ctx.children,
    loading: false,
    error: null,
    createChild: ctx.createChild,
    updateChild: ctx.updateChild,
    removeChild: ctx.removeChild,
    refetch: ctx.refetch,
  }),
}));
vi.mock("../../services/api", () => ({
  childrenApi: { claimChild: (...a: unknown[]) => claimChild(...a) },
}));
vi.mock("../../utils/analytics", () => ({
  AnalyticsEvent: { StudentSaved: "student_saved" },
  trackEvent: (...a: unknown[]) => trackEvent(...a),
}));

const { useStudentsController, filterStudents } = await import(
  "./useStudentsController"
);

const make = (
  id: string,
  firstName: string,
  lastName: string,
  grade: number,
  scope: "prod" | "test" = "prod"
) =>
  ({
    id,
    firstName,
    lastName,
    grade,
    scope,
    assignedParent: true,
  }) as unknown as Child & { assignedParent: boolean };

const students = [
  make("a", "Dana", "Levi", 3),
  make("b", "Dani", "Katz", 4),
  make("c", "Noam", "Levi", 3, "test"),
  make("d", "Maya", "Bar", 4, "test"),
];
const ids = (list: { id: string }[]) => list.map(s => s.id);

describe("filterStudents", () => {
  const both: ("prod" | "test")[] = ["prod", "test"];

  it("returns everyone with no filter", () => {
    expect(ids(filterStudents(students, "", undefined, both))).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("filters by name text", () => {
    expect(ids(filterStudents(students, "levi", undefined, both))).toEqual([
      "a",
      "c",
    ]);
  });

  it("filters by grade", () => {
    expect(ids(filterStudents(students, "", 4, both))).toEqual(["b", "d"]);
  });

  it("filters by scope", () => {
    expect(ids(filterStudents(students, "", undefined, ["test"]))).toEqual([
      "c",
      "d",
    ]);
    expect(filterStudents(students, "", undefined, [])).toEqual([]);
  });

  it("combines search, grade and scope", () => {
    expect(ids(filterStudents(students, "levi", 3, ["prod"]))).toEqual(["a"]);
    expect(filterStudents(students, "levi", 4, both)).toEqual([]);
  });
});

describe("useStudentsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ctx.children = students;
  });

  it("starts with every scope on and applies filters", () => {
    const { result } = renderHook(() => useStudentsController());
    expect(result.current.filteredChildren).toHaveLength(4);
    act(() => result.current.setSelectedGrade(3));
    act(() => result.current.setSelectedScopes(["prod"]));
    expect(ids(result.current.filteredChildren)).toEqual(["a"]);
  });

  it("opens and closes the form modal", () => {
    const { result } = renderHook(() => useStudentsController());
    act(() => result.current.openEditModal(students[0]));
    expect(result.current.isFormModalOpen).toBe(true);
    expect(result.current.editingChild?.id).toBe("a");
    act(() => result.current.closeModal());
    expect(result.current.isFormModalOpen).toBe(false);
    expect(result.current.editingChild).toBeUndefined();
  });

  it("creates a student as prod by default and tracks it", async () => {
    ctx.createChild.mockResolvedValue({});
    const { result } = renderHook(() => useStudentsController());
    act(() => result.current.openCreateModal());
    await act(() =>
      result.current.handleCreateChild({
        firstName: "Dana",
        lastName: "Levi",
        grade: 2,
        groupNumber: null,
      })
    );
    expect(ctx.createChild).toHaveBeenCalledWith(
      "Dana",
      "Levi",
      2,
      null,
      "prod"
    );
    expect(trackEvent).toHaveBeenCalledWith("student_saved", {
      mode: "create",
    });
    expect(result.current.isFormModalOpen).toBe(false);
  });

  it("redirects a duplicate to editing the existing student", () => {
    const { result } = renderHook(() => useStudentsController());
    act(() => result.current.handleDuplicateRedirect("b"));
    expect(result.current.editingChild?.id).toBe("b");
    expect(result.current.isFormModalOpen).toBe(true);
  });

  it("claims a student and refetches", async () => {
    claimChild.mockResolvedValue(undefined);
    const { result } = renderHook(() => useStudentsController());
    await act(() => result.current.handleClaimChild("a"));
    expect(claimChild).toHaveBeenCalledWith("a");
    expect(ctx.refetch).toHaveBeenCalled();
  });
});
