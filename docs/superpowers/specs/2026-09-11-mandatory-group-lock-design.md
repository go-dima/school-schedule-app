# Mandatory + Group Locked Selection (issue #23)

## Context

Issue #23 asks for a unified **Locked Selection** mechanism (see `CONTEXT.md`):
a class a child cannot remove from their schedule, triggered by `isMandatory`
or a Group match.

A prior implementation attempt (branch `feature/group-assign`, specs/plans
dated 2026-09-09) built this against an older schema and API surface. Main
has since moved 26 commits ahead, including a full rearchitecture of
schedule selections into draft/committed status (PR #54) and a Track lock
already implemented independently of this ticket. That prior branch is
abandoned; this spec starts fresh against current main.

**Current state on main, verified directly:**

- **Track**: implemented, inline in `SchedulePage.tsx`. `lockedClassIds` is
  computed from `currentTrackChild.trackNumber` matching `classes.trackNumber`;
  locked classes get a disabled cancel button, a lock icon, and a tooltip.
  This logic is out of scope here and stays untouched.
- **Mandatory**: `MandatoryClassService.canUnselectClass()` exists but is
  called nowhere in the app — confirmed dead code, matching issue #23's
  description of the bug.
- **Group**: zero references in `ScheduleTable.tsx` or
  `ClassSelectionDrawer.tsx`. No filtering, no auto-assignment, no locking.
  Not built at all yet.
- `CONTEXT.md`'s Locked Selection entry is stale (says only Mandatory is
  implemented; actually the reverse is true) and needs a doc fix alongside
  the code change.

## Scope

In scope:

- Group match → class is filtered out of the options entirely when it
  doesn't match a child's group (or the child has no group); when it does
  match, the class is auto-assigned and locked.
- Mandatory → class is auto-assigned and locked, using the same
  auto-assign+lock mechanism as Group, not a separate implementation.
- A class that is both mandatory and grouped is treated as grouped: it
  respects the group-match rule (a school may run the same mandatory
  subject at different times per group, e.g. group 1 vs. group 2 in grade
  2 — a child in group 1 must not see or be assigned group 2's slot).
  A mandatory class with no group set applies to every child in a matching
  grade unconditionally, same as today's grade filter.
- CONTEXT.md correction.

Out of scope:

- Track (already implemented, untouched).
- Any schema change. `group_number` already exists, unsplit, on both
  `classes` and `children` — no draft/committed split needed (group is an
  admin-set profile attribute, not something a parent picks per session,
  unlike track).
- The old `LockedSelectionService` abstraction from the abandoned branch —
  superseded by this design.

## Mechanism

### Locked-class computation

Extend `SchedulePage.tsx`'s existing `lockedClassIds` (currently
Track-only) to a `Set<string>` built from three inputs combined with union:
Track's existing computation (untouched), plus classes where:

```
(cls.groupNumber !== null && cls.groupNumber === child.groupNumber)
  || (cls.isMandatory && (cls.groupNumber === null || cls.groupNumber === child.groupNumber))
```

Both new triggers reduce to the same predicate structure as the existing
Track branch, so they read as one added block, not a parallel system.

### Auto-assignment sync

Track syncs via `TrackSelectionService.applyTrackClassChanges`, invoked
from `makeTrackChangeHandler` — a user-driven event (the parent/staff picks
a track). Group and Mandatory have no equivalent event; a child's group
doesn't change from this page, and mandatory is a fixed class attribute.
So the sync must run whenever the relevant child's schedule is loaded or
the active child changes ("sync on view"): a `useEffect` keyed on the
active child + loaded classes + loaded selections that:

1. Computes the target set of group/mandatory-matched class ids for the
   active child (grade + group filter as above).
2. Diffs against currently-selected class ids in `selectedSchedule`.
3. Selects the missing ones and unselects any that are selected but no
   longer match (e.g. an admin changed the child's group), via the same
   `selectSchedule`/`unselectSchedule` + `viewStatus` the rest of the page
   already uses (draft for parent/child, committed for staff/admin).

This mirrors `computeTrackClassChanges`/`applyTrackClassChanges`'s shape
closely enough that the new logic should live as sibling functions — a new
`groupMandatoryLockService.ts` (name to be finalized in planning) with a
`computeChanges`/`applyChanges` pair — rather than folding into
`TrackSelectionService`, since Group/Mandatory and Track remain
independent triggers per CONTEXT.md.

### Visibility filter

`ScheduleTable.tsx` filters classes per slot by
`cls.grades?.includes(userGrade)` only (around line 124/162). Extend this:
a class with a non-null `groupNumber` that doesn't match the active
child's `groupNumber` is dropped from the slot's options entirely — it
never appears as a pickable class in the drawer, matching issue #23's
acceptance criteria ("grouped class NOT matching child's group is not
shown as an option"). This requires threading the active child's
`groupNumber` into `ScheduleTable` (it currently only receives
`userGrade`), and down into the class-list filtering it already does.

### Locking UI

Reuse the existing Track lock rendering as-is: disabled button +
`LockOutlined` icon + tooltip in the "Selected Classes" summary card, and
the `message.warning` guard in `handleClassSelect`'s unselect branch.
Generalize the tooltip/warning copy (`schedule.drawer.trackLockedTooltip`,
`schedule.page.error.trackClassLocked`) from Track-specific wording to
generic "locked selection" wording, since the same UI now fires for three
independent reasons.

### Mandatory service

`MandatoryClassService` predates the draft/committed split and calls
scheduleApi methods that no longer exist in that shape
(`getUserSchedule`, `selectClass`). Rather than patch it, replace its
matching logic with a pure function mirroring
`TrackSelectionService.computeTrackClassChanges` (grade+group in,
classes to select/unselect out), used by the new sync effect above. The
service's dead `canUnselectClass` method and any other now-unused surface
should be deleted, not preserved for compatibility.

## Data flow summary

```
child loads/changes
  -> useEffect computes group+mandatory target class ids
  -> diff vs selectedSchedule
  -> select/unselect via existing scheduleApi (status-aware)
  -> refetch selectedSchedule
  -> lockedClassIds recomputed (union of track/group/mandatory)
  -> ScheduleTable filters options by grade+group
  -> locked classes render disabled, with tooltip, in summary + table
```

## Testing

- Unit tests for the new compute-changes function (mirroring
  `trackSelectionService.test.ts`'s coverage): group match/no-match/no-group,
  mandatory ungrouped, mandatory+group match/mismatch.
- Manual verification in-browser (per this repo's existing pattern for this
  kind of change): a grade-1/2 child with a group sees only their group's
  classes pre-selected and locked; a same-grade child with no group sees no
  grouped classes at all; a mandatory-but-ungrouped class locks for every
  child in its grade.

## Open questions for planning

- Exact naming for the new service file and its exported functions.
- Whether the sync effect belongs in `SchedulePage.tsx` directly (matching
  where `lockedClassIds` and the track handler already live) or extracted
  into a hook — file size of `SchedulePage.tsx` (700+ lines) suggests a
  hook (`useGroupMandatorySync` or similar) may be worth it; left to the
  implementation plan to decide against the actual current file structure.
