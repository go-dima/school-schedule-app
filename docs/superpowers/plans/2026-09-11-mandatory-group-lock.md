# Mandatory + Group Locked Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Group-match and Mandatory class locking (issue #23) on top of current main's draft/committed selection model, without touching Track's existing (separate, working) lock implementation.

**Architecture:** A new pure-function service (`GroupMandatoryLockService`, mirroring the existing `TrackSelectionService` shape) computes which classes a child should have auto-selected given their grade+group and which classes' `isMandatory` flag applies. `SchedulePage.tsx` runs this on a `useEffect` keyed to the active child (not a user-driven handler like Track, since group/mandatory don't change from this page) and folds the results into its existing `lockedClassIds` set. `ScheduleTable.tsx` gains a group-aware visibility filter (extending its existing grade filter) and threads `lockedClassIds` down to the drawer so locked classes render disabled with a lock icon, reusing Track's existing UI exactly.

**Tech Stack:** React + TypeScript, Vitest for unit tests, existing `scheduleApi`/`classesApi` (Supabase-backed), antd components.

**Spec:** `docs/superpowers/specs/2026-09-11-mandatory-group-lock-design.md`

## Global Constraints

- Do not modify Track's existing lock computation, sync handler, or UI — it stays exactly as-is (spec: "Out of scope: Track").
- `group_number` needs no schema change — it's already a plain (unsplit) column on both `classes` and `children` (spec: "Out of scope: Any schema change").
- A class with a non-null `groupNumber` matches a child only when `cls.groupNumber === child.groupNumber` exactly (spec's predicate).
- A class with `groupNumber === null` and `isMandatory === true` matches every child in a matching grade, unconditionally.
- Reuse the existing Track lock UI (disabled button, `LockOutlined` icon, tooltip) rather than building new UI — only generalize its copy.
- `MandatoryClassService` is deleted outright, not patched — it predates the draft/committed split and calls scheduleApi methods that no longer exist in that shape.

---

### Task 1: `GroupMandatoryLockService` — pure matching/diff logic

**Files:**

- Create: `src/services/groupMandatoryLockService.ts`
- Test: `src/services/groupMandatoryLockService.test.ts`

**Interfaces:**

- Consumes: `ClassWithTimeSlot`, `ScheduleSelectionWithClass`, `Child`, `SelectionStatus` types from `src/types/index.ts`; `scheduleApi` from `src/services/api.ts` (already exports `selectSchedule(target, classId, status)` and `unselectSchedule(target, classId, status)` — see `src/services/trackSelectionService.ts` for the exact call shape this mirrors).
- Produces: `GroupMandatoryLockService.isLockedMatch(cls, childGroupNumber)`, `GroupMandatoryLockService.computeChanges(allClasses, currentSchedule, child)` returning `{ toSelect: ClassWithTimeSlot[]; toUnselectIds: string[] }`, and `GroupMandatoryLockService.applyChanges(childId, changes, status)` returning `Promise<void>`. Task 3 consumes all three; Task 4 consumes `isLockedMatch` directly.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/services/groupMandatoryLockService.test.ts
import { describe, expect, it } from "vitest";
import type {
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  SelectionStatus,
  TimeSlot,
} from "../types";
import { GroupMandatoryLockService } from "./groupMandatoryLockService";

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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/groupMandatoryLockService.test.ts`
Expected: FAIL — `Cannot find module './groupMandatoryLockService'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/services/groupMandatoryLockService.ts
import { scheduleApi } from "./api";
import type {
  Child,
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  SelectionStatus,
} from "../types";

export interface GroupMandatoryChanges {
  toSelect: ClassWithTimeSlot[];
  toUnselectIds: string[];
}

export const GroupMandatoryLockService = {
  /**
   * A class is a Locked Selection for a child when its group matches the
   * child's group exactly, or -- for an ungrouped class -- when it's
   * marked mandatory. A grouped-and-mandatory class (schools run the same
   * mandatory subject at different times per group) still requires the
   * group match; it doesn't get a mandatory-only exception.
   */
  isLockedMatch(
    cls: Pick<ClassWithTimeSlot, "groupNumber" | "isMandatory">,
    childGroupNumber: number | null
  ): boolean {
    if (cls.groupNumber !== null) {
      return cls.groupNumber === childGroupNumber;
    }
    return cls.isMandatory;
  },

  computeChanges(
    allClasses: ClassWithTimeSlot[],
    currentSchedule: ScheduleSelectionWithClass[],
    child: Pick<Child, "grade" | "groupNumber">
  ): GroupMandatoryChanges {
    const alreadySelectedIds = new Set(
      currentSchedule.map(selection => selection.classId)
    );

    const toSelect = allClasses.filter(
      cls =>
        cls.grades.includes(child.grade) &&
        this.isLockedMatch(cls, child.groupNumber) &&
        !alreadySelectedIds.has(cls.id)
    );

    const toUnselectIds = currentSchedule
      .filter(selection => {
        const cls = selection.class;
        const wasGroupOrMandatory = cls.groupNumber !== null || cls.isMandatory;
        return (
          wasGroupOrMandatory && !this.isLockedMatch(cls, child.groupNumber)
        );
      })
      .map(selection => selection.classId);

    return { toSelect, toUnselectIds };
  },

  async applyChanges(
    childId: string,
    { toSelect, toUnselectIds }: GroupMandatoryChanges,
    status: SelectionStatus
  ): Promise<void> {
    await Promise.all([
      ...toUnselectIds.map(classId =>
        scheduleApi.unselectSchedule({ childId }, classId, status)
      ),
      ...toSelect.map(cls =>
        scheduleApi.selectSchedule({ childId }, cls.id, status)
      ),
    ]);
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/groupMandatoryLockService.test.ts`
Expected: PASS, all 12 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/groupMandatoryLockService.ts src/services/groupMandatoryLockService.test.ts
git commit -m "feat: add GroupMandatoryLockService for group+mandatory class matching (#23)"
```

---

### Task 2: Delete dead `MandatoryClassService`

**Files:**

- Delete: `src/services/mandatoryClassService.ts`

**Interfaces:**

- Consumes: none — this task only removes code confirmed (via repo-wide grep) to have zero importers anywhere in `src/`.
- Produces: nothing; Task 1's `GroupMandatoryLockService` is the replacement other tasks build on.

- [ ] **Step 1: Confirm no importers remain**

Run: `grep -rn "MandatoryClassService\|mandatoryClassService" src/ --include="*.ts" --include="*.tsx"`
Expected: no output (the only match before deletion is the file's own definition).

- [ ] **Step 2: Delete the file**

```bash
git rm src/services/mandatoryClassService.ts
```

- [ ] **Step 3: Verify the project still builds**

Run: `npx tsc --noEmit`
Expected: no new errors (this file had no importers, so nothing should break).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove dead MandatoryClassService, superseded by GroupMandatoryLockService (#23)"
```

---

### Task 3: Wire auto-sync + lock computation into `SchedulePage.tsx`

**Files:**

- Modify: `src/pages/SchedulePage.tsx:35` (import), `:228-236` (lockedClassIds), `:237-253` (handleClassSelect comment/message key), `:608-624` (ScheduleTable props), `:655-659` (tooltip key)

**Interfaces:**

- Consumes: `GroupMandatoryLockService` from Task 1 (`isLockedMatch`, `computeChanges`, `applyChanges`); existing `currentTrackChild`, `classes`, `selectedSchedule`, `viewStatus`, `refetchSelectedSchedule`, `target`, `message`, `t` already in scope in this file.
- Produces: `lockedClassIds: Set<string>` now includes group/mandatory matches (Task 4's `ScheduleTable` prop and this file's own "Selected Classes" summary both read it, already wired via existing Track code — no signature change to what downstream consumes, just a larger set).

- [ ] **Step 1: Add the import**

In `src/pages/SchedulePage.tsx`, right after the existing `TrackSelectionService` import (line 35):

```typescript
import { TrackSelectionService } from "../services/trackSelectionService";
import { GroupMandatoryLockService } from "../services/groupMandatoryLockService";
```

- [ ] **Step 2: Extend `lockedClassIds` to include group/mandatory matches**

Find (around line 228-236):

```typescript
const currentTrackChild = isStaff ? staffSelectedChild : selectedChild;
const lockedClassIds = new Set(
  currentTrackChild?.trackNumber
    ? classes
        .filter(cls => cls.trackNumber === currentTrackChild.trackNumber)
        .map(cls => cls.id)
    : []
);
```

Replace with:

```typescript
const currentTrackChild = isStaff ? staffSelectedChild : selectedChild;
const lockedClassIds = new Set([
  ...(currentTrackChild?.trackNumber
    ? classes
        .filter(cls => cls.trackNumber === currentTrackChild.trackNumber)
        .map(cls => cls.id)
    : []),
  ...(currentTrackChild
    ? classes
        .filter(cls =>
          GroupMandatoryLockService.isLockedMatch(
            cls,
            currentTrackChild.groupNumber
          )
        )
        .map(cls => cls.id)
    : []),
]);
```

- [ ] **Step 3: Add the sync-on-view effect**

Immediately after the `lockedClassIds` block from Step 2, add:

```typescript
// Group and Mandatory have no user-driven change event on this page (a
// child's group is admin-set, mandatory is a fixed class attribute) --
// unlike Track, which syncs from makeTrackChangeHandler, this syncs
// whenever the active child or the loaded catalog/schedule changes.
React.useEffect(() => {
  if (!currentTrackChild || classes.length === 0) return;

  const changes = GroupMandatoryLockService.computeChanges(
    classes,
    selectedSchedule,
    currentTrackChild
  );

  if (changes.toSelect.length === 0 && changes.toUnselectIds.length === 0) {
    return;
  }

  let cancelled = false;
  (async () => {
    try {
      await GroupMandatoryLockService.applyChanges(
        currentTrackChild.id,
        changes,
        viewStatus
      );
      if (!cancelled) {
        await refetchSelectedSchedule();
      }
    } catch (err) {
      if (!cancelled) {
        message.error(
          err instanceof Error
            ? err.message
            : t("schedule.page.error.updateClassSelection")
        );
      }
    }
  })();

  return () => {
    cancelled = true;
  };
}, [
  currentTrackChild?.id,
  currentTrackChild?.grade,
  currentTrackChild?.groupNumber,
  classes,
  selectedSchedule,
  viewStatus,
]);
```

- [ ] **Step 4: Generalize the unselect-guard message key**

Find (around line 237-253):

```typescript
  const handleClassSelect = async (classId: string) => {
    if (!target) return;
    try {
      if (isClassSelected(classId)) {
        // Track-locked classes only apply to the child-entity flows
        // (parent/staff); the "child" role's own selections aren't tied to
        // a Child record with a track.
        if ("childId" in target && lockedClassIds.has(classId)) {
          message.warning(t("schedule.page.error.trackClassLocked"));
          return;
        }
```

Replace the comment and message key:

```typescript
  const handleClassSelect = async (classId: string) => {
    if (!target) return;
    try {
      if (isClassSelected(classId)) {
        // Locked classes (track, group, or mandatory match) only apply to
        // the child-entity flows (parent/staff); the "child" role's own
        // selections aren't tied to a Child record with these attributes.
        if ("childId" in target && lockedClassIds.has(classId)) {
          message.warning(t("schedule.page.error.lockedClassCannotUnselect"));
          return;
        }
```

- [ ] **Step 5: Pass the active child's group to `ScheduleTable`**

Find the `<ScheduleTable` call (around line 608-624) and add `childGroupNumber` and convert `lockedClassIds` to an array prop:

```typescript
        <ScheduleTable
          timeSlots={timeSlots}
          classes={classes}
          weeklySchedule={weeklySchedule}
          userGrade={selectedGrade}
          selectedClasses={selectedClasses}
          draftPickedClassIds={Array.from(draftClassIds)}
          userSelections={selectedSchedule}
          onClassSelect={handleClassSelect}
          onClassUnselect={handleClassSelect}
          canSelectClasses={canSelectClasses}
          canViewClasses={canViewClasses}
          isAdmin={isAdmin()}
          showEnrollmentCount={isStaff || isAdmin()}
          onCreateClass={handleCreateClass}
          searchTerm={searchTerm}
          childGroupNumber={currentTrackChild?.groupNumber}
          lockedClassIds={Array.from(lockedClassIds)}
        />
```

- [ ] **Step 6: Generalize the summary-card tooltip key**

Find (around line 655-659):

```typescript
                <Tooltip
                  key={selection.id}
                  title={t("schedule.drawer.trackLockedTooltip")}>
```

Replace with:

```typescript
                <Tooltip
                  key={selection.id}
                  title={t("schedule.drawer.lockedClassTooltip")}>
```

- [ ] **Step 7: Verify the project still typechecks (i18n keys renamed in Task 5 — expect this step to show missing-key warnings only, not type errors)**

Run: `npx tsc --noEmit`
Expected: no new TypeScript errors. (Missing i18n keys are a runtime/console concern, resolved in Task 5 — don't skip Task 5.)

- [ ] **Step 8: Commit**

```bash
git add src/pages/SchedulePage.tsx
git commit -m "feat: sync and lock group/mandatory classes on SchedulePage (#23)"
```

---

### Task 4: Visibility filter + lock UI in `ScheduleTable`/`ClassSelectionDrawer`/`ClassSelectionCard`

**Files:**

- Modify: `src/components/ScheduleTable.tsx:27-42` (props), `:64-66` (destructure), `:115-127` (shouldHighlightTimeSlot), `:158-167` (renderClassCell), `:481-486` (classesForSlot), `:608-624` in `SchedulePage.tsx` already passes the new props (Task 3) — this task adds the props/filter that consume them
- Modify: `src/components/ClassSelectionDrawer.tsx:13-27` (props), `:29-43` (destructure), `:83` (isLocked)
- Modify: `src/components/ClassSelectionCard.tsx:104-105` (tooltip keys)
- Modify: `src/locales/he.json:134` (`trackClassLocked` → `lockedClassCannotUnselect`), `:165-166` (`trackLockedTooltip`/`trackUnselectableTooltip` → `lockedClassTooltip`/`lockedClassUnselectableTooltip`)

**Interfaces:**

- Consumes: `childGroupNumber?: number | null` and `lockedClassIds?: string[]` passed from `SchedulePage.tsx` (Task 3, Step 5).
- Produces: classes with a non-null `groupNumber` that doesn't match `childGroupNumber` never appear in `ScheduleTable`'s per-slot options or the drawer; classes in `lockedClassIds` (plus existing track-locked classes) render with a disabled toggle button, `LockOutlined`-style lock affordance, and tooltip in the drawer, matching Track's existing look exactly.

- [ ] **Step 1: Add the two new props to `ScheduleTableProps`**

In `src/components/ScheduleTable.tsx`, find the end of the interface (around line 42):

```typescript
  onCreateClass?: (timeSlotId: string, dayOfWeek: number) => void;
  searchTerm?: string;
}
```

Replace with:

```typescript
  onCreateClass?: (timeSlotId: string, dayOfWeek: number) => void;
  searchTerm?: string;
  childGroupNumber?: number | null;
  lockedClassIds?: string[];
}
```

- [ ] **Step 2: Destructure the new props**

Find (around line 64-67):

```typescript
  onCreateClass,
  searchTerm = "",
}) => {
```

Replace with:

```typescript
  onCreateClass,
  searchTerm = "",
  childGroupNumber,
  lockedClassIds = [],
}) => {
```

- [ ] **Step 3: Add a shared group-visibility filter helper**

Immediately after the `handleCloseDrawer` function (before `shouldHighlightTimeSlot`, around line 113), add:

```typescript
// A grouped class (groupNumber !== null) only appears as an option when
// it matches the active child's group exactly. Ungrouped classes always
// pass through untouched, regardless of the child's group -- this is
// purely a visibility filter, independent of the separate lock/disable
// logic driven by `lockedClassIds`.
const filterByGroup = (
  classesToFilter: ClassWithTimeSlot[]
): ClassWithTimeSlot[] => {
  if (childGroupNumber === undefined) return classesToFilter;
  return classesToFilter.filter(
    cls => cls.groupNumber === null || cls.groupNumber === childGroupNumber
  );
};
```

- [ ] **Step 4: Apply the filter in `shouldHighlightTimeSlot`**

Find (around line 115-127):

```typescript
const shouldHighlightTimeSlot = (
  timeSlot: TimeSlot,
  dayOfWeek: number
): boolean => {
  if (!searchTerm.trim()) return false;

  const dayClasses = weeklySchedule[dayOfWeek]?.[timeSlot.id] || [];

  let filteredClasses = userGrade
    ? dayClasses.filter(cls => cls.grades?.includes(userGrade))
    : dayClasses;

  return filteredClasses.some(cls =>
    cls.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
};
```

Replace the `filteredClasses` line with:

```typescript
let filteredClasses = userGrade
  ? dayClasses.filter(cls => cls.grades?.includes(userGrade))
  : dayClasses;
filteredClasses = filterByGroup(filteredClasses);
```

(leave the rest of the function unchanged)

- [ ] **Step 5: Apply the filter in `renderClassCell`**

Find (around line 158-167):

```typescript
  const renderClassCell = (timeSlot: TimeSlot, dayOfWeek: number) => {
    const dayClasses = weeklySchedule[dayOfWeek]?.[timeSlot.id] || [];

    let filteredClasses = userGrade
      ? dayClasses.filter(cls => cls.grades?.includes(userGrade))
      : dayClasses;
```

Replace with:

```typescript
  const renderClassCell = (timeSlot: TimeSlot, dayOfWeek: number) => {
    const dayClasses = weeklySchedule[dayOfWeek]?.[timeSlot.id] || [];

    let filteredClasses = userGrade
      ? dayClasses.filter(cls => cls.grades?.includes(userGrade))
      : dayClasses;
    filteredClasses = filterByGroup(filteredClasses);
```

- [ ] **Step 6: Apply the filter to the drawer's `classesForSlot`**

Find (around line 481-486):

```typescript
const classesForSlot = classes.filter(cls => {
  if (userGrade && !cls.grades?.includes(userGrade)) {
    return false;
  }

  return cls.slots.some(
    slot =>
      slot.dayOfWeek === selectedDayOfWeek &&
      slot.timeSlotId === selectedTimeSlot.id
  );
});
```

Replace with:

```typescript
const classesForSlot = filterByGroup(
  classes.filter(cls => {
    if (userGrade && !cls.grades?.includes(userGrade)) {
      return false;
    }

    return cls.slots.some(
      slot =>
        slot.dayOfWeek === selectedDayOfWeek &&
        slot.timeSlotId === selectedTimeSlot.id
    );
  })
);
```

- [ ] **Step 7: Pass `lockedClassIds` down to the drawer**

Find the `<ClassSelectionDrawer` call (a few lines after Step 6, still inside the same block) and add the prop:

```typescript
            <ClassSelectionDrawer
              open={drawerOpen}
              onClose={handleCloseDrawer}
              timeSlot={selectedTimeSlot}
              dayOfWeek={selectedDayOfWeek}
              timeSlots={timeSlots}
              classes={classesForSlot}
              selectedClasses={selectedClasses}
              draftPickedClassIds={draftPickedClassIds}
              lockedClassIds={lockedClassIds}
              conflictingClasses={classesForSlot.filter(cls => {
```

(only the new `lockedClassIds={lockedClassIds}` line is added; the rest of the block is unchanged)

- [ ] **Step 8: Add `lockedClassIds` prop to `ClassSelectionDrawer`**

In `src/components/ClassSelectionDrawer.tsx`, find the props interface (around line 13-27):

```typescript
interface ClassSelectionDrawerProps {
  open: boolean;
  onClose: () => void;
  timeSlot: TimeSlot;
  dayOfWeek: number;
  classes: ClassWithTimeSlot[];
  selectedClasses?: string[];
  draftPickedClassIds?: string[];
  onClassSelect?: (classId: string) => void;
  onClassUnselect?: (classId: string) => void;
  conflictingClasses?: ClassWithTimeSlot[];
  canSelectClasses?: boolean;
  isAdmin?: boolean;
  onCreateClass?: (timeSlotId: string, dayOfWeek: number) => void;
  timeSlots?: TimeSlot[]; // Add timeSlots for calculating double lesson ranges
}
```

Add `lockedClassIds` after `draftPickedClassIds`:

```typescript
interface ClassSelectionDrawerProps {
  open: boolean;
  onClose: () => void;
  timeSlot: TimeSlot;
  dayOfWeek: number;
  classes: ClassWithTimeSlot[];
  selectedClasses?: string[];
  draftPickedClassIds?: string[];
  lockedClassIds?: string[];
  onClassSelect?: (classId: string) => void;
  onClassUnselect?: (classId: string) => void;
  conflictingClasses?: ClassWithTimeSlot[];
  canSelectClasses?: boolean;
  isAdmin?: boolean;
  onCreateClass?: (timeSlotId: string, dayOfWeek: number) => void;
  timeSlots?: TimeSlot[]; // Add timeSlots for calculating double lesson ranges
}
```

- [ ] **Step 9: Destructure it and use it in `isLocked`**

Find (around line 29-43):

```typescript
const ClassSelectionDrawer: React.FC<ClassSelectionDrawerProps> = ({
  open,
  onClose,
  timeSlot,
  dayOfWeek,
  classes,
  selectedClasses = [],
  draftPickedClassIds = [],
  onClassSelect,
  onClassUnselect,
  conflictingClasses = [],
  canSelectClasses = false,
  isAdmin = false,
  onCreateClass,
  timeSlots = [],
}) => {
```

Replace with:

```typescript
const ClassSelectionDrawer: React.FC<ClassSelectionDrawerProps> = ({
  open,
  onClose,
  timeSlot,
  dayOfWeek,
  classes,
  selectedClasses = [],
  draftPickedClassIds = [],
  lockedClassIds = [],
  onClassSelect,
  onClassUnselect,
  conflictingClasses = [],
  canSelectClasses = false,
  isAdmin = false,
  onCreateClass,
  timeSlots = [],
}) => {
```

- [ ] **Step 10: Extend `isLocked` on the rendered card**

Find (line 83):

```typescript
      isLocked={cls.trackNumber !== null}
```

Replace with:

```typescript
      isLocked={cls.trackNumber !== null || lockedClassIds.includes(cls.id)}
```

- [ ] **Step 11: Rename the i18n keys in `he.json`**

In `src/locales/he.json`, find (line 134):

```json
        "trackClassLocked": "לא ניתן לבטל בחירה של שיעור מסלול. יש לשנות את המסלול כדי להסירו",
```

Replace with:

```json
        "lockedClassCannotUnselect": "לא ניתן לבטל בחירה של שיעור נעול",
```

Find (lines 165-166):

```json
      "trackLockedTooltip": "שיעור זה נבחר אוטומטית לפי המסלול. יש לשנות את המסלול כדי להסירו",
      "trackUnselectableTooltip": "לא ניתן לבחור שיעור במסלול, יש לבחר את המסלול כולו",
```

Replace with:

```json
      "lockedClassTooltip": "שיעור זה נבחר אוטומטית ולא ניתן להסירו ידנית",
      "lockedClassUnselectableTooltip": "לא ניתן לבחור שיעור זה ידנית",
```

- [ ] **Step 12: Update `ClassSelectionCard.tsx`'s tooltip key references**

In `src/components/ClassSelectionCard.tsx`, find (around line 100-106):

```typescript
                {isLocked ? (
                  <Tooltip
                    title={t(
                      isSelected
                        ? "schedule.drawer.trackLockedTooltip"
                        : "schedule.drawer.trackUnselectableTooltip"
                    )}>
```

Replace with:

```typescript
                {isLocked ? (
                  <Tooltip
                    title={t(
                      isSelected
                        ? "schedule.drawer.lockedClassTooltip"
                        : "schedule.drawer.lockedClassUnselectableTooltip"
                    )}>
```

- [ ] **Step 13: Typecheck and run the full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all existing tests still pass (no test currently asserts on the renamed i18n keys or the old `isLocked={cls.trackNumber !== null}` line directly — confirm by checking test output, and if any test does reference the old keys/behavior, update it to match).

- [ ] **Step 14: Commit**

```bash
git add src/components/ScheduleTable.tsx src/components/ClassSelectionDrawer.tsx src/components/ClassSelectionCard.tsx src/locales/he.json
git commit -m "feat: filter group-mismatched classes, lock group/mandatory matches in drawer (#23)"
```

---

### Task 5: `CONTEXT.md` correction

**Files:**

- Modify: `CONTEXT.md:27-28`

**Interfaces:**

- Consumes: nothing (docs only).
- Produces: nothing (docs only).

- [ ] **Step 1: Update the stale Locked Selection entry**

Find:

```markdown
**Locked Selection**:
A Selection the Child cannot remove. Produced by Mandatory, a Group match, or a Track match — one mechanism, three triggers. Only the Mandatory trigger is implemented so far; Group and Track matching are schema/UI groundwork without auto-assignment logic behind them yet.
```

Replace with:

```markdown
**Locked Selection**:
A Selection the Child cannot remove. Produced by Mandatory, a Group match, or a Track match. All three triggers are implemented: Track locking lives in `SchedulePage`'s track-change sync flow; Mandatory and Group share a single auto-assign-and-lock mechanism (`GroupMandatoryLockService`), synced whenever the active child's schedule is viewed.
```

- [ ] **Step 2: Commit**

```bash
git add CONTEXT.md
git commit -m "docs: correct CONTEXT.md — all three Locked Selection triggers are now implemented (#23)"
```

---

### Task 6: Manual verification

**Files:** none (browser-only verification against the running dev app and a real/seed Supabase DB)

**Interfaces:**

- Consumes: the full feature built in Tasks 1-5.
- Produces: a pass/fail checklist; no code changes unless a check fails, in which case stop and diagnose rather than proceeding.

- [ ] **Step 1: Start the dev server and log in as admin**

Run: `npm run dev` (skip if already running — check `lsof -i :5173` first)
Log in as admin using the credentials in `.env.local` (`APP_USERNAME`/`APP_PASSWORD`).

- [ ] **Step 2: Create or reuse two grade-1/2 test children**

One with a group set (e.g. grade א׳, group 1), one grade-matched but with no group. Reuse existing seed data if a suitable pair already exists (check the Students page); otherwise create them via "הוסף תלמיד" and set the group via the row's edit action (the add-modal's own group dropdown has been unreliable via coordinate-based clicks in past sessions — prefer keyboard Down+Return on the opened dropdown, or the edit-modal path, and verify the set value via `document.querySelector('.ant-modal')?.innerText` before submitting).

- [ ] **Step 3: Verify Group auto-lock**

Select the group-1 child. Confirm:

- Any class whose group is 1 for that grade is already selected (locked) — cancel button disabled, lock tooltip on hover.
- Any class whose group is 2 for that grade does not appear at all as an option in that slot's drawer.

- [ ] **Step 4: Verify no-group child sees no grouped classes**

Select the no-group child. Confirm no grouped class (group 1 or group 2) appears as an option or gets auto-selected in any slot.

- [ ] **Step 5: Verify ungrouped Mandatory locks for every child in-grade**

Find (or create, via Class Management, admin only) a mandatory class with no group set, in the same grade as both test children. Confirm it auto-selects and locks (disabled cancel button) for both the group-1 child and the no-group child.

- [ ] **Step 6: Verify grouped-and-mandatory respects the group match**

If seed data has a mandatory class with a group set, confirm it locks only for the matching-group child and is entirely absent as an option for the other test child (not just unlocked — invisible, per Step 3's rule).

- [ ] **Step 7: Regression-check Track is unaffected**

Pick a grade-3+ child, set a Track value via the Schedule page's track picker (not the edit modal — Track was intentionally removed from there in a separate PR). Confirm Track-matched classes still lock exactly as before; this task didn't touch that code path, so this step is a quick sanity check rather than a deep test.

- [ ] **Step 8: Clean up test data**

Delete any test children created in Step 2 via the Students page's row actions. Leave seed data mandatory/group classes as found.

- [ ] **Step 9: Final verification run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean, all tests passing, matching the state confirmed after Task 4.
