# 0002. Schedule page tab bars

- Status: accepted
- Date: 2026-09-25 (updated 2026-10-08 for #173 and #260)
- Issues: #163 (PR #166, part 2 PR #173), #167 (PR #172), #240 (PR #260)

## Context

Class managers need to switch the Schedule page between the student view and a Staff View. Parents with several children need to switch between them. Several placements were mocked up for the switch.

## Decision

- Tabs sit **above the filters bar**. Refresh and print go in the `extra` slot at the end of the top-most tab bar. With no tab bar they stay in the filters bar.
- **View tabs** (class managers only): Students (תלמידים), My Schedule (המערכת שלי), Staff (צוות). My Schedule is offered only once the user has a Display Name. Students is the default for everyone. The tab lives in the URL (`?view=mine`, `?view=staff&selected=…`).
- **Per-child tabs** (parents, student view): their own tab bar above the filters, with a trailing add-tab that acts as a button.
- **Hide a tab bar that has only one tab.** A parent never sees a lone tab.
- Every schedule tab bar renders through the shared `ScheduleTabsBar` component.
- On-screen order was confirmed after seeing it render in RTL. The tab items run `[student, mine, staff]`, so Students is rightmost. In the `extra` slot the JSX order is refresh then print: print renders second-to-last and refresh at the far end.
- The print button reads "הדפס מערכת של <name>" (the child or staff member), or "הדפס את המערכת שלי" on My Schedule.

## Desktop and mobile

The tab bars above are the desktop page. Which controls a platform offers comes from `scheduleCapabilities(platform)` (`src/pages/schedule/scheduleCapabilities.ts`): one object per platform, the same for every role, with role permissions applied on top.

- Desktop offers everything: view tabs, refresh, print, the draft/committed toggle, the add-tab, the read-only notice.
- Mobile (#260) offers none of them for now. Parents and children get `MobileSchedulePage`: child tabs without the add-tab, above a read-only day view. Everyone else gets the desktop page inside the mobile shell, with the mobile capabilities.
- A mobile Staff View (My Schedule by default, a staff picker) is tracked in #264.
