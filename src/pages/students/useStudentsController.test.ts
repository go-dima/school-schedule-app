// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { message } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Child } from "../../types";

const auth = { isParent: false };

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
    roleFlags: { isAdmin: true, isParent: auth.isParent },
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
    vi.spyOn(message, "success").mockImplementation(() => undefined as never);
    vi.spyOn(message, "error").mockImplementation(() => undefined as never);
    ctx.children = students;
    auth.isParent = false;
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

  it("updates the student being edited and tracks it", async () => {
    ctx.updateChild.mockResolvedValue({});
    const { result } = renderHook(() => useStudentsController());
    act(() => result.current.openEditModal(students[0]));
    const data = {
      firstName: "Dana",
      lastName: "Levi",
      grade: 5,
      groupNumber: 2,
    };
    await act(() => result.current.handleUpdateChild(data));
    expect(ctx.updateChild).toHaveBeenCalledWith("a", data);
    expect(trackEvent).toHaveBeenCalledWith("student_saved", {
      mode: "update",
    });
    expect(message.success).toHaveBeenCalled();
    expect(result.current.isFormModalOpen).toBe(false);
    expect(result.current.editingChild).toBeUndefined();
    expect(result.current.formLoading).toBe(false);
  });

  it("does nothing on update when no student is being edited", async () => {
    const { result } = renderHook(() => useStudentsController());
    await act(() =>
      result.current.handleUpdateChild({
        firstName: "Dana",
        lastName: "Levi",
        grade: 5,
        groupNumber: null,
      })
    );
    expect(ctx.updateChild).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("keeps the modal open and shows the error when an update fails", async () => {
    ctx.updateChild.mockRejectedValue(new Error("update failed"));
    const { result } = renderHook(() => useStudentsController());
    act(() => result.current.openEditModal(students[1]));
    await act(() =>
      result.current.handleUpdateChild({
        firstName: "Dani",
        lastName: "Katz",
        grade: 4,
        groupNumber: null,
      })
    );
    expect(message.error).toHaveBeenCalledWith("update failed");
    expect(trackEvent).not.toHaveBeenCalled();
    expect(result.current.isFormModalOpen).toBe(true);
    expect(result.current.editingChild?.id).toBe("b");
    expect(result.current.formLoading).toBe(false);
  });

  it("deletes a student", async () => {
    ctx.removeChild.mockResolvedValue(undefined);
    const { result } = renderHook(() => useStudentsController());
    await act(() => result.current.handleDeleteChild("c"));
    expect(ctx.removeChild).toHaveBeenCalledWith("c");
    expect(message.success).toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
  });

  it("shows the error when a delete fails", async () => {
    ctx.removeChild.mockRejectedValue(new Error("delete failed"));
    const { result } = renderHook(() => useStudentsController());
    await act(() => result.current.handleDeleteChild("c"));
    expect(message.error).toHaveBeenCalledWith("delete failed");
    expect(message.success).not.toHaveBeenCalled();
  });

  describe("canClaim", () => {
    const unassigned = {
      ...students[0],
      assignedParent: false,
    } as Child & { assignedParent: boolean };

    it("lets a parent claim a student with no parent", () => {
      auth.isParent = true;
      const { result } = renderHook(() => useStudentsController());
      expect(result.current.canClaim(unassigned)).toBe(true);
    });

    it("does not let a parent claim a student who has a parent", () => {
      auth.isParent = true;
      const { result } = renderHook(() => useStudentsController());
      expect(result.current.canClaim(students[0])).toBe(false);
    });

    it("does not let a non-parent claim, assigned or not", () => {
      const { result } = renderHook(() => useStudentsController());
      expect(result.current.canClaim(unassigned)).toBe(false);
      expect(result.current.canClaim(students[0])).toBe(false);
    });
  });
});
