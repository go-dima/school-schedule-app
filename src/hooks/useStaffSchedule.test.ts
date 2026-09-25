// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffView } from "../services/staffScheduleService";

const getStaffNames = vi.fn<unknown[], Promise<string[]>>();
const getStaffView = vi.fn<unknown[], Promise<StaffView>>();

vi.mock("../services/staffScheduleService", () => ({
  EMPTY_STAFF_VIEW: {
    classes: [],
    weeklySchedule: {},
    selectedClasses: [],
    userSelections: [],
    extraEnrollmentCounts: new Map(),
  },
  StaffScheduleService: {
    getStaffNames: (...args: unknown[]) => getStaffNames(...args),
    getStaffView: (...args: unknown[]) => getStaffView(...args),
  },
}));

const { useStaffSchedule } = await import("./useStaffSchedule");

const makeView = (ids: string[]): StaffView =>
  ({
    classes: ids.map(id => ({ id })),
    weeklySchedule: {},
    selectedClasses: ids,
    userSelections: [],
    extraEnrollmentCounts: new Map(),
  }) as unknown as StaffView;

describe("useStaffSchedule", () => {
  beforeEach(() => {
    getStaffNames.mockReset();
    getStaffView.mockReset();
    getStaffNames.mockResolvedValue(["דנה", "יעל"]);
    getStaffView.mockResolvedValue(makeView(["c1"]));
  });

  it("makes no requests while disabled", () => {
    const { result } = renderHook(() => useStaffSchedule(false, "דנה"));

    expect(getStaffNames).not.toHaveBeenCalled();
    expect(getStaffView).not.toHaveBeenCalled();
    expect(result.current.view.classes).toEqual([]);
  });

  it("loads names but no view until a staff member is chosen", async () => {
    const { result } = renderHook(() => useStaffSchedule(true, undefined));

    await waitFor(() => expect(result.current.names).toEqual(["דנה", "יעל"]));
    expect(getStaffView).not.toHaveBeenCalled();
  });

  it("loads the chosen staff member's view", async () => {
    const { result } = renderHook(() => useStaffSchedule(true, "דנה"));

    await waitFor(() =>
      expect(result.current.view.selectedClasses).toEqual(["c1"])
    );
    expect(getStaffView).toHaveBeenCalledWith("דנה");
  });

  it("ignores a stale response after the staff member changes", async () => {
    let resolveFirst: (view: StaffView) => void = () => {};
    getStaffView.mockImplementationOnce(
      () => new Promise(resolve => (resolveFirst = resolve))
    );
    getStaffView.mockResolvedValueOnce(makeView(["second"]));

    const { result, rerender } = renderHook(
      ({ name }) => useStaffSchedule(true, name),
      { initialProps: { name: "דנה" } }
    );
    rerender({ name: "יעל" });
    await waitFor(() =>
      expect(result.current.view.selectedClasses).toEqual(["second"])
    );

    await act(async () => resolveFirst(makeView(["first"])));
    expect(result.current.view.selectedClasses).toEqual(["second"]);
  });

  it("surfaces a load error", async () => {
    getStaffView.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useStaffSchedule(true, "דנה"));

    await waitFor(() => expect(result.current.error).toBe("boom"));
    expect(result.current.view.classes).toEqual([]);
  });

  it("refetch reloads names and view", async () => {
    const { result } = renderHook(() => useStaffSchedule(true, "דנה"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.refetch());

    await waitFor(() => expect(getStaffView).toHaveBeenCalledTimes(2));
    expect(getStaffNames).toHaveBeenCalledTimes(2);
  });
});
