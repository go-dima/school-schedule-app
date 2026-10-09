# 0004. Staff+parent users act as parents on the Schedule page

- Status: accepted, implemented in #258
- Date: 2026-10-03
- Issues: #192

## Context

A user with both the parent and staff roles always acts as parent: `pickDefaultRole` (`src/services/roleFlags.ts`) ranks parent above staff, and #165 removed the role picker. But the Schedule page gated much of its student view on `roleFlags.isStaff` (has the role) instead of what the user acts as. So staff controls and staff child-resolution leaked into the parent view. Locks and auto-sync broke for the user's own child, and the staff student picker was misleading.

## Decision

A user with both the parent and staff roles uses the Schedule student view exactly like a parent-only user. Staff controls stay out of that view: the student picker, the staff group/track selector, and the `staffSelectedChild`-driven locks. Locks, auto-sync and filters use the parent's selected child. The read-only Staff View tabs stay.

One helper decides it: `ScheduleService.actsAsStaffInStudentView({ isStaff, canPickSchedule })`, true only for a staff user who can't pick a schedule. Student-view code gates its staff paths on this helper, never on the raw `isStaff` flag.

## Deferred

A proper "acting as staff / acting as parent" mode is a separate design item. Until it's designed, don't add staff-editing paths for parent+staff users.
