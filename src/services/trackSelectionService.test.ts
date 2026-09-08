import { describe, expect, it } from "vitest";
import type {
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  TimeSlot,
} from "../types";
import { TrackSelectionService } from "./trackSelectionService";

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
  grades: [4],
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

const makeSelection = (cls: ClassWithTimeSlot): ScheduleSelectionWithClass => ({
  id: `sel-${cls.id}`,
  userId: "user-1",
  classId: cls.id,
  createdAt: "",
  updatedAt: "",
  class: cls,
});

describe("TrackSelectionService.computeTrackClassChanges", () => {
  it("selects all of a grade's track-1 classes on first pick (null -> 1)", () => {
    const track1Math = makeClass({ id: "math-1", trackNumber: 1 });
    const track2Math = makeClass({ id: "math-2", trackNumber: 2 });
    const noTrack = makeClass({ id: "no-track", trackNumber: null });

    const { toSelect, toUnselectIds } =
      TrackSelectionService.computeTrackClassChanges(
        [track1Math, track2Math, noTrack],
        [],
        4,
        1
      );

    expect(toSelect.map(c => c.id)).toEqual(["math-1"]);
    expect(toUnselectIds).toEqual([]);
  });

  it("swaps track classes out when switching from track 1 to track 2", () => {
    const track1Math = makeClass({ id: "math-1", trackNumber: 1 });
    const track2Math = makeClass({ id: "math-2", trackNumber: 2 });
    const currentSchedule = [makeSelection(track1Math)];

    const { toSelect, toUnselectIds } =
      TrackSelectionService.computeTrackClassChanges(
        [track1Math, track2Math],
        currentSchedule,
        4,
        2
      );

    expect(toSelect.map(c => c.id)).toEqual(["math-2"]);
    expect(toUnselectIds).toEqual(["math-1"]);
  });

  it("unselects all track classes and selects none when the track is cleared", () => {
    const track1Math = makeClass({ id: "math-1", trackNumber: 1 });
    const track1Lang = makeClass({ id: "lang-1", trackNumber: 1 });
    const currentSchedule = [
      makeSelection(track1Math),
      makeSelection(track1Lang),
    ];

    const { toSelect, toUnselectIds } =
      TrackSelectionService.computeTrackClassChanges(
        [track1Math, track1Lang],
        currentSchedule,
        4,
        null
      );

    expect(toSelect).toEqual([]);
    expect(toUnselectIds.sort()).toEqual(["lang-1", "math-1"]);
  });

  it("only selects classes matching the child's grade", () => {
    const grade4Track1 = makeClass({
      id: "grade4",
      trackNumber: 1,
      grades: [4],
    });
    const grade5Track1 = makeClass({
      id: "grade5",
      trackNumber: 1,
      grades: [5],
    });

    const { toSelect } = TrackSelectionService.computeTrackClassChanges(
      [grade4Track1, grade5Track1],
      [],
      4,
      1
    );

    expect(toSelect.map(c => c.id)).toEqual(["grade4"]);
  });

  it("does not re-select a track class that is already selected", () => {
    const track1Math = makeClass({ id: "math-1", trackNumber: 1 });
    const currentSchedule = [makeSelection(track1Math)];

    const { toSelect, toUnselectIds } =
      TrackSelectionService.computeTrackClassChanges(
        [track1Math],
        currentSchedule,
        4,
        1
      );

    expect(toSelect).toEqual([]);
    expect(toUnselectIds).toEqual([]);
  });

  it("leaves non-track selections untouched", () => {
    const noTrack = makeClass({ id: "no-track", trackNumber: null });
    const currentSchedule = [makeSelection(noTrack)];

    const { toUnselectIds } = TrackSelectionService.computeTrackClassChanges(
      [noTrack],
      currentSchedule,
      4,
      1
    );

    expect(toUnselectIds).toEqual([]);
  });
});
