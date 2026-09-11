import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  SelectionStatus,
  TimeSlot,
} from "../types";

vi.mock("./api", () => ({
  scheduleApi: {
    selectSchedule: vi.fn(),
    unselectSchedule: vi.fn(),
  },
}));

const { GroupMandatoryLockService, isDuplicateKeyError } = await import(
  "./groupMandatoryLockService"
);
const { scheduleApi } = await import("./api");

const timeSlot = (id: string): TimeSlot => ({
  id,
  name: id,
  startTime: "09:15",
  endTime: "09:55",
  createdAt: "",
  updatedAt: "",
});

const ts1 = timeSlot("ts-1");

const makeClass = (
  overrides: Partial<ClassWithTimeSlot> = {}
): ClassWithTimeSlot => ({
  id: "class-1",
  title: "Class",
  description: "",
  teacher: "Teacher",
  slots: [{ dayOfWeek: 0, timeSlotId: ts1.id, timeSlot: ts1 }],
  grades: [1],
  isMandatory: false,
  isDouble: false,
  groupNumber: null,
  trackNumber: null,
  room: "",
  scope: "prod",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

const makeSelection = (
  cls: ClassWithTimeSlot,
  status: SelectionStatus = "draft"
): ScheduleSelectionWithClass => ({
  id: `sel-${cls.id}`,
  userId: "user-1",
  classId: cls.id,
  status,
  createdAt: "",
  updatedAt: "",
  class: cls,
});

describe("GroupMandatoryLockService.isLockedMatch", () => {
  it("matches a grouped class only when the child's group is identical", () => {
    const group1 = makeClass({ groupNumber: 1 });
    expect(GroupMandatoryLockService.isLockedMatch(group1, 1)).toBe(true);
    expect(GroupMandatoryLockService.isLockedMatch(group1, 2)).toBe(false);
    expect(GroupMandatoryLockService.isLockedMatch(group1, null)).toBe(false);
  });

  it("matches an ungrouped mandatory class for any child", () => {
    const mandatory = makeClass({ groupNumber: null, isMandatory: true });
    expect(GroupMandatoryLockService.isLockedMatch(mandatory, 1)).toBe(true);
    expect(GroupMandatoryLockService.isLockedMatch(mandatory, null)).toBe(true);
  });

  it("does not match an ungrouped non-mandatory class", () => {
    const plain = makeClass({ groupNumber: null, isMandatory: false });
    expect(GroupMandatoryLockService.isLockedMatch(plain, 1)).toBe(false);
    expect(GroupMandatoryLockService.isLockedMatch(plain, null)).toBe(false);
  });

  it("requires group match for a grouped-and-mandatory class (different group times)", () => {
    const mandatoryGroup1 = makeClass({ groupNumber: 1, isMandatory: true });
    expect(GroupMandatoryLockService.isLockedMatch(mandatoryGroup1, 1)).toBe(
      true
    );
    expect(GroupMandatoryLockService.isLockedMatch(mandatoryGroup1, 2)).toBe(
      false
    );
    expect(GroupMandatoryLockService.isLockedMatch(mandatoryGroup1, null)).toBe(
      false
    );
  });
});

describe("GroupMandatoryLockService.computeChanges", () => {
  it("selects a group-matched class not yet selected", () => {
    const group1 = makeClass({ id: "g1", groupNumber: 1, grades: [1] });
    const { toSelect, toUnselectIds } =
      GroupMandatoryLockService.computeChanges([group1], [], {
        grade: 1,
        groupNumber: 1,
      });

    expect(toSelect.map(c => c.id)).toEqual(["g1"]);
    expect(toUnselectIds).toEqual([]);
  });

  it("does not select a grouped class that doesn't match the child's group", () => {
    const group2 = makeClass({ id: "g2", groupNumber: 2, grades: [1] });
    const { toSelect } = GroupMandatoryLockService.computeChanges(
      [group2],
      [],
      { grade: 1, groupNumber: 1 }
    );

    expect(toSelect).toEqual([]);
  });

  it("selects an ungrouped mandatory class regardless of the child's group", () => {
    const mandatory = makeClass({
      id: "m1",
      groupNumber: null,
      isMandatory: true,
      grades: [1],
    });
    const { toSelect } = GroupMandatoryLockService.computeChanges(
      [mandatory],
      [],
      { grade: 1, groupNumber: null }
    );

    expect(toSelect.map(c => c.id)).toEqual(["m1"]);
  });

  it("does not re-select an already-selected match", () => {
    const group1 = makeClass({ id: "g1", groupNumber: 1, grades: [1] });
    const { toSelect } = GroupMandatoryLockService.computeChanges(
      [group1],
      [makeSelection(group1)],
      { grade: 1, groupNumber: 1 }
    );

    expect(toSelect).toEqual([]);
  });

  it("only selects classes matching the child's grade", () => {
    const grade1Group1 = makeClass({
      id: "grade1",
      groupNumber: 1,
      grades: [1],
    });
    const grade2Group1 = makeClass({
      id: "grade2",
      groupNumber: 1,
      grades: [2],
    });

    const { toSelect } = GroupMandatoryLockService.computeChanges(
      [grade1Group1, grade2Group1],
      [],
      { grade: 1, groupNumber: 1 }
    );

    expect(toSelect.map(c => c.id)).toEqual(["grade1"]);
  });

  it("unselects a previously-matched group class when the child's group changed", () => {
    const group1 = makeClass({ id: "g1", groupNumber: 1, grades: [1] });
    const { toSelect, toUnselectIds } =
      GroupMandatoryLockService.computeChanges(
        [group1],
        [makeSelection(group1)],
        { grade: 1, groupNumber: 2 }
      );

    expect(toSelect).toEqual([]);
    expect(toUnselectIds).toEqual(["g1"]);
  });

  it("leaves a freely-selected ungrouped non-mandatory class untouched", () => {
    const free = makeClass({ id: "free", groupNumber: null });
    const { toUnselectIds } = GroupMandatoryLockService.computeChanges(
      [free],
      [makeSelection(free)],
      { grade: 1, groupNumber: 1 }
    );

    expect(toUnselectIds).toEqual([]);
  });

  it("computes identical changes regardless of which status the given selections carry", () => {
    const group1 = makeClass({ id: "g1", groupNumber: 1, grades: [1] });

    const draftResult = GroupMandatoryLockService.computeChanges([group1], [], {
      grade: 1,
      groupNumber: 1,
    });
    const committedResult = GroupMandatoryLockService.computeChanges(
      [group1],
      [],
      { grade: 1, groupNumber: 1 }
    );

    expect(committedResult).toEqual(draftResult);
  });

  it("works when destructured off the service (no `this` binding required)", () => {
    const { computeChanges } = GroupMandatoryLockService;
    const group1 = makeClass({ id: "g1", groupNumber: 1, grades: [1] });
    const stale = makeSelection(
      makeClass({ id: "g2", groupNumber: 2, grades: [1] })
    );

    const { toSelect, toUnselectIds } = computeChanges([group1], [stale], {
      grade: 1,
      groupNumber: 1,
    });

    expect(toSelect.map(c => c.id)).toEqual(["g1"]);
    expect(toUnselectIds).toEqual(["g2"]);
  });
});

// Mirrors the runtime shape of `ApiError` from ./api: an Error carrying the
// underlying PostgrestError's SQLSTATE on `code`.
const apiError = (message: string, code?: string) =>
  Object.assign(new Error(message), { name: "ApiError", code });

describe("isDuplicateKeyError", () => {
  it("recognises a unique_violation by its Postgres SQLSTATE", () => {
    expect(
      isDuplicateKeyError(
        apiError(
          'duplicate key value violates unique constraint "schedule_selections_child_class_status_key"',
          "23505"
        )
      )
    ).toBe(true);
  });

  it("rejects other database errors, plain errors and non-errors", () => {
    expect(
      isDuplicateKeyError(apiError("foreign key violation", "23503"))
    ).toBe(false);
    expect(isDuplicateKeyError(apiError("network failure"))).toBe(false);
    expect(isDuplicateKeyError(new Error("duplicate key value"))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
    expect(isDuplicateKeyError("23505")).toBe(false);
  });
});

describe("GroupMandatoryLockService.applyChanges", () => {
  const selectMock = vi.mocked(scheduleApi.selectSchedule);
  const unselectMock = vi.mocked(scheduleApi.unselectSchedule);

  beforeEach(() => {
    vi.resetAllMocks();
    selectMock.mockResolvedValue(undefined as never);
    unselectMock.mockResolvedValue(undefined as never);
  });

  const changes = (): Parameters<
    typeof GroupMandatoryLockService.applyChanges
  >[1] => ({
    toSelect: [makeClass({ id: "g1", groupNumber: 1 })],
    toUnselectIds: ["old-1"],
  });

  it("selects and unselects for the given child and status", async () => {
    await GroupMandatoryLockService.applyChanges("child-1", changes(), "draft");

    expect(selectMock).toHaveBeenCalledWith(
      { childId: "child-1" },
      "g1",
      "draft"
    );
    expect(unselectMock).toHaveBeenCalledWith(
      { childId: "child-1" },
      "old-1",
      "draft"
    );
  });

  it("resolves without throwing when a select hits a duplicate-key violation", async () => {
    selectMock.mockRejectedValue(
      apiError(
        'duplicate key value violates unique constraint "schedule_selections_child_class_status_key"',
        "23505"
      )
    );

    await expect(
      GroupMandatoryLockService.applyChanges("child-1", changes(), "draft")
    ).resolves.toBeUndefined();
  });

  it("still propagates an unrelated select failure", async () => {
    selectMock.mockRejectedValue(apiError("Failed to fetch"));

    await expect(
      GroupMandatoryLockService.applyChanges("child-1", changes(), "draft")
    ).rejects.toThrow("Failed to fetch");
  });

  it("still propagates a different Postgres error from a select", async () => {
    selectMock.mockRejectedValue(
      apiError("insert violates foreign key constraint", "23503")
    );

    await expect(
      GroupMandatoryLockService.applyChanges("child-1", changes(), "draft")
    ).rejects.toThrow("insert violates foreign key constraint");
  });

  it("still propagates an unselect failure", async () => {
    unselectMock.mockRejectedValue(apiError("permission denied", "42501"));

    await expect(
      GroupMandatoryLockService.applyChanges("child-1", changes(), "draft")
    ).rejects.toThrow("permission denied");
  });
});
