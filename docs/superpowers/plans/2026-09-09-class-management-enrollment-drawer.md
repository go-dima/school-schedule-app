# Class Management: enrollment roster drawer + table cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

## Context

Staff already see a per-class enrollment count in the Class Management table, but have no way to see _who_ is enrolled without querying the database directly. This adds a click-to-open drawer showing the class's roster (name + grade per enrolled child), reusing the visual conventions of the existing schedule-selection drawer without inheriting its selection-flow coupling. Alongside this, two table-density issues get fixed: several columns (title, description, teacher, classType) are wider than needed, and the `grades`/"כיתות" column currently renders one `Tag` per grade, which wraps into a cluttered multi-tag block (confirmed via user screenshot) — it should use the existing compact `GradesRangeTag` component instead, matching the pattern already used in the schedule view.

**Branch dependency:** This plan depends on the `status`/`committed` schema added by migration `019_add_selection_status.sql`, which lives on `feature/draft-mode` and is not yet on `main`. This worktree/branch (`feature/class-enrollment-drawer`) was branched from `feature/draft-mode`, not `main`, specifically so migration 019 and its RLS policies are present. Do not rebase this branch onto `main` without re-verifying migration 019 is included.

## Global Constraints

- The enrollment-count semantics used by the new roster query MUST match the existing count RPC exactly: `child_id IS NOT NULL AND status = 'committed'`, scoped by `class_scope`/`class_id`. If the roster list length and the table's displayed count ever disagree, that's a bug.
- No new RPC or migration — staff/admin already have unconditional `SELECT` on `schedule_selections` per RLS (migration `019_add_selection_status.sql`), so a plain `supabase.from("schedule_selections").select(...)` query is sufficient.
- `EnrollmentCount`'s new `onClick` prop must be optional and backward-compatible: `src/components/ScheduleTable.tsx`'s existing non-interactive usage must not gain a pointer cursor or `role="button"` when no handler is passed.
- Reuse the `Child` type (`src/types/index.ts`) — no new type needed for the roster.
- Reuse existing locale key `schedule.enrollment.students` (interpolates `{{count}}`) for the drawer's count line; add only one new key: `classManagement.enrollmentDrawer.noChildren`.
- No `ClassManagementPage.tsx` / `ClassEnrollmentDrawer.tsx` test file — this repo's convention (per CLAUDE.md: "Keep business logic in service layer... Testing: Unit tests for business logic") is to test business/service logic only, not UI wiring. Only `src/services/api.test.ts` gets new tests.
- `scroll={{ x: 1000 }}` on the Class Management table stays unchanged.

## Verified current state

- `src/pages/ClassManagementPage.tsx`: columns array (lines 286-427). `enrollment` column (337-345) renders `<EnrollmentCount count={enrollmentCounts.get(record.id) || 0} />`. `grades` column (314-330) renders one `<Tag>` per grade in a `<Space>`. Table: `scroll={{ x: 1000 }}`, `size="small"`, no `onRow`. `enrollmentCounts: Map<string, number>` already loaded via `EnrollmentService.getClassEnrollmentCounts(true)`.
- `src/elements/EnrollmentCount.tsx`: pure presentational `<span>` (icon + count), no click handling. Also used non-interactively in `src/components/ScheduleTable.tsx` (parent/child schedule view) — that call site doesn't pass `onClick`, so it's unaffected by the new optional prop.
- `src/elements/GradesRangeTag.tsx`: `GradesRangeTag: React.FC<{ grades: number[]; color: string }>` — collapses grades into one tag (single grade name, or "כיתה X - Y" range). Already used in `ClassSelectionDrawer.tsx`/`ScheduleTable.tsx`, not yet in `ClassManagementPage.tsx`.
- `src/components/ClassSelectionDrawer.tsx`: RTL `Drawer placement="left"`, header = `Title` + `Tag`s, `Empty` state pattern (lines 265-278). Tightly coupled to the parent-side select/unselect flow (`selectedClasses`, `onClassSelect`/`onClassUnselect`, `conflictingClasses`, `isAdmin`/`onCreateClass` baked into `renderClassCard`) and keyed on "one time slot, N classes" — the opposite axis from "one class, N children" needed here. Reuse its _patterns_ (RTL drawer shell, header composition, `GradesRangeTag` usage, `Empty` state), not the component itself.
- `src/services/enrollmentService.ts`: thin 30s-cache wrapper strictly around the two _count_ RPCs (`enrollmentApi.getClassEnrollmentCounts`/`getClassEnrollmentCount`) — not the right place for a roster (list-of-children) fetch.
- `src/services/api.ts`: `scheduleApi` (613-749) has `getUserSchedule`/`getChildSchedule`/`selectClass`/etc. but nothing that lists children _for_ a class. `enrollmentApi` (1018-1051) has only the count RPCs.
- **Enrollment-count semantics** (`migrations/019_add_selection_status.sql` lines 108-129, supersedes `016`): counts are `child_id IS NOT NULL AND status = 'committed'`, scoped by `class_scope`. The new roster query must apply the identical filter or its list/count will disagree with the number already shown in the table.
- **RLS** (`migrations/019`, "Staff and admins can view all selections"): staff/admin have unconditional `SELECT` on `schedule_selections`.
- Types: `Child` (`src/types/index.ts` ~line 103) has `firstName`, `lastName`, `grade`, `groupNumber`, `trackNumber`.
- Tests: Vitest. `src/services/api.test.ts` mocks `./supabase` via `vi.mock` with a chainable stub (`mockReturnThis()` per method). Only `authApi.onAuthStateChange` and `scheduleApi.selectClassForChild` are currently tested.
- Storybook: `src/stories/ClassSelectionDrawer.stories.tsx` is the live convention (`Meta`/`StoryObj`, `layout: "fullscreen"`, `tags: ["autodocs"]`) to follow for the new component's story.
- Locale: single file `src/locales/he.json`. `schedule.enrollment.students` already exists and interpolates `{{count}}`.

