// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ScheduleOverrideWithTimeSlot } from "../types";

const getOverrides = vi.fn<
  unknown[],
  Promise<ScheduleOverrideWithTimeSlot[]>
>();
const createOverride = vi.fn<
  unknown[],
  Promise<ScheduleOverrideWithTimeSlot>
>();
const updateOverride = vi.fn<
  unknown[],
  Promise<ScheduleOverrideWithTimeSlot>
>();
const deleteOverride = vi.fn<unknown[], Promise<void>>();

vi.mock("../services/api", () => ({
  scheduleOverridesApi: {
    getOverrides: (...args: unknown[]) => getOverrides(...args),
    createOverride: (...args: unknown[]) => createOverride(...args),
    updateOverride: (...args: unknown[]) => updateOverride(...args),
    deleteOverride: (...args: unknown[]) => deleteOverride(...args),
  },
}));

const { useScheduleOverrides } = await import("./useScheduleOverrides");

const makeOverride = (id: string): ScheduleOverrideWithTimeSlot =>
  ({
    id,
    childId: "child-1",
    title: "חונכות אישית",
    teacher: "דנה כהן",
    room: "חדר 5",
    dayOfWeek: 1,
    timeSlotId: "slot-1",
    scope: "prod",
    createdBy: "user-9",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    timeSlot: {
      id: "slot-1",
      name: "שיעור ראשון",
      startTime: "08:00",
      endTime: "08:45",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  }) as ScheduleOverrideWithTimeSlot;

describe("useScheduleOverrides", () => {
  beforeEach(() => {
    getOverrides.mockReset();
    createOverride.mockReset();
    updateOverride.mockReset();
    deleteOverride.mockReset();
    getOverrides.mockResolvedValue([]);
  });

  it("does not call the API and returns an empty list when childId is undefined", () => {
    const { result } = renderHook(() => useScheduleOverrides(undefined));

    expect(getOverrides).not.toHaveBeenCalled();
    expect(result.current.overrides).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("fetches overrides for the given childId", async () => {
    getOverrides.mockResolvedValue([makeOverride("override-1")]);

    const { result } = renderHook(() => useScheduleOverrides("child-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getOverrides).toHaveBeenCalledWith("child-1");
    expect(result.current.overrides).toHaveLength(1);
  });

  it("re-fetches when childId changes", async () => {
    getOverrides.mockResolvedValueOnce([makeOverride("override-1")]);

    const { result, rerender } = renderHook(
      ({ childId }) => useScheduleOverrides(childId),
      { initialProps: { childId: "child-1" as string | undefined } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    getOverrides.mockResolvedValueOnce([makeOverride("override-2")]);
    rerender({ childId: "child-2" });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getOverrides).toHaveBeenCalledTimes(2);
    expect(getOverrides).toHaveBeenLastCalledWith("child-2");
  });

  it("refetches after createOverride", async () => {
    getOverrides.mockResolvedValue([]);
    createOverride.mockResolvedValue(makeOverride("override-1"));

    const { result } = renderHook(() => useScheduleOverrides("child-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    getOverrides.mockResolvedValueOnce([makeOverride("override-1")]);
    await act(async () => {
      await result.current.createOverride({
        childId: "child-1",
        title: "חונכות אישית",
        teacher: "דנה כהן",
        room: "חדר 5",
        dayOfWeek: 1,
        timeSlotId: "slot-1",
        scope: "prod",
      });
    });

    expect(createOverride).toHaveBeenCalled();
    expect(getOverrides).toHaveBeenCalledTimes(2);
    expect(result.current.overrides).toHaveLength(1);
  });

  it("refetches after updateOverride", async () => {
    getOverrides.mockResolvedValue([makeOverride("override-1")]);
    updateOverride.mockResolvedValue(makeOverride("override-1"));

    const { result } = renderHook(() => useScheduleOverrides("child-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateOverride("override-1", { title: "חדש" });
    });

    expect(updateOverride).toHaveBeenCalledWith("override-1", {
      title: "חדש",
    });
    expect(getOverrides).toHaveBeenCalledTimes(2);
  });

  it("refetches after deleteOverride", async () => {
    getOverrides.mockResolvedValueOnce([makeOverride("override-1")]);
    deleteOverride.mockResolvedValue(undefined);

    const { result } = renderHook(() => useScheduleOverrides("child-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    getOverrides.mockResolvedValueOnce([]);
    await act(async () => {
      await result.current.deleteOverride("override-1");
    });

    expect(deleteOverride).toHaveBeenCalledWith("override-1");
    expect(getOverrides).toHaveBeenCalledTimes(2);
    expect(result.current.overrides).toHaveLength(0);
  });

  it("sets error and rethrows when createOverride fails", async () => {
    getOverrides.mockResolvedValue([]);
    createOverride.mockRejectedValue(new Error("insert failed"));

    const { result } = renderHook(() => useScheduleOverrides("child-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.createOverride({
          childId: "child-1",
          title: "חונכות אישית",
          teacher: "דנה כהן",
          room: "חדר 5",
          dayOfWeek: 1,
          timeSlotId: "slot-1",
          scope: "prod",
        });
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("insert failed");
    expect(result.current.error).toBe("insert failed");
  });
});
