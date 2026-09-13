# Replace the drawer conflict banner with a per-cell red-border indicator

## Context

While working the print-to-PDF branch (PR #51, now merged), the user found a dismissible drawer banner ("שים לב לחפיפות") that reports how many classes in the currently-open slot conflict with something already selected — in one case it reported 95 conflicts, which is noisy and not actionable. Investigation traced it to `ClassSelectionDrawer.tsx`'s `conflictingClasses` prop, which flags **every** unselected candidate class in the slot that conflicts with **any** current selection — a very broad, low-signal check.

The real problem the user cares about is narrower: track selection (`trackSelectionService.ts`) auto-selects a track's classes without checking whether they time-conflict with an already-selected regular class (confirmed: `computeTrackClassChanges` never checks `slotsOverlap` against `currentSchedule`). When that happens today, both classes end up selected in the same slot with zero indication anything is wrong.

Desired replacement: mark the **schedule cell itself** (not just the drawer) with a light-red 1px border when it holds a selected class that time-conflicts with another current selection. Clicking that cell already opens the drawer showing both classes fully interactive — the track-locked one (can't be unselected — existing lock UI) and the regular one (already unselect-able via its existing toggle button, confirmed working, no change needed). So the only genuinely new behavior needed is the cell-level indicator; the "gray out other options" and "unselect the losing class" behavior the user described already exists in the drawer today (verified: `isGrayedOut` already applies to unselected candidates whenever the slot has ≥1 selection, and the regular class's toggle button is already enabled and wired to `onClassUnselect`).

Also: close issues #41 and #42 now that PR #51 (which resolved them) is merged.

## Global Constraints

- No changes to `ScheduleService.hasTimeConflict` / `getConflictingClasses` / `slotsOverlap` (scheduleService.ts) — they're reused as-is and are still used elsewhere (`mandatoryClassService.ts`).
- `ScheduleService.getConflictingClasses` (and therefore `hasTimeConflict`) already excludes a class's own selection internally via `selection.class.id !== newClass.id` — so the new-cell-indicator helper must NOT re-filter `userSelections` by the class's own id before calling `hasTimeConflict`; that would be redundant dead code. Just call `ScheduleService.hasTimeConflict(userSelections, cls)` directly.
- Keep `npx tsc --noEmit`, `npm run lint`, and `npm test` clean throughout.
- This work happens directly on the current worktree/branch (`feature/schedule-conflict-indicator`, already created off latest `main`) — no separate git worktree needed.

## Task 1: Close resolved issues

Run:

```
gh issue close 41 --comment "Resolved by #51 (merged)."
gh issue close 42 --comment "Resolved by #51 (merged)."
```

Report the two issue URLs/numbers closed as confirmation.

## Task 2: Remove the old conflict UI (drop entirely, not just the summary banner)

Both the summary banner and the per-card highlight/alert share the same noisy `conflictingClasses` prop and are being replaced by the new cell-level indicator — remove both.

**`src/components/ClassSelectionDrawer.tsx`**

- Remove `conflictingClasses` from `ClassSelectionDrawerProps` and from the destructured props/default.
- Remove the `hasConflict` computation and drop the `hasConflict ? "conflict" : ""` fragment from the `Card`/outer element className.
- Remove the per-card conflict `<Alert>` block.
- Remove the summary banner block (the one gated on `conflictingClasses.length > 0` near the bottom of the drawer body).
- Remove now-unused imports: `Alert` (only used by the two removed blocks) and `ExclamationCircleOutlined` — but first double check neither is used anywhere else in this file after your edits; if `Alert` (or the icon) is still referenced elsewhere, keep the import.

**`src/components/ClassSelectionDrawer.css`**

- Remove `.class-selection-card.conflict`, `.conflict-alert` / `.conflict-alert .ant-alert-message`, `.conflict-warning`.

**`src/locales/he.json`**

- Remove keys `timeConflictTitle`, `timeConflictDescription`, `conflictWarningTitle`, `conflictDescription` from the `schedule.drawer` block. Keep the JSON valid (watch trailing commas).

**`src/components/ScheduleTable.tsx`**

- Remove the `conflictingClasses={...}` prop passed to `<ClassSelectionDrawer>`.

**`src/stories/ClassSelectionDrawer.stories.tsx`**

- Remove the `WithConflicts` story and the now-unused `conflictingClasses` mock array — the story existed solely to demonstrate the removed prop.

### Verification for Task 2

- `npx tsc --noEmit` clean (this will catch any remaining references to the removed prop/imports).
- `npm run lint` clean.
- `npm test` clean.
- Grep the repo for `conflictingClasses`, `conflict-alert`, `conflict-warning`, `class-selection-card.conflict`, `timeConflictTitle`, `timeConflictDescription`, `conflictWarningTitle`, `conflictDescription` — all should be gone (aside from unrelated matches, e.g. `ScheduleService`'s own conflict methods or the new cell-level `.schedule-cell.conflict` class added in Task 3, which is a different, intentionally-kept class name).

## Task 3: Add the new per-cell conflict indicator

Depends on Task 2 being complete first (removes the old `conflictingClasses` prop wiring in `ScheduleTable.tsx` that this task's edits sit alongside).

**`src/styles/schedule-colors.css`** — add one variable to the existing shared palette (find the `/* Borders */` group and add alongside it):

```css
--schedule-conflict-border: #ff7875; /* antd red-4: visible but not alarming at 1px */
```

**`src/components/ScheduleTable.css`** — new rule, same pattern as the existing `.schedule-cell.unknown-slot`:

```css
.schedule-cell.conflict {
  border: 1px solid var(--schedule-conflict-border);
}
```

**`src/components/ScheduleTable.tsx`** — add a helper near `shouldHighlightTimeSlot` (`userSelections` is already in scope in this component, no new prop threading needed):

```ts
const classHasConflict = (cls: ClassWithTimeSlot): boolean =>
  ScheduleService.hasTimeConflict(userSelections, cls);
```

Do NOT pre-filter `userSelections` by the class's own id first — `ScheduleService.getConflictingClasses` (called internally by `hasTimeConflict`) already excludes the class's own selection by comparing `selection.class.id !== newClass.id`. Re-filtering here would be redundant dead code (see Global Constraints).

Apply it in the two branches of `renderClassCell` that render selected classes:

- Double-continuation branch (the block returning `schedule-cell selected-classes double-continuation selected ...`, where `doubleClass` is in scope): compute `classHasConflict(doubleClass)` and append `"conflict"` to the outer `<div>` className alongside `mandatory-cell`, e.g. only when true.
- Selected-primary-classes branch (the block returning `schedule-cell selected-classes ...`, where `selectedPrimaryClasses` is in scope): compute `selectedPrimaryClasses.some(classHasConflict)` and append `"conflict"` to the outer `<div>` className the same way.

### Verification for Task 3

- `npx tsc --noEmit`, `npm run lint`, `npm test` clean.
- Add/update a Storybook story or existing test fixture if useful to demonstrate the conflict border (optional — use judgment; not required if existing `ScheduleTable.stories.tsx` fixtures don't easily support two overlapping selected classes). Do not force this if it requires disproportionate fixture rework — a quick manual verification note is acceptable instead.
- Manual browser check (dev server + real login, same approach as the print-to-PDF verification): pick a child, select a regular class, then pick a track whose class time-conflicts with it (or find existing data where this is already true), confirm:
  - The schedule cell shows a light red 1px border.
  - Clicking it opens the drawer; the track class shows locked/disabled, the regular class is still selectable/unselectable; unselecting it clears the conflict and the red border.

## Final Verification (whole branch)

- `npx tsc --noEmit`, `npm run lint`, `npm test` — must stay clean.
- `npm run storybook`: confirm `ClassSelectionDrawer` stories still render (minus `WithConflicts`) with no console errors, and that selecting/unselecting still works via `WithSelectedClasses`.
- Manual browser check as described in Task 3.
- Commit, push branch, open a PR (same conventions as #51: `gh pr create`).