## Tasks

### Task 1 — Data layer: `scheduleApi.getClassEnrolledChildren`

Add to `scheduleApi` in `src/services/api.ts`, after `getChildSchedule` (~line 706):

```ts
async getClassEnrolledChildren(classId: string): Promise<Child[]> {
  const { data, error } = await supabase
    .from("schedule_selections")
    .select(`child:children(*)`)
    .eq("class_id", classId)
    .eq("status", "committed")
    .not("child_id", "is", null);

  if (error) throw new ApiError(error.message);

  return data
    .map((row: any) => row.child)
    .filter((child: any) => !!child)
    .map((child: any) => ({
      id: child.id,
      firstName: child.first_name,
      lastName: child.last_name,
      grade: child.grade,
      groupNumber: child.group_number,
      trackNumber: child.track_number,
      scope: child.scope,
      createdAt: child.created_at,
      updatedAt: child.updated_at,
    }))
    .sort((a: Child, b: Child) =>
      a.grade !== b.grade
        ? a.grade - b.grade
        : `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`, "he")
    );
},
```

- Filter (`status === "committed"`, `child_id IS NOT NULL`) must match the existing count RPC exactly so the drawer's list length always matches the table's displayed count.
- Row-mapping follows the existing manual snake_case→camelCase convention used in `childrenApi.getParentChildren` — no shared mapper exists in this file, don't introduce one as a drive-by.
- Sort: grade ascending, then Hebrew-locale name comparison.
- Reuse `Child` type; no new type needed.

**Testing (same task):** Extend `src/services/api.test.ts` with a `describe("scheduleApi.getClassEnrolledChildren", ...)` block: extend the existing chainable Supabase mock (add `.not()` support, a way to resolve fixture data at the end of the chain) and assert (a) snake_case→camelCase mapping, (b) sort order (grade asc, then name), (c) null `child` rows filtered out.

### Task 2 — New component: `src/components/ClassEnrollmentDrawer.tsx`

