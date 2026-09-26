import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ClassWithTimeSlot,
  ScheduleOverrideWithChildName,
  StaffSelection,
  TimeSlot,
} from "../types";
import { classesApi, scheduleApi, scheduleOverridesApi, staffApi } from "./api";
import { ScheduleService } from "./scheduleService";
import {
  parseStaffKey,
  staffKeyToParam,
  StaffScheduleService,
} from "./staffScheduleService";

vi.mock("./api", () => ({
  classesApi: {
    getTeacherTitlePairs: vi.fn(),
    getClassesByTeacher: vi.fn(),
    getClassesByUserId: vi.fn(),
  },
  scheduleOverridesApi: {
    getOverridesByTeacher: vi.fn(),
    getOverridesByUserId: vi.fn(),
  },
  scheduleApi: {
    getCommittedSelectionsMadeBy: vi.fn(),
  },
  staffApi: {
    getStaffDirectory: vi.fn(),
  },
}));

const USER_ID = "0c9e4490-d6fc-442c-b4da-5a0b7e256314";
const OTHER_USER_ID = "57b60ab3-d6e8-4d0a-902b-b04a2f01cfc1";

const timeSlot = (
  id: string,
  startTime: string,
  endTime: string
): TimeSlot => ({
  id,
  name: id,
  startTime,
  endTime,
  createdAt: "",
  updatedAt: "",
});

const tsFirst = timeSlot("ts-first", "08:00", "08:45");
const tsSecond = timeSlot("ts-second", "08:45", "09:30");

