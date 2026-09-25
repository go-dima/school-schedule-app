// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffMember, StaffView } from "../services/staffScheduleService";

const getStaffMembers = vi.fn<unknown[], Promise<StaffMember[]>>();
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
    getStaffMembers: (...args: unknown[]) => getStaffMembers(...args),
    getStaffView: (...args: unknown[]) => getStaffView(...args),
  },
}));

const { useStaffSchedule } = await import("./useStaffSchedule");

const members: StaffMember[] = [
  { name: "דנה", teaches: true },
  { name: "יעל", teaches: false },
];

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
    getStaffMembers.mockReset();
    getStaffView.mockReset();
    getStaffMembers.mockResolvedValue(members);
    getStaffView.mockResolvedValue(makeView(["c1"]));
  });

  it("makes no requests while disabled", () => {
    const { result } = renderHook(() => useStaffSchedule(false, "דנה"));

    expect(getStaffMembers).not.toHaveBeenCalled();
    expect(getStaffView).not.toHaveBeenCalled();
    expect(result.current.view.classes).toEqual([]);
  });

  it("loads staff members but no view until one is chosen", async () => {
    const { result } = renderHook(() => useStaffSchedule(true, undefined));

    await waitFor(() => expect(result.current.staff).toEqual(members));
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

  it("refetch reloads staff members and view", async () => {
    const { result } = renderHook(() => useStaffSchedule(true, "דנה"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.refetch());

    await waitFor(() => expect(getStaffView).toHaveBeenCalledTimes(2));
    expect(getStaffMembers).toHaveBeenCalledTimes(2);
  });
});
