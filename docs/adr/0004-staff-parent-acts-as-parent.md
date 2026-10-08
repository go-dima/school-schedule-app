# 0004. Staff+parent users act as parents on the Schedule page

- Status: accepted, **not yet implemented**: #192 is open
- Date: 2026-10-03
- Issues: #192

## Context

A user with both the parent and staff roles always acts as parent: `pickDefaultRole` (`src/services/roleFlags.ts`) ranks parent above staff, and #165 removed the role picker. But `SchedulePage.tsx` gates much of its UI on `roleFlags.isStaff` (has the role) instead of the active role. So staff controls and staff child-resolution leak into the parent view. Locks and auto-sync break for the user's own child, and the staff student picker is misleading.

## Decision

A user with both the parent and staff roles uses the Schedule student view exactly like a parent-only user. Staff controls stay out of that view: the student picker, the staff group/track selector, and the `staffSelectedChild`-driven locks. Locks, auto-sync and filters use the parent's `selectedChild`. The read-only Staff View tabs stay.

Until #192 lands, the code still behaves the old way. Don't build on the `isStaff` gating in the student view.

## Deferred

A proper "acting as staff / acting as parent" mode is a separate design item. Until it's designed, don't add staff-editing paths for parent+staff users.