const makeClass = (
  overrides: Partial<ClassWithTimeSlot> = {}
): ClassWithTimeSlot => ({
  id: "class-1",
  title: "מתמטיקה",
  description: "",
  teacher: "דנה",
  slots: [{ dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst }],
  grades: [3],
  isMandatory: false,
  isDouble: false,
  groupNumber: null,
  trackNumber: null,
  room: "חדר 1",
  scope: "prod",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

const makeOverride = (
  overrides: Partial<ScheduleOverrideWithChildName> = {}
): ScheduleOverrideWithChildName => ({
  id: "override-1",
  childId: "child-1",
  childName: "נועה לוי",
  title: "תגבור",
  teacher: "דנה",
  room: "חדר 7",
  dayOfWeek: 1,
  timeSlotId: tsFirst.id,
  timeSlot: tsFirst,
  scope: "prod",
  createdBy: "staff-1",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

const makeSelection = (
  overrides: Partial<StaffSelection> = {}
): StaffSelection => ({
  class: makeClass({
    id: "mentoring-1",
    title: "חונכות",
    teacher: "חונכ/ת",
    slots: [{ dayOfWeek: 3, timeSlotId: tsFirst.id, timeSlot: tsFirst }],
  }),
  childId: "child-1",
  childName: "נועה לוי",
  ...overrides,
});

const build = (input: {
  catalog?: ClassWithTimeSlot[];
  selections?: StaffSelection[];
  overrides?: ScheduleOverrideWithChildName[];
}) =>
  StaffScheduleService.buildStaffView({
    catalog: input.catalog ?? [],
    selections: input.selections ?? [],
    overrides: input.overrides ?? [],
  });

const conflictsOf = (
  view: ReturnType<typeof build>,
  cls: ClassWithTimeSlot
): boolean => ScheduleService.hasTimeConflict(view.userSelections, cls);

describe("StaffScheduleService.buildStaffView", () => {
  it("places catalog classes in the grid and marks them all selected", () => {
    const view = build({ catalog: [makeClass()] });

    expect(view.weeklySchedule[0][tsFirst.id].map(c => c.id)).toEqual([
      "class-1",
    ]);
    expect(view.selectedClasses).toEqual(["class-1"]);
  });

  it("excludes Special Classes, including כישורי חיים", () => {
    const view = build({
      catalog: [
        makeClass({ id: "a", title: "חונכות" }),
        makeClass({ id: "b", title: "שילוב" }),
        makeClass({ id: "c", title: "מחויבות אישית" }),
        makeClass({ id: "d", title: "כישורי חיים" }),
        makeClass({ id: "e", title: "מתמטיקה" }),
      ],
    });

    expect(view.classes.map(c => c.id)).toEqual(["e"]);
  });

  it("groups overrides by title, day and slot into one entry listing the children", () => {
    const view = build({
      overrides: [
        makeOverride({ id: "o1", childId: "c1", childName: "נועה לוי" }),
        makeOverride({ id: "o2", childId: "c2", childName: "אבי כהן" }),
        makeOverride({
          id: "o3",
          childId: "c3",
          childName: "רון",
          dayOfWeek: 2,
        }),
      ],
    });

    const monday = view.weeklySchedule[1][tsFirst.id];
    expect(monday).toHaveLength(1);
    expect(monday[0].title).toBe("תגבור");
    expect(monday[0].teacher).toBe("אבי כהן, נועה לוי");
    expect(monday[0].grades).toEqual([]);
    expect(view.extraEnrollmentCounts.get(monday[0].id)).toBe(2);

    expect(view.weeklySchedule[2][tsFirst.id]).toHaveLength(1);
    expect(view.classes).toHaveLength(2);
  });

  it("keeps overrides with different titles in the same slot apart (and in conflict)", () => {
    const view = build({
      overrides: [
        makeOverride({ id: "o1", title: "תגבור" }),
        makeOverride({ id: "o2", title: "קריאה", childId: "c2" }),
      ],
    });

    const cell = view.weeklySchedule[1][tsFirst.id];
    expect(cell).toHaveLength(2);
    expect(cell.every(cls => conflictsOf(view, cls))).toBe(true);
  });

  it("flags a catalog class and an override sharing a slot as a conflict", () => {
    const view = build({
      catalog: [
        makeClass({
          slots: [{ dayOfWeek: 1, timeSlotId: tsFirst.id, timeSlot: tsFirst }],
        }),
      ],
      overrides: [makeOverride()],
    });

    const cell = view.weeklySchedule[1][tsFirst.id];
    expect(cell).toHaveLength(2);
    expect(cell.every(cls => conflictsOf(view, cls))).toBe(true);
  });

  it("flags two catalog classes sharing a slot as a conflict", () => {
    const view = build({
      catalog: [
        makeClass({ id: "a" }),
        makeClass({ id: "b", title: "אנגלית" }),
      ],
    });

    expect(view.classes.every(cls => conflictsOf(view, cls))).toBe(true);
  });

  it("does not flag a grouped override against itself", () => {
    const view = build({
      overrides: [
        makeOverride({ id: "o1", childId: "c1" }),
        makeOverride({ id: "o2", childId: "c2", childName: "אבי" }),
      ],
    });

    expect(view.classes).toHaveLength(1);
    expect(conflictsOf(view, view.classes[0])).toBe(false);
  });

  it("keeps both slots of a double lesson without a self-conflict", () => {
    const double = makeClass({
      isDouble: true,
      slots: [
        { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
        { dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond },
      ],
    });
    const view = build({ catalog: [double] });

    expect(view.weeklySchedule[0][tsFirst.id]).toEqual([double]);
    expect(view.weeklySchedule[0][tsSecond.id]).toEqual([double]);
    expect(conflictsOf(view, double)).toBe(false);
  });

  it("groups a tutor's selections per class, listing the children", () => {
    const view = build({
      selections: [
        makeSelection({ childId: "c1", childName: "נועה לוי" }),
        makeSelection({ childId: "c2", childName: "אבי כהן" }),
        makeSelection({
          class: makeClass({
            id: "integration-1",
            title: "שילוב",
            teacher: "חונכ/ת",
            slots: [
              { dayOfWeek: 4, timeSlotId: tsFirst.id, timeSlot: tsFirst },
            ],
          }),
          childId: "c3",
          childName: "רון",
        }),
      ],
    });

    const wednesday = view.weeklySchedule[3][tsFirst.id];
    expect(wednesday).toHaveLength(1);
    expect(wednesday[0].title).toBe("חונכות");
    expect(wednesday[0].teacher).toBe("אבי כהן, נועה לוי");
    expect(view.extraEnrollmentCounts.get(wednesday[0].id)).toBe(2);
    expect(view.weeklySchedule[4][tsFirst.id]).toHaveLength(1);
    expect(view.classes).toHaveLength(2);
  });

  it("keeps a grouped selection's catalog details and never conflicts with itself", () => {
    const view = build({
      selections: [
        makeSelection({ childId: "c1" }),
        makeSelection({ childId: "c2", childName: "אבי" }),
      ],
    });

    const [grouped] = view.classes;
    expect(grouped.id).not.toBe("mentoring-1");
    expect(grouped.room).toBe("חדר 1");
    expect(grouped.slots).toHaveLength(1);
    expect(conflictsOf(view, grouped)).toBe(false);
  });

  it("flags a selection sharing a slot with a catalog class as a conflict", () => {
    const view = build({
      catalog: [
        makeClass({
          slots: [{ dayOfWeek: 3, timeSlotId: tsFirst.id, timeSlot: tsFirst }],
        }),
      ],
      selections: [makeSelection()],
    });

    const cell = view.weeklySchedule[3][tsFirst.id];
    expect(cell).toHaveLength(2);
    expect(cell.every(cls => conflictsOf(view, cls))).toBe(true);
  });
});

describe("staff keys", () => {
  it("parses a UUID as a user and anything else as a trimmed name", () => {
    expect(parseStaffKey(USER_ID)).toEqual({ kind: "user", id: USER_ID });
    expect(parseStaffKey(USER_ID.toUpperCase())).toEqual({
      kind: "user",
      id: USER_ID.toUpperCase(),
    });
    expect(parseStaffKey(" רם ז'אן ")).toEqual({
      kind: "name",
      name: "רם ז'אן",
    });
  });

  it("returns undefined for a missing or blank param", () => {
    expect(parseStaffKey(null)).toBeUndefined();
    expect(parseStaffKey(undefined)).toBeUndefined();
    expect(parseStaffKey("  ")).toBeUndefined();
  });

  it("round-trips through the URL param", () => {
    const keys = [
      { kind: "user", id: USER_ID } as const,
      { kind: "name", name: "בת שירות 1" } as const,
    ];
    keys.forEach(key =>
      expect(parseStaffKey(staffKeyToParam(key))).toEqual(key)
    );
  });
});

describe("StaffScheduleService.toStaffMembers", () => {
  const pair = (
    teacher: string,
    title: string,
    userId: string | null = null
  ) => ({
    teacher,
    title,
    userId,
  });

  it("returns distinct, trimmed, alphabetical names for unlinked teachers", () => {
    expect(
      StaffScheduleService.toStaffMembers(
        [
          pair(" רונית ", "מתמטיקה"),
          pair("רונית", "אנגלית"),
          pair("אבי", "ספורט"),
          pair("", "אמנות"),
        ],
        []
      )
    ).toEqual([
      { key: { kind: "name", name: "אבי" }, label: "אבי", teaches: true },
      { key: { kind: "name", name: "רונית" }, label: "רונית", teaches: true },
    ]);
  });

  it("excludes the placeholder names", () => {
    expect(
      StaffScheduleService.toStaffMembers(
        [
          pair("חונכ/ת", "מתמטיקה"),
          pair(" חונכ/ת ", "אנגלית"),
          pair("כללי", "אסיפה"),
          pair("לא ידוע", "מדעים"),
        ],
        []
      )
    ).toEqual([]);
  });

  it("lists every directory user, folding their linked classes into them", () => {
    expect(
      StaffScheduleService.toStaffMembers(
        [pair("טלוש שור", "מדעים", USER_ID), pair("רם ז'אן", "ספורט")],
        [
          { id: USER_ID, displayName: "טלוש שור" },
          { id: OTHER_USER_ID, displayName: "ארי נירון" },
        ]
      )
    ).toEqual([
      { key: { kind: "user", id: USER_ID }, label: "טלוש שור", teaches: true },
      {
        key: { kind: "name", name: "רם ז'אן" },
        label: "רם ז'אן",
        teaches: true,
      },
      {
        key: { kind: "user", id: OTHER_USER_ID },
        label: "ארי נירון",
        teaches: false,
      },
    ]);
  });

  it("drops an unlinked name that duplicates a user's label", () => {
    expect(
      StaffScheduleService.toStaffMembers(
        [pair("טלוש שור", "מדעים")],
        [{ id: USER_ID, displayName: "טלוש שור" }]
      )
    ).toEqual([
      { key: { kind: "user", id: USER_ID }, label: "טלוש שור", teaches: false },
    ]);
  });

  it("lists staff with no regular lessons last, alphabetically, not by lesson count", () => {
    expect(
      StaffScheduleService.toStaffMembers(
        [
          pair("תמר", "כישורי חיים"),
          pair("אורי", "שילוב"),
          pair("יעל", "שילוב"),
          pair("יעל", "מדעים"),
          pair("בני", "ספורט"),
          pair("בני", "ספורט"),
          pair("בני", "ספורט"),
        ],
        []
      ).map(({ label, teaches }) => ({ label, teaches }))
    ).toEqual([
      { label: "בני", teaches: true },
      { label: "יעל", teaches: true },
      { label: "אורי", teaches: false },
      { label: "תמר", teaches: false },
    ]);
  });
});

describe("StaffScheduleService.resolveStaffKey", () => {
  const directory = [{ id: USER_ID, displayName: "טלוש שור" }];

  it("resolves a name matching a directory user to that user", () => {
    expect(
      StaffScheduleService.resolveStaffKey(
        { kind: "name", name: "טלוש שור" },
        directory
      )
    ).toEqual({ kind: "user", id: USER_ID });
  });

  it("keeps other keys unchanged", () => {
    const name = { kind: "name", name: "רם ז'אן" } as const;
    const user = { kind: "user", id: OTHER_USER_ID } as const;
    expect(StaffScheduleService.resolveStaffKey(name, directory)).toBe(name);
    expect(StaffScheduleService.resolveStaffKey(user, directory)).toBe(user);
  });
});

describe("StaffScheduleService fetchers", () => {
  beforeEach(() => {
    vi.mocked(classesApi.getTeacherTitlePairs).mockReset();
    vi.mocked(classesApi.getClassesByTeacher).mockReset().mockResolvedValue([]);
    vi.mocked(classesApi.getClassesByUserId).mockReset().mockResolvedValue([]);
    vi.mocked(scheduleOverridesApi.getOverridesByTeacher)
      .mockReset()
      .mockResolvedValue([]);
    vi.mocked(scheduleOverridesApi.getOverridesByUserId)
      .mockReset()
      .mockResolvedValue([]);
    vi.mocked(scheduleApi.getCommittedSelectionsMadeBy)
      .mockReset()
      .mockResolvedValue([]);
    vi.mocked(staffApi.getStaffDirectory).mockReset().mockResolvedValue([]);
  });

  it("getStaffMembers combines the catalog pairs and the staff directory", async () => {
    vi.mocked(classesApi.getTeacherTitlePairs).mockResolvedValue([
      { teacher: "חונכ/ת", title: "מתמטיקה", userId: null },
      { teacher: "דנה ", title: "מתמטיקה", userId: null },
    ]);
    vi.mocked(staffApi.getStaffDirectory).mockResolvedValue([
      { id: USER_ID, displayName: "פועה דרוקס" },
    ]);

    const members = await StaffScheduleService.getStaffMembers();

    expect(members.map(m => m.label)).toEqual(["דנה", "פועה דרוקס"]);
  });

  it("loads a user's week by id: catalog, overrides and staff-only selections", async () => {
    vi.mocked(classesApi.getClassesByUserId).mockResolvedValue([
      makeClass({ id: "a" }),
      makeClass({ id: "life-skills", title: "כישורי חיים" }),
    ]);
    vi.mocked(scheduleOverridesApi.getOverridesByUserId).mockResolvedValue([
      makeOverride(),
    ]);
    vi.mocked(scheduleApi.getCommittedSelectionsMadeBy).mockResolvedValue([
      makeSelection(),
      // A regular class the tutor happened to commit: not theirs to teach.
      makeSelection({ class: makeClass({ id: "english", title: "אנגלית" }) }),
      // Special, but pre-selected -- not set by the tutor (known gap).
      makeSelection({
        class: makeClass({ id: "life", title: "כישורי חיים" }),
      }),
    ]);

    const view = await StaffScheduleService.getStaffView({
      kind: "user",
      id: USER_ID,
    });

    expect(classesApi.getClassesByUserId).toHaveBeenCalledWith(USER_ID);
    expect(scheduleOverridesApi.getOverridesByUserId).toHaveBeenCalledWith(
      USER_ID
    );
    expect(scheduleApi.getCommittedSelectionsMadeBy).toHaveBeenCalledWith(
      USER_ID
    );
    expect(classesApi.getClassesByTeacher).not.toHaveBeenCalled();
    expect(view.classes.map(c => c.title).sort()).toEqual(
      ["חונכות", "מתמטיקה", "תגבור"].sort()
    );
  });

  it("loads a name-only teacher's week by name, with no selections", async () => {
    vi.mocked(classesApi.getClassesByTeacher).mockResolvedValue([
      makeClass({ id: "a" }),
    ]);
    vi.mocked(scheduleOverridesApi.getOverridesByTeacher).mockResolvedValue([
      makeOverride(),
    ]);

    const view = await StaffScheduleService.getStaffView({
      kind: "name",
      name: "רם ז'אן",
    });

    expect(classesApi.getClassesByTeacher).toHaveBeenCalledWith("רם ז'אן");
    expect(scheduleOverridesApi.getOverridesByTeacher).toHaveBeenCalledWith(
      "רם ז'אן"
    );
    expect(scheduleApi.getCommittedSelectionsMadeBy).not.toHaveBeenCalled();
    expect(view.classes).toHaveLength(2);
  });

  it("treats a name that now belongs to a user (old link) as that user", async () => {
    vi.mocked(staffApi.getStaffDirectory).mockResolvedValue([
      { id: USER_ID, displayName: "טלוש שור" },
    ]);

    await StaffScheduleService.getStaffView({
      kind: "name",
      name: "טלוש שור",
    });

    expect(classesApi.getClassesByUserId).toHaveBeenCalledWith(USER_ID);
    expect(classesApi.getClassesByTeacher).not.toHaveBeenCalled();
  });
});

describe("StaffScheduleService.resolveTeacherUserId", () => {
  const members = [
    {
      key: { kind: "user", id: USER_ID } as const,
      label: "טלוש שור",
      teaches: true,
    },
    {
      key: { kind: "name", name: "רם ז'אן" } as const,
      label: "רם ז'אן",
      teaches: true,
    },
  ];

  it("links a teacher text matching a staff user's display name", () => {
    expect(
      StaffScheduleService.resolveTeacherUserId(" טלוש שור ", members)
    ).toBe(USER_ID);
  });

  it("leaves free text and name-only teachers unlinked", () => {
    expect(StaffScheduleService.resolveTeacherUserId("רם ז'אן", members)).toBe(
      null
    );
    expect(StaffScheduleService.resolveTeacherUserId("מורה חדש", members)).toBe(
      null
    );
  });

  it("keeps an existing link while the teacher text is unchanged", () => {
    // e.g. the staff list failed to load while editing a linked class
    expect(
      StaffScheduleService.resolveTeacherUserId("טלוש שור", [], {
        teacher: "טלוש שור",
        userId: USER_ID,
      })
    ).toBe(USER_ID);
  });

  it("drops the link once the teacher text changes to someone unlinked", () => {
    expect(
      StaffScheduleService.resolveTeacherUserId("רם ז'אן", members, {
        teacher: "טלוש שור",
        userId: USER_ID,
      })
    ).toBe(null);
  });
});
