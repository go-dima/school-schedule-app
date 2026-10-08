# 0004. Staff+parent users act as parents on the Schedule page

- Status: accepted
- Date: 2026-10-03
- Issues: #192

## Context

The Schedule page mixed `roleFlags.isStaff` (the user has the role) with `currentRole` (the user acts as it). The active role is always parent, because #165 removed the role picker. For a user who is both staff and parent, this broke locks and auto-sync for their own child, and the staff student picker was misleading.

## Decision

A user with both the parent and staff roles uses the Schedule student view exactly like a parent-only user. Staff controls stay out of that view: the student picker, the staff group/track selector, and the `staffSelectedChild`-driven locks. The read-only Staff View tab stays.

## Deferred

A proper "acting as staff / acting as parent" mode is a separate design item. Until it's designed, don't add staff-editing paths for parent+staff users.
