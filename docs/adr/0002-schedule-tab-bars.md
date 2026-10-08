# 0002. Schedule page tab bars

- Status: accepted
- Date: 2026-09-25
- Issues: #163 (PR #166), #167 (PR #172)

## Context

Staff need to switch the Schedule page between the student view and the Staff View. Parents with several children need to switch between them. Several placements were mocked up for the switch.

## Decision

- Tabs sit **above the filters bar**. Print and refresh go in the tab bar's `extra` slot, at the end of the top-most bar.
- Staff/student tabs: the items array is `[student, staff]`, and Students (תלמידים) is the default tab. In the `extra` slot the JSX order is refresh then print. In RTL this renders print second-to-last and refresh at the far end. Both orders were confirmed after seeing them render.
- **Hide a tab bar that has only one tab.** A parent never sees a lone tab.
- Per-child tabs for parents use their own tab bar above the filters, like the staff/student tabs.
- Every schedule tab bar renders through the shared `ScheduleTabsBar` component: line tabs, the `extra` slot, and an optional trailing add-tab that acts as a button.
- The print button reads "הדפס מערכת של <name>", with the staff member's or the child's name.

## Deferred

A role-aware default tab (e.g. "המערכת שלי" for staff) belongs to part 2 of #163, once users are mapped to catalog teacher names.