New dedicated component (not an extension of `ClassSelectionDrawer` — see coupling rationale above), + `ClassEnrollmentDrawer.css` if RTL tweaks are needed (mirror `ClassSelectionDrawer.css`'s `direction: rtl` / close-button-flip rules).

```ts
interface ClassEnrollmentDrawerProps {
  open: boolean;
  onClose: () => void;
  classInfo: ClassWithTimeSlot | null;
}
```

- `classInfo` is the already-loaded class record from `ClassManagementPage` (title/teacher/grades in memory already — only the roster needs a fetch).
- State: `children: Child[]`, `loading`, `error`. On open (or `classInfo.id` change while open), call `scheduleApi.getClassEnrolledChildren(classInfo.id)`; guard against stale responses if the user switches rows mid-fetch (e.g. track a request token / check the id is still current before applying the result).
- `Drawer placement="left"` width 400, header = `Title` (class title) + `Tag` (teacher) + `GradesRangeTag` (grades) — same composition style as `ClassSelectionDrawer`'s header.
- Body: count line via existing `schedule.enrollment.students` key; loading → `Spin`; error → `Alert`; empty (`children.length === 0`) → `Empty` (mirrors `ClassSelectionDrawer`'s empty pattern, no `CreateClassButton` — not relevant here); otherwise a plain bordered AntD `List` (not `Card`-per-item like `ChildManagement` — no per-child actions needed here), each row showing `firstName lastName` + a grade `Tag` (via `GetGradeName`).
- New locale key: `classManagement.enrollmentDrawer.noChildren` in `src/locales/he.json`. Reuse `schedule.enrollment.students` for the count.
- Add `src/stories/ClassEnrollmentDrawer.stories.tsx` following `ClassSelectionDrawer.stories.tsx`'s convention.
- This task builds against the `getClassEnrolledChildren(classId: string): Promise<Child[]>` signature specified in Task A — that signature is fixed by this plan, so Task B does not need Task A's code to land first; it can be developed in parallel and will typecheck once Task A merges.

### Task 3 — Wiring + table cleanup: `ClassManagementPage.tsx`

Depends on Task 1 and Task 2 both being complete (imports the real function and component).

1. New state: `enrollmentDrawerOpen`, `enrollmentDrawerClass: ClassWithTimeSlot | null`.
2. Add optional `onClick?: () => void` to `EnrollmentCount` (`src/elements/EnrollmentCount.tsx`) — only sets `cursor: pointer`/`role="button"` when provided, so the existing non-interactive `ScheduleTable.tsx` usage is unaffected. Pass the click handler from the `enrollment` column's `render` in `ClassManagementPage.tsx` — scoped to that cell only, not the whole row (the row already has an actions `Dropdown`, so no `onRow` handler).
3. Render `<ClassEnrollmentDrawer open={enrollmentDrawerOpen} onClose={...} classInfo={enrollmentDrawerClass} />` near the existing `<Modal>` at the bottom of the component.
4. Grades column fix: replace the `grades` column render (lines 314-330) with:
   ```tsx
   render: (grades: number[]) => <GradesRangeTag grades={grades} color="geekblue" />,
   ```
   Add `import { GradesRangeTag } from "@/elements/GradesRangeTag";`. After the change, check whether `GetGradeNameShort` is still used elsewhere in the file (it's used for the grade filter options too — `GetGradeName` stays; only drop `GetGradeNameShort` from the import if genuinely unused).
5. Column width changes (values-only):

   | Column        | Current | New                                         |
   | ------------- | ------- | ------------------------------------------- |
   | `title`       | 200     | 150 (+ `ellipsis: true`, not currently set) |
   | `description` | 250     | 180 (already `ellipsis: true`)              |
   | `teacher`     | 150     | 110 (+ `ellipsis: true`)                    |
   | `classType`   | 120     | 100                                         |
   | `grades`      | 150     | 110 (safe now that it's a single tag)       |

   `scroll={{ x: 1000 }}` stays unchanged — it's a minimum scrollable width, not a cap; new total (~1080-1100) is meaningfully narrower than the current ~1400 while still exceeding it.

No new test file for this task (see Global Constraints).

## Verification

- `npm run build` (runs `tsc && vite build`) to catch type errors across the three tasks once merged.
- `npm test` (Vitest) — new `getClassEnrolledChildren` tests pass, existing tests unaffected (pre-existing `trackSelectionService.test.ts` env-var failure is not in scope).
- `npm run lint`.
- Manually run the app (`npm run dev`) if credentials are available: open Class Management as staff, click an enrollment count: drawer opens showing title/teacher/grades header, count, and roster list; verify empty state for a 0-enrollment class; verify the grades column now shows a single range tag; verify the table is visibly narrower. If `.env.local` isn't available in this worktree, skip manual verification and say so explicitly rather than claiming it was done.
- Confirm `ScheduleTable.tsx`'s existing `EnrollmentCount` usage is still non-interactive (no `onClick` passed there) after the prop is added.
