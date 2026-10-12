# 0005. Decisions are resolved state: permissions, capabilities, resolvers

- Status: accepted
- Date: 2026-10-08
- Issues: #106 (PR #136), #192 (PR #258), #240 (PR #260)

## Context

The Schedule page broke each time a component combined raw inputs itself. Override visibility once mixed the role, the draft/committed toggle and the selected child in several places (#106). Staff+parent users got staff controls because the page checked `roleFlags.isStaff` (has the role) where it needed what the user acts as (#192). Each fix collapsed the scattered checks into one pure function with a test, and the same shape now runs through the app.

## Decision

This is the structure for all new work.

- **Resolvers.** Any decision that combines more than one input (who the user is, what they view, which device) is made by a pure resolver: a small typed input in, a small typed result out. Components and controller hooks read the result. They never combine raw flags (`roleFlags.*`, `currentRole`, the UI Mode) inline.
- **Two axes:**
  - **Permissions:** what the user may do. Role rows → `getRoleFlags` (identity) → `getPermissions` (`PermissionsState`). Role differences live here and nowhere else.
  - **Capabilities:** what a platform's UI offers. A page with desktop and mobile views has `<page>Capabilities(platform)`: one object per platform, the same for every role.
  - A control renders only when both allow it, e.g. `canUseStaffView && caps.canPickView`.
- **View resolvers** combine those with page state. Current ones: `resolveGate`, `resolveUiMode`, `ScheduleService.resolveSelectionStatus`, `ScheduleService.resolveScheduleView` (draft/committed), `ScheduleService.actsAsStaffInStudentView`, and the Schedule tab resolvers `resolveScheduleTab`, `defaultScheduleTab` and `viewParamFor` (`src/pages/schedule/scheduleView.ts`).
- **One decision, one resolver.** Extend the resolver that owns a decision rather than adding a parallel check. Domain and role decisions go in `src/services/`, a page's capabilities in its page folder, routing in `src/routes/`.
- **Matrix tests.** Each resolver has a `*.test.ts` that covers its full input matrix (every role combination, every platform, every toggle state).

## Alternatives rejected

- **Inline flag checks in components:** this produced #192, and each new role or toggle multiplied the places to fix.
- **Capabilities per role:** that mixes the two axes. Role differences go in permissions, platform differences in capabilities.

## Consequences

- A new control adds a capability field (and a permission, if a role restricts it) before any JSX.
- A new platform or mode adds one capabilities object. A new role changes `getPermissions` and its matrix test.
- Decisions are tested without rendering. Components stay thin and the logic stays in the service layer.
