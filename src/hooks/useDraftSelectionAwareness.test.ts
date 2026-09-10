// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ScheduleSelectionWithClass } from "../types";

const getSelectedSchedule = vi.fn<
  unknown[],
  Promise<ScheduleSelectionWithClass[]>
>();

vi.mock("../services/api", () => ({
  scheduleApi: {
    getSelectedSchedule: (...args: unknown[]) => getSelectedSchedule(...args),
  },
}));

const { useDraftSelectionAwareness } = await import(
  "./useDraftSelectionAwareness"
);

const makeSelection = (classId: string): ScheduleSelectionWithClass =>
  ({
    id: `sel-${classId}`,
    userId: "user-1",
    classId,
    status: "draft",
  }) as ScheduleSelectionWithClass;

describe("useDraftSelectionAwareness", () => {
  beforeEach(() => {
    getSelectedSchedule.mockReset();
    getSelectedSchedule.mockResolvedValue([]);
  });

  it("does not call the API and returns an empty set when target is undefined", () => {
    const { result } = renderHook(() => useDraftSelectionAwareness(undefined));

    expect(getSelectedSchedule).not.toHaveBeenCalled();
    expect(result.current.draftClassIds.size).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it("calls getSelectedSchedule with the target and 'draft' status", async () => {
    getSelectedSchedule.mockResolvedValue([makeSelection("class-1")]);

    const { result } = renderHook(() =>
      useDraftSelectionAwareness({ childId: "child-1" })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getSelectedSchedule).toHaveBeenCalledWith(
      { childId: "child-1" },
      "draft"
    );
    expect(result.current.draftClassIds.has("class-1")).toBe(true);
    expect(result.current.isClassDraftPicked("class-1")).toBe(true);
    expect(result.current.isClassDraftPicked("class-2")).toBe(false);
  });

  it("re-fetches when the target changes", async () => {
    getSelectedSchedule.mockResolvedValueOnce([makeSelection("class-1")]);

    const { result, rerender } = renderHook(
      ({ target }) => useDraftSelectionAwareness(target),
      { initialProps: { target: { childId: "child-1" } } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.draftClassIds.has("class-1")).toBe(true);

    getSelectedSchedule.mockResolvedValueOnce([makeSelection("class-2")]);
    rerender({ target: { childId: "child-2" } });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getSelectedSchedule).toHaveBeenCalledTimes(2);
    expect(getSelectedSchedule).toHaveBeenLastCalledWith(
      { childId: "child-2" },
      "draft"
    );
    expect(result.current.draftClassIds.has("class-2")).toBe(true);
    expect(result.current.draftClassIds.has("class-1")).toBe(false);
  });
});
