# 0002. Schedule page tab bars

- Status: accepted
- Date: 2026-09-25 (updated 2026-10-09 for #173, #260, #283 and #286)
- Issues: #163 (PR #166, part 2 PR #173), #167 (PR #172), #240 (PR #260), #281 (PR #283), #264

## Context

Class managers need to switch the Schedule page between the student view and a Staff View. Parents with several children need to switch between them. Several placements were mocked up for the switch.

## Decision

- Tabs sit **above the filters bar**. Refresh and print go in the `extra` slot at the end of the top-most tab bar. With no tab bar they stay in the filters bar.
- **View tabs** (class managers only): Students (תלמידים), My Schedule (המערכת שלי), Staff (צוות). My Schedule is offered only once the user has a Display Name. The default tab depends on the platform (see below). A tab other than the default is named in the URL (`?view=student`, `?view=mine`, `?view=staff&selected=…`); the default needs no param.
- **Per-child tabs** (parents, student view): their own tab bar above the filters, with a trailing add-tab that acts as a button.
- **Hide a tab bar that has only one tab.** A parent never sees a lone tab.
- Every schedule tab bar renders through the shared `ScheduleTabsBar` component.
- On-screen order was confirmed after seeing it render in RTL. The tab items run `[student, mine, staff]`, so Students is rightmost. In the `extra` slot the JSX order is refresh then print: print renders second-to-last and refresh at the far end.
- The print button reads "הדפס מערכת של <name>" (the child or staff member), or "הדפס את המערכת שלי" on My Schedule.

## Desktop and mobile

The tab bars above are the desktop page. Which controls a platform offers comes from `scheduleCapabilities(platform)` (`src/pages/schedule/scheduleCapabilities.ts`): one object per platform, the same for every role, with role permissions applied on top.

- Desktop offers everything: view tabs, refresh, print, the draft/committed toggle, the add-tab, the read-only notice. The staff student picker is a dropdown.
- Mobile offers the view tabs only (#283). The staff student picker opens as a bottom sheet (#286). Parents and children get `MobileSchedulePage`: child tabs without the add-tab, above a read-only day view (#260). Everyone else gets the desktop page inside the mobile shell, with the mobile capabilities.

## Default tab

The tab comes from the resolvers in `src/pages/schedule/scheduleView.ts` (ADR 0005): `resolveScheduleTab` picks the tab to show, `defaultScheduleTab` the tab when the URL names none, and `viewParamFor` the `?view=` value to write.

- **Mobile:** a class manager with a Display Name who is not also a parent or child lands on **My Schedule** (#283). The student view is one tap away on the view tabs.
- **Everyone else, and all of desktop:** the student view.
- Staff+parent users keep the parent view (ADR 0004).
- Still open in #264: a mobile layout for the staff week, a phone-friendly staff picker, a better switcher than the desktop tabs, and whether staff+parent users should get a different default.
