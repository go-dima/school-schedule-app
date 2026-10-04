# Classes in Non-Lesson Time Slots: Implementation Plan

Issue: #213 (milestone v1.2 - usage gaps)
Branch: `feat/non-lesson-slot-classes`

## Goal

Let admins and moderators put catalog Classes on break and meeting Time Slots (e.g. מפגש בוקר). Staff select and deselect them in a Child's schedule from those cells. Deselecting returns the cell to its default label.

## Decisions

| Question                                          | Decision                                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Class attributes                                  | **Unchanged.** Mandatory, Group, Track and Double work as on any Class. No special-casing in the form or the auto-assign services.                |
| Who creates the Class?                            | Same as any Class: `canCreateClasses` (admin, moderator).                                                                                         |
| Who selects or deselects in a break/meeting cell? | **Staff only** (`canManageRoster`: admin, staff). Parents and children see the result read-only.                                                  |
| Where the rule lives                              | **Per cell, not per Class.** A non-lesson Time Slot is clickable only by `canManageRoster`. There's no "kind of class" flag and no schema change. |
| Cell display                                      | A selected Class card **replaces** the slot label. Deselecting it (or having nothing selected) shows the default label, e.g. "מפגש בוקר".         |
| Slot categories                                   | Stay name-based (`TIME_SLOT_CATEGORIES`).                                                                                                         |

### Known edges (accepted, not handled)

- **Mandatory/Group/Track on a meeting Class** auto-assigns it as a Locked Selection, as for any Class. Staff can't deselect a locked one either, which is existing behaviour.
- **Double Lesson on a non-lesson slot:** `getNextConsecutiveTimeSlot` walks lesson slots only, so the auto-filled second slot is the next lesson. This is left as is; staff can edit the slot by hand.
- **Enforcement is in the UI only.** A follow-up issue will cover RLS on `schedule_selections`, which would need slot categories in SQL.

## Tasks

Each task is TDD: write a failing test, implement, then run `npm test` and the type check.

### Task 1: The slot rule (`src/utils/timeSlots.ts`, `src/services/scheduleService.ts`)

- Add `isNonLessonTimeSlot(timeSlot)`, which is `isBreakTimeSlot || isMeetingTimeSlot`.
- Add `ScheduleService.canOpenSlot(timeSlot, { canViewClasses, canManageRoster })`. Lesson slot: `canViewClasses`, which is today's behaviour. Non-lesson slot: `canManageRoster`.
- Add unit tests for the four combinations.

### Task 2: ClassForm (`src/components/ClassForm.tsx`)

- The slot picker lists all Time Slots instead of `getLessonTimeSlots`, in chronological order (the slot names already say which are meetings or breaks).
- Nothing else changes in the form.
- Test: a meeting slot can be picked and saved.

### Task 3: ScheduleTable (`src/components/ScheduleTable.tsx`)

- New prop `canAssignNonLessonSlots`, passed from `SchedulePage` as `permissions.canManageRoster`.
- `handleCellClick` and `isSelectableSlot` both use `ScheduleService.canOpenSlot`.
- In the `!isLessonTimeSlot` branch:
  - With a **selected** Class: render the same selected-class card as a lesson cell, clickable for staff.
  - Without one: today's compact label card, plus the override footer button. It's clickable for staff, so they can open the drawer and pick.
- Unselected Classes on these slots are never shown in the cell. The label stays clean.
- A row with a selected Class on any day drops `compact-row` so the card fits, and its time column shows the slot name (`ScheduleService.hasSelectedClassInSlot`).
- Check RTL rendering and row height in the browser.

### Task 4: Drawer (`src/components/ClassSelectionDrawer.tsx`)

- No logic change: it already lists the slot's Classes with select/deselect. Confirm it opens for a non-lesson slot and that deselecting restores the label.
- Check the header, which shows the slot name and time range. It should read correctly for "מפגש בוקר".

### Task 5: Printables + Staff View

- `PrintableSchedule.tsx` / `PrintableScheduleColor.tsx`: mirror Task 3. A selected Class replaces the label.
- Staff View: no change needed. `staffScheduleService` doesn't filter by slot type, and Staff View renders through `ScheduleTable`, whose tests cover the new branch.

### Task 6: Docs + stories

- CONTEXT.md: add **Break / Meeting Slot** after **Time Slot**.
- Storybook: a `ScheduleTable` story with a morning-meeting Class selected.
- Open a follow-up issue for RLS enforcement.

### Task 7: Verify

- `npm test`, `npm run lint`, `npm run build`.
- Manual run:
  - As a moderator, create a "מפגש בוקר" Class.
  - As staff, select it for a Child, then deselect it and confirm the label returns.
  - As the parent, confirm the cell is read-only.
  - Print both variants.

## Files touched (expected)

- `src/utils/timeSlots.ts`, `src/services/scheduleService.ts` (+ tests)
- `src/components/ClassForm.tsx`, `ScheduleTable.tsx`
- `src/components/PrintableSchedule.tsx`, `PrintableScheduleColor.tsx`
- `src/pages/SchedulePage.tsx`
- `CONTEXT.md`, a story

No migrations.
