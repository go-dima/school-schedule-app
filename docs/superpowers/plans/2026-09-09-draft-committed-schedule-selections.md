# Draft / Committed Schedule Selections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give parents a free-form "draft" schedule and staff/admin an independently-owned "committed" schedule for each Child, instead of both writing into the same `schedule_selections` rows.

**Architecture:** Add a `status: 'draft' | 'committed'` column to `schedule_selections`, scope every read/write path (RLS, API, hooks) by that status, and collapse "which status is this viewer editing" into one pure function (`ScheduleService.resolveSelectionStatus`) that `SchedulePage` calls once and threads down as a plain value.

**Tech Stack:** React + TypeScript, Supabase (Postgres + RLS), Vitest.

**Spec:** https://github.com/go-dima/school-schedule-app/issues/52 (issue #52, linked from originating issue #43)

## Global Constraints

- Internal state key is exactly `'draft' | 'committed'` — never introduce "final" wording anywhere (code, types, UI copy, commit messages).
- Committed is never pre-filled from draft — there is no submit/promote/approve action anywhere in this feature.
- Hebrew banner/print-marker text is exactly `"טיוטת מערכת"`; the committed view renders no banner or badge at all.
- Staff/admin write access to committed rows is role-based, not ownership-based — any staff/admin can edit or remove any other staff member's committed row.
- `get_class_enrollment_counts`, `get_class_enrollment_count`, and `classes_with_enrollment` must count `status = 'committed'` rows only.
- The self-service "child" role (`user_id`-based, `child_id IS NULL`) is completely untouched: `scheduleApi.getUserSchedule` / `selectClass` / `unselectClass` and `useSchedule` keep their current signatures and behavior, with no `status` parameter added anywhere in that path.
- The print/export draft marker appears only when exporting while viewing draft (i.e. as a parent); it never appears when exporting committed.
- `ScheduleTable`, `ClassSelectionDrawer`, and `ScheduleService`'s existing conflict-detection methods need no changes — they already operate purely on whatever array they're handed.
- `MandatoryClassService` and any "mandatory class manager" UI are out of scope — confirmed dead code (`MandatoryClassService` has no importers anywhere in `src`, and no `MandatoryClassManager` component exists in this branch).

---

## Task 1: Database migration — status column, uniqueness fix, RLS rewrite, enrollment fix

**Files:**
- Create: `migrations/019_add_selection_status.sql`
- Modify: `migrations/migrations.json`

**Interfaces:**
- Produces: a `status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'committed'))` column on `public.schedule_selections`, which every later task's SQL/API/type work depends on.

This task has no automated test (this repo has no local Postgres/RLS test harness — confirmed via `Testing Decisions` in the spec). Verification is a set of manual SQL checks run in step 2.

- [ ] **Step 1: Write the migration**

Create `migrations/019_add_selection_status.sql`:

```sql
-- Migration: 019_add_selection_status
-- Description: Add a draft/committed status to schedule_selections so parents
--   and staff each get their own independently-editable set of picks for a
--   Child, instead of writing into the same rows. Replaces the
--   schedule_selections RLS policies from 002_rls_policies and
--   013_add_children_management with status-aware ones, fixes a pre-existing
--   uniqueness bug that blocked staff from committing the same class for more
--   than one student, fixes a pre-existing RLS bug that blocked one staff
--   member from editing another staff member's committed picks, and updates
--   the enrollment-count functions/view to count committed selections only.
-- Author: System
-- Date: 2026-09-09

BEGIN;

-- Step 1: Add the status column. No backfill needed -- there is nothing in
-- existing schedule_selections rows worth preserving as "committed" versus
-- "draft", so every existing row defaulting to 'draft' is fine.
ALTER TABLE public.schedule_selections
    ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'committed'));

COMMENT ON COLUMN public.schedule_selections.status IS
    'draft: parent/child-owned, freely edited. committed: staff/admin-owned, the only state staff ever sees. Never derived from each other.';

-- Step 2: The original UNIQUE(user_id, class_id) constraint (from
-- 001_initial_schema) was never updated when child_id was introduced in
-- 013_add_children_management. As written it blocks staff (one user_id) from
-- committing the same class for more than one student -- a normal, common
-- case -- and it can't express "one draft row and one committed row per
-- (child, class) is fine". Replace it with two scoped partial unique
-- indexes: one for child-linked rows (scoped per status, so a child can hold
-- a draft and a committed pick for the same class at once), one preserving
-- the original per-user behavior untouched for the legacy self-service
-- ("child" role, child_id IS NULL) rows.
ALTER TABLE public.schedule_selections
    DROP CONSTRAINT schedule_selections_user_id_class_id_key;

CREATE UNIQUE INDEX schedule_selections_child_class_status_key
    ON public.schedule_selections (child_id, class_id, status)
    WHERE child_id IS NOT NULL;

CREATE UNIQUE INDEX schedule_selections_user_class_key
    ON public.schedule_selections (user_id, class_id)
    WHERE child_id IS NULL;

-- Step 3: Replace every existing schedule_selections policy. Both 002's and
-- 013's policies are live today -- 013's DROP POLICY statements named
-- policies that don't match what 002 actually created, so those never fired.
DROP POLICY IF EXISTS "Users can view own selections" ON public.schedule_selections;
DROP POLICY IF EXISTS "Users can manage own selections" ON public.schedule_selections;
DROP POLICY IF EXISTS "Parents can view child selections" ON public.schedule_selections;
DROP POLICY IF EXISTS "Staff and admins can view all selections" ON public.schedule_selections;
DROP POLICY IF EXISTS "Users can view their own schedule selections" ON public.schedule_selections;
DROP POLICY IF EXISTS "Users can manage their own schedule selections" ON public.schedule_selections;

-- 3a. Legacy self-service "child" role: untouched behavior, just narrowed to
-- the rows that path actually owns (child_id IS NULL). These rows always
-- default to status = 'draft' and nothing here ever changes that.
CREATE POLICY "Child role can manage own selections" ON public.schedule_selections
    FOR ALL USING (auth.uid() = user_id AND child_id IS NULL);

-- 3b. Parents: can only ever read or write their own children's draft rows.
-- They can never read or write a committed row -- enforced here, not just
-- hidden in the UI.
CREATE POLICY "Parents can manage own children draft selections" ON public.schedule_selections
    FOR ALL USING (
        status = 'draft' AND
        child_id IN (
            SELECT child_id
            FROM public.parent_child_relationships
            WHERE parent_id = auth.uid()
        )
    );

-- 3c. Staff/admin read access stays unconditional on status, same as before
-- -- not narrowed to committed-only. This is what lets a future feature read
-- a child's draft while editing committed without needing an RLS change.
CREATE POLICY "Staff and admins can view all selections" ON public.schedule_selections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'staff')
            AND ur.approved = true
        )
    );

-- 3d. Staff/admin write access to committed rows is role-based, not
-- ownership-based, so any staff/admin can edit or remove any other staff
-- member's committed picks -- fixing the pre-existing bug where the old
-- user_id = auth.uid() policy only let the original creator touch a row.
CREATE POLICY "Staff and admins can manage committed selections" ON public.schedule_selections
    FOR ALL USING (
        status = 'committed' AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'staff')
            AND ur.approved = true
        )
    );

-- Step 4: Enrollment counts must reflect committed selections only -- once a
-- child can have both a draft and a committed row for the same class, every
-- such child would otherwise be counted twice, and this number is shown to
-- everyone browsing classes, parents included.
CREATE OR REPLACE FUNCTION public.get_class_enrollment_counts(target_scope class_scope DEFAULT NULL)
RETURNS TABLE (class_id UUID, enrollment_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as class_id,
        COALESCE(enrollment_data.count, 0) as enrollment_count
    FROM public.classes c
    LEFT JOIN (
        SELECT
            ss.class_id,
            COUNT(*) as count
        FROM public.schedule_selections ss
        INNER JOIN public.classes cls ON ss.class_id = cls.id
        WHERE
            ss.child_id IS NOT NULL  -- Only count child enrollments, not legacy user enrollments
            AND ss.status = 'committed'  -- Only count actual enrollment, not in-progress drafts
            AND (target_scope IS NULL OR cls.scope = target_scope)  -- Filter by scope if specified
        GROUP BY ss.class_id
    ) enrollment_data ON c.id = enrollment_data.class_id
    WHERE (target_scope IS NULL OR c.scope = target_scope);  -- Filter by scope if specified
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_class_enrollment_count(p_class_id UUID, target_scope class_scope DEFAULT NULL)
RETURNS BIGINT AS $$
DECLARE
    count_result BIGINT;
BEGIN
    SELECT COUNT(*) INTO count_result
    FROM public.schedule_selections ss
    INNER JOIN public.classes c ON ss.class_id = c.id
    WHERE
        ss.class_id = p_class_id
        AND ss.child_id IS NOT NULL  -- Only count child enrollments
        AND ss.status = 'committed'  -- Only count actual enrollment, not in-progress drafts
        AND (target_scope IS NULL OR c.scope = target_scope);  -- Filter by scope if specified

    RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE VIEW public.classes_with_enrollment AS
SELECT
    c.*,
    COALESCE(enrollment_data.enrollment_count, 0) as enrollment_count
FROM public.classes c
LEFT JOIN (
    SELECT
        ss.class_id,
        COUNT(*) as enrollment_count
    FROM public.schedule_selections ss
    INNER JOIN public.classes cls ON ss.class_id = cls.id
    WHERE
        ss.child_id IS NOT NULL
        AND ss.status = 'committed'
    GROUP BY ss.class_id
) enrollment_data ON c.id = enrollment_data.class_id;

COMMIT;
```

- [ ] **Step 2: Register the migration in the manifest**

Add a new entry to the `migrations` array in `migrations/migrations.json` (after the `018_add_group_and_track_fields` entry) and bump `schema_version`:

```json
    {
      "id": "019_add_selection_status",
      "name": "Add Selection Status",
      "description": "Add draft/committed status to schedule_selections, replace RLS policies with status-aware ones (also fixing two pre-existing bugs: staff unable to edit each other's committed picks, and staff unable to commit one class for multiple students), and update enrollment functions/view to count committed selections only",
      "file": "019_add_selection_status.sql",
      "created_at": "2026-09-09T00:00:00Z",
      "dependencies": ["018_add_group_and_track_fields"]
    }
```

Change `"schema_version": 18` to `"schema_version": 19` at the bottom of the same file.

- [ ] **Step 3: Apply the migration and verify manually**

Run the SQL in `migrations/019_add_selection_status.sql` against your Supabase project (SQL editor, or `psql` against the project's connection string — this repo's `npm run migrate` only prints pending migrations, it does not execute them).

Then verify with these queries (adjust the example UUIDs to real rows in your data):

```sql
-- The column exists with the right default/check.
select column_name, column_default, is_nullable
from information_schema.columns
where table_name = 'schedule_selections' and column_name = 'status';

-- A child can hold one draft and one committed row for the same class.
-- (Run as a user whose auth.uid() matches; or check as postgres/service role
-- that the unique indexes don't reject two rows differing only by status.)
select child_id, class_id, status, count(*)
from schedule_selections
group by child_id, class_id, status
having count(*) > 1;
-- expect: no rows (still unique per (child_id, class_id, status))

-- Enrollment counts only include committed rows.
select * from get_class_enrollment_counts() limit 5;
```

Also confirm in the Supabase dashboard (Authentication → RLS, or by running queries as different roles via `set role`/JWT claims) that:
- A parent JWT can `select`/`insert`/`update`/`delete` only rows where `child_id` is one of their own children and `status = 'draft'`.
- A staff JWT can `select` all rows, but can only write rows where `status = 'committed'`.
- Two different staff accounts can each update a `committed` row the other one created.

- [ ] **Step 4: Commit**

```bash
git add migrations/019_add_selection_status.sql migrations/migrations.json
git commit -m "feat: add draft/committed status to schedule_selections"
```

---

## Task 2: Types — `SelectionStatus` and `schedule_selections` Database types

**Files:**
- Modify: `src/types/index.ts:72-78`
- Modify: `src/services/supabase.ts:130-152`

**Interfaces:**
- Produces: `SelectionStatus` (`"draft" | "committed"`), and `status: SelectionStatus` on `ScheduleSelection` (and therefore on everything that extends it: `ScheduleSelectionWithClass`, `ScheduleSelectionWithChild`). Every later task that touches `schedule_selections` rows depends on this.

No runtime test — this is a type-only change, verified by the TypeScript compiler.

- [ ] **Step 1: Add `SelectionStatus` and extend `ScheduleSelection`**

In `src/types/index.ts`, replace:

```ts
export interface ScheduleSelection {
  id: string;
  userId: string;
  classId: string;
  createdAt: string;
  updatedAt: string;
}
```

with:

```ts
export type SelectionStatus = "draft" | "committed";

export interface ScheduleSelection {
  id: string;
  userId: string;
  classId: string;
  status: SelectionStatus;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Fix the drifted `schedule_selections` Database types**

In `src/services/supabase.ts`, replace the whole `schedule_selections` block:

```ts
      schedule_selections: {
        Row: {
          id: string;
          user_id: string;
          class_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          class_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          class_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
```

with:

```ts
      schedule_selections: {
        Row: {
          id: string;
          user_id: string;
          class_id: string;
          child_id: string | null;
          status: "draft" | "committed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          class_id: string;
          child_id?: string | null;
          status?: "draft" | "committed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          class_id?: string;
          child_id?: string | null;
          status?: "draft" | "committed";
          created_at?: string;
          updated_at?: string;
        };
      };
```

(`child_id` was already a real column since `013_add_children_management` but was missing from this hand-maintained type file — fixing that drift here since we're already touching this block.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: fails — every place that constructs a `ScheduleSelectionWithClass`/`ScheduleSelection` object (in `src/services/api.ts` and `src/services/trackSelectionService.test.ts`) is now missing the required `status` field. This is expected; Tasks 3-6 fix each of those call sites.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/services/supabase.ts
git commit -m "feat: add SelectionStatus and status field to ScheduleSelection types"
```

---

## Task 3: `ScheduleService.resolveSelectionStatus` — the single decision point

**Files:**
- Modify: `src/services/scheduleService.ts:1-9` (imports), append method to `ScheduleService`
- Test: `src/services/scheduleService.test.ts` (append)

**Interfaces:**
- Consumes: `UserRole | undefined` (from `src/types/index.ts`).
- Produces: `ScheduleService.resolveSelectionStatus(role: UserRole | undefined): SelectionStatus` — `SchedulePage` (Task 7) and nothing else calls this.

- [ ] **Step 1: Write the failing tests**

Append to the end of `src/services/scheduleService.test.ts`:

```ts
describe("ScheduleService.resolveSelectionStatus", () => {
  it("resolves staff to committed", () => {
    expect(ScheduleService.resolveSelectionStatus("staff")).toBe("committed");
  });

  it("resolves admin to committed", () => {
    expect(ScheduleService.resolveSelectionStatus("admin")).toBe("committed");
  });

  it("resolves parent to draft", () => {
    expect(ScheduleService.resolveSelectionStatus("parent")).toBe("draft");
  });

  it("resolves child to draft", () => {
    expect(ScheduleService.resolveSelectionStatus("child")).toBe("draft");
  });

  it("resolves no role (undefined) to draft", () => {
    expect(ScheduleService.resolveSelectionStatus(undefined)).toBe("draft");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/services/scheduleService.test.ts`
Expected: FAIL with `resolveSelectionStatus is not a function`.

- [ ] **Step 3: Implement `resolveSelectionStatus`**

In `src/services/scheduleService.ts`, change the import block:

```ts
import type {
  ClassSlot,
  ClassSlotWithTimeSlot,
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  TimeSlot,
  WeeklySchedule,
} from "../types";
```

to:

```ts
import type {
  ClassSlot,
  ClassSlotWithTimeSlot,
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  SelectionStatus,
  TimeSlot,
  UserRole,
  WeeklySchedule,
} from "../types";
```

Then add this method to the `ScheduleService` class, after `validateTimeSlot` (the last method):

```ts
  /**
   * The single decision point for which selection state a viewer edits/sees:
   * staff and admin always work in committed, everyone else (parent, child,
   * or no role yet) works in draft.
   */
  static resolveSelectionStatus(role: UserRole | undefined): SelectionStatus {
    return role === "staff" || role === "admin" ? "committed" : "draft";
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/services/scheduleService.test.ts`
Expected: PASS (all tests in the file, not just the new ones).

- [ ] **Step 5: Commit**

```bash
git add src/services/scheduleService.ts src/services/scheduleService.test.ts
git commit -m "feat: add ScheduleService.resolveSelectionStatus"
```

---

## Task 4: `scheduleApi` — thread `status` through the Child-linked read/write functions

**Files:**
- Modify: `src/services/api.ts:1-14` (imports), `:613-643` (`getUserSchedule`), `:670-733` (`getChildSchedule`, `selectClassForChild`, `unselectClassForChild`)
- Modify: `src/services/api.test.ts:67`

**Interfaces:**
- Consumes: `SelectionStatus` (Task 2).
- Produces: `scheduleApi.getChildSchedule(childId: string, status: SelectionStatus): Promise<ScheduleSelectionWithClass[]>`, `scheduleApi.selectClassForChild(childId: string, classId: string, status: SelectionStatus): Promise<any>`, `scheduleApi.unselectClassForChild(childId: string, classId: string, status: SelectionStatus): Promise<void>` — depended on by Task 5 (`useChildSchedule`) and Task 6 (`TrackSelectionService`).
- `getUserSchedule` / `selectClass` / `unselectClass` (the self-service, `user_id`-only functions) keep their existing signatures untouched, per Global Constraints.

- [ ] **Step 1: Add `SelectionStatus` to the type import**

In `src/services/api.ts`, change the top `import type {...} from "../types";` block from:

```ts
import type {
  Child,
  ChildShareToken,
  ChildWithParents,
  Class,
  ClassSlot,
  ClassWithTimeSlot,
  PendingApproval,
  ScheduleSelectionWithClass,
  Scope,
  TimeSlot,
  User,
  UserRole,
  UserRoleData,
} from "../types";
```

to:

```ts
import type {
  Child,
  ChildShareToken,
  ChildWithParents,
  Class,
  ClassSlot,
  ClassWithTimeSlot,
  PendingApproval,
  ScheduleSelectionWithClass,
  Scope,
  SelectionStatus,
  TimeSlot,
  User,
  UserRole,
  UserRoleData,
} from "../types";
```

- [ ] **Step 2: Add the `status` field to `getUserSchedule`'s mapping**

`getUserSchedule` itself is untouched (no query filter, no new parameter) — it only needs the `status` field added to its returned objects so they satisfy the now-required `ScheduleSelectionWithClass` type. In `src/services/api.ts`, inside `getUserSchedule`, change:

```ts
    return filteredData.map(selection => ({
      id: selection.id,
      userId: selection.user_id,
      classId: selection.class_id,
      createdAt: selection.created_at,
      updatedAt: selection.updated_at,
      class: mapClassRow(selection.class, timeSlotsById),
    }));
  },

  async selectClass(userId: string, classId: string) {
```

to:

```ts
    return filteredData.map(selection => ({
      id: selection.id,
      userId: selection.user_id,
      classId: selection.class_id,
      status: selection.status,
      createdAt: selection.created_at,
      updatedAt: selection.updated_at,
      class: mapClassRow(selection.class, timeSlotsById),
    }));
  },

  async selectClass(userId: string, classId: string) {
```

- [ ] **Step 3: Thread `status` through `getChildSchedule`**

Change:

```ts
  async getChildSchedule(
    childId: string
  ): Promise<ScheduleSelectionWithClass[]> {
    const isProduction = process.env.NODE_ENV === "production";
    const [{ data, error }, timeSlotsById] = await Promise.all([
      supabase
        .from("schedule_selections")
        .select(
          `
        *,
        class:classes(*)
      `
        )
        .eq("child_id", childId),
      fetchTimeSlotsById(),
    ]);

    if (error) throw new ApiError(error.message);

    let filteredData = data;
    if (isProduction) {
      filteredData = data.filter(selection => selection.class.scope !== "test");
    }
    return filteredData.map(selection => ({
      id: selection.id,
      userId: selection.user_id,
      classId: selection.class_id,
      createdAt: selection.created_at,
      updatedAt: selection.updated_at,
      class: mapClassRow(selection.class, timeSlotsById),
    }));
  },
```

to:

```ts
  async getChildSchedule(
    childId: string,
    status: SelectionStatus
  ): Promise<ScheduleSelectionWithClass[]> {
    const isProduction = process.env.NODE_ENV === "production";
    const [{ data, error }, timeSlotsById] = await Promise.all([
      supabase
        .from("schedule_selections")
        .select(
          `
        *,
        class:classes(*)
      `
        )
        .eq("child_id", childId)
        .eq("status", status),
      fetchTimeSlotsById(),
    ]);

    if (error) throw new ApiError(error.message);

    let filteredData = data;
    if (isProduction) {
      filteredData = data.filter(selection => selection.class.scope !== "test");
    }
    return filteredData.map(selection => ({
      id: selection.id,
      userId: selection.user_id,
      classId: selection.class_id,
      status: selection.status,
      createdAt: selection.created_at,
      updatedAt: selection.updated_at,
      class: mapClassRow(selection.class, timeSlotsById),
    }));
  },
```

Note: don't rely on RLS alone here — staff's SELECT policy (Task 1) is deliberately unconditional on status, so an unfiltered query would return draft and committed rows mixed together in one call.

- [ ] **Step 4: Thread `status` through `selectClassForChild`**

Change:

```ts
  async selectClassForChild(childId: string, classId: string) {
    // Get current user ID (parent making the selection)
    const {
      data: { user },
    } = await withTimeout(supabase.auth.getUser(), AUTH_LOCKED_CALL_TIMEOUT_MS);
    if (!user) throw new ApiError("User not authenticated");

    const { data, error } = await supabase
      .from("schedule_selections")
      .insert([
        {
          user_id: user.id,
          child_id: childId,
          class_id: classId,
        },
      ])
      .select();

    if (error) throw new ApiError(error.message);
    return data[0];
  },
```

to:

```ts
  async selectClassForChild(
    childId: string,
    classId: string,
    status: SelectionStatus
  ) {
    // Get current user ID (parent making the selection)
    const {
      data: { user },
    } = await withTimeout(supabase.auth.getUser(), AUTH_LOCKED_CALL_TIMEOUT_MS);
    if (!user) throw new ApiError("User not authenticated");

    const { data, error } = await supabase
      .from("schedule_selections")
      .insert([
        {
          user_id: user.id,
          child_id: childId,
          class_id: classId,
          status,
        },
      ])
      .select();

    if (error) throw new ApiError(error.message);
    return data[0];
  },
```

- [ ] **Step 5: Thread `status` through `unselectClassForChild`**

Change:

```ts
  async unselectClassForChild(childId: string, classId: string) {
    const { error } = await supabase
      .from("schedule_selections")
      .delete()
      .eq("child_id", childId)
      .eq("class_id", classId);

    if (error) throw new ApiError(error.message);
  },
```

to:

```ts
  async unselectClassForChild(
    childId: string,
    classId: string,
    status: SelectionStatus
  ) {
    const { error } = await supabase
      .from("schedule_selections")
      .delete()
      .eq("child_id", childId)
      .eq("class_id", classId)
      .eq("status", status);

    if (error) throw new ApiError(error.message);
  },
```

This `.eq("status", status)` is required, not optional: without it, once a child can have both a draft and a committed row for the same class, this delete would remove both rows instead of just the one the caller meant to unselect.

- [ ] **Step 6: Fix the existing test call site**

In `src/services/api.test.ts`, change:

```ts
    const call = scheduleApi.selectClassForChild("child-1", "class-1");
```

to:

```ts
    const call = scheduleApi.selectClassForChild("child-1", "class-1", "draft");
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/services/api.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/services/api.ts src/services/api.test.ts
git commit -m "feat: thread selection status through scheduleApi child-linked functions"
```

---

## Task 5: `useChildSchedule` — take `status`, drop the internal role check

**Files:**
- Modify: `src/hooks/useChildSchedule.ts` (full rewrite — every call site inside changes)

**Interfaces:**
- Consumes: `scheduleApi.getChildSchedule/selectClassForChild/unselectClassForChild` (Task 4, all now require `status`).
- Produces: `useChildSchedule(child: Child | undefined, status: SelectionStatus)` — the caller decides the status; the hook just fetches/writes whatever status it's given. Depended on by Task 7 (`SchedulePage`).

- [ ] **Step 1: Rewrite the hook**

Replace the full contents of `src/hooks/useChildSchedule.ts` with:

```ts
import { useEffect, useState } from "react";
import { scheduleApi } from "../services/api";
import type { Child, ScheduleSelectionWithClass, SelectionStatus } from "../types";

export function useChildSchedule(
  child: Child | undefined,
  status: SelectionStatus
) {
  const [schedule, setSchedule] = useState<ScheduleSelectionWithClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!child) {
      setSchedule([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadSchedule = async () => {
      setLoading(true);
      setError(null);
      try {
        const childSchedule = await scheduleApi.getChildSchedule(
          child.id,
          status
        );
        if (mounted) {
          setSchedule(childSchedule);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load child schedule"
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadSchedule();

    return () => {
      mounted = false;
    };
  }, [child?.id, status]);

  const refetch = async (): Promise<void> => {
    if (!child) return;
    const childSchedule = await scheduleApi.getChildSchedule(child.id, status);
    setSchedule(childSchedule);
  };

  const selectClassForChild = async (classId: string): Promise<void> => {
    if (!child) throw new Error("No child selected");

    try {
      await scheduleApi.selectClassForChild(child.id, classId, status);
      // Refresh schedule
      const childSchedule = await scheduleApi.getChildSchedule(
        child.id,
        status
      );
      setSchedule(childSchedule);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to select class";
      setError(message);
      throw new Error(message);
    }
  };

  const unselectClassForChild = async (classId: string): Promise<void> => {
    if (!child) throw new Error("No child selected");

    try {
      await scheduleApi.unselectClassForChild(child.id, classId, status);
      // Refresh schedule
      const childSchedule = await scheduleApi.getChildSchedule(
        child.id,
        status
      );
      setSchedule(childSchedule);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to unselect class";
      setError(message);
      throw new Error(message);
    }
  };

  const isClassSelected = (classId: string): boolean => {
    return schedule.some(selection => selection.classId === classId);
  };

  return {
    schedule,
    loading,
    error,
    selectClassForChild,
    unselectClassForChild,
    isClassSelected,
    refetch,
  };
}
```

Note what changed beyond the `status` param: the `useAuth`/`hasRole` import and the `useMemo` dependency workaround are gone entirely — they only existed to guard the fetch by role, which the caller now does implicitly by choosing which `status` to pass in (and `SchedulePage`'s existing `canSelectClasses`/`canViewClasses` checks still gate whether the hook is even meaningful to call). The effect now depends directly on `[child?.id, status]`.

This hook has no existing unit test and none is being added — this repo has no hook-testing harness, and per the spec's Testing Decisions this is verified manually in Task 9, not via a new automated seam.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: still fails — `SchedulePage.tsx:127` calls `useChildSchedule` with one argument. This is expected; Task 7 fixes it.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useChildSchedule.ts
git commit -m "feat: useChildSchedule takes an explicit status instead of deriving it from role"
```

---

## Task 6: `TrackSelectionService` — thread `status` through the write path

**Files:**
- Modify: `src/services/trackSelectionService.ts:1-6` (imports), `:50-60` (`applyTrackClassChanges`), `:68-85` (`syncTrackClasses`)
- Modify: `src/components/ChildManagement.tsx:60-68`, `:88-94` (both `syncTrackClasses` call sites)
- Test: `src/services/trackSelectionService.test.ts`

**Interfaces:**
- Consumes: `scheduleApi.selectClassForChild/unselectClassForChild/getChildSchedule` (Task 4).
- Produces: `TrackSelectionService.applyTrackClassChanges(childId: string, changes: TrackClassChanges, status: SelectionStatus): Promise<void>`, `TrackSelectionService.syncTrackClasses(child: Pick<Child, "id" | "grade">, newTrackNumber: number | null, status: SelectionStatus): Promise<void>`. `computeTrackClassChanges` itself is **unchanged** — it's already status-agnostic, purely diffing whatever `currentSchedule` array it's handed (same reasoning as `ScheduleService`'s conflict-detection methods needing no change).
- Depended on by Task 7 (`SchedulePage`'s track-change handler).

- [ ] **Step 1: Add `status` field to the test factory and add a status-agnostic regression test**

In `src/services/trackSelectionService.test.ts`, change the imports and `makeSelection` factory from:

```ts
import { describe, expect, it } from "vitest";
import type {
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  TimeSlot,
} from "../types";
import { TrackSelectionService } from "./trackSelectionService";
```

to:

```ts
import { describe, expect, it } from "vitest";
import type {
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  SelectionStatus,
  TimeSlot,
} from "../types";
import { TrackSelectionService } from "./trackSelectionService";
```

and:

```ts
const makeSelection = (cls: ClassWithTimeSlot): ScheduleSelectionWithClass => ({
  id: `sel-${cls.id}`,
  userId: "user-1",
  classId: cls.id,
  createdAt: "",
  updatedAt: "",
  class: cls,
});
```

to:

```ts
const makeSelection = (
  cls: ClassWithTimeSlot,
  status: SelectionStatus = "draft"
): ScheduleSelectionWithClass => ({
  id: `sel-${cls.id}`,
  userId: "user-1",
  classId: cls.id,
  status,
  createdAt: "",
  updatedAt: "",
  class: cls,
});
```

Then append a new test at the end of the `describe("TrackSelectionService.computeTrackClassChanges", ...)` block (after the `"leaves non-track selections untouched"` test, before the closing `});`):

```ts
  it("computes identical changes regardless of which status the given selections carry", () => {
    const track1Math = makeClass({ id: "math-1", trackNumber: 1 });
    const track2Math = makeClass({ id: "math-2", trackNumber: 2 });

    const draftResult = TrackSelectionService.computeTrackClassChanges(
      [track1Math, track2Math],
      [makeSelection(track1Math, "draft")],
      4,
      2
    );
    const committedResult = TrackSelectionService.computeTrackClassChanges(
      [track1Math, track2Math],
      [makeSelection(track1Math, "committed")],
      4,
      2
    );

    expect(committedResult).toEqual(draftResult);
    expect(draftResult.toSelect.map(c => c.id)).toEqual(["math-2"]);
    expect(draftResult.toUnselectIds).toEqual(["math-1"]);
  });
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `npx vitest run src/services/trackSelectionService.test.ts`
Expected: PASS. (This confirms `computeTrackClassChanges` genuinely needs no code change — it was already ignoring everything but `classId`/`trackNumber`/`grades` on the selections it's handed.)

- [ ] **Step 3: Thread `status` through `applyTrackClassChanges` and `syncTrackClasses`**

In `src/services/trackSelectionService.ts`, change the import block:

```ts
import { classesApi, scheduleApi } from "./api";
import type {
  Child,
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
} from "../types";
```

to:

```ts
import { classesApi, scheduleApi } from "./api";
import type {
  Child,
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  SelectionStatus,
} from "../types";
```

Change:

```ts
  async applyTrackClassChanges(
    childId: string,
    { toSelect, toUnselectIds }: TrackClassChanges
  ): Promise<void> {
    await Promise.all([
      ...toUnselectIds.map(classId =>
        scheduleApi.unselectClassForChild(childId, classId)
      ),
      ...toSelect.map(cls => scheduleApi.selectClassForChild(childId, cls.id)),
    ]);
  },
```

to:

```ts
  async applyTrackClassChanges(
    childId: string,
    { toSelect, toUnselectIds }: TrackClassChanges,
    status: SelectionStatus
  ): Promise<void> {
    await Promise.all([
      ...toUnselectIds.map(classId =>
        scheduleApi.unselectClassForChild(childId, classId, status)
      ),
      ...toSelect.map(cls =>
        scheduleApi.selectClassForChild(childId, cls.id, status)
      ),
    ]);
  },
```

Change:

```ts
  async syncTrackClasses(
    child: Pick<Child, "id" | "grade">,
    newTrackNumber: number | null
  ): Promise<void> {
    const [allClasses, currentSchedule] = await Promise.all([
      classesApi.getClasses(),
      scheduleApi.getChildSchedule(child.id),
    ]);

    const changes = this.computeTrackClassChanges(
      allClasses,
      currentSchedule,
      child.grade,
      newTrackNumber
    );

    await this.applyTrackClassChanges(child.id, changes);
  },
```

to:

```ts
  async syncTrackClasses(
    child: Pick<Child, "id" | "grade">,
    newTrackNumber: number | null,
    status: SelectionStatus
  ): Promise<void> {
    const [allClasses, currentSchedule] = await Promise.all([
      classesApi.getClasses(),
      scheduleApi.getChildSchedule(child.id, status),
    ]);

    const changes = this.computeTrackClassChanges(
      allClasses,
      currentSchedule,
      child.grade,
      newTrackNumber
    );

    await this.applyTrackClassChanges(child.id, changes, status);
  },
```

- [ ] **Step 4: Update `syncTrackClasses` callers in `ChildManagement.tsx`**

`ChildManagement` (rendered from `ProfileSettingsPage`, backed by `useChildren()` which always loads the current user's own children via `childrenApi.getParentChildren`) is a parent-only flow — a parent editing their own child always writes draft. Hardcode `"draft"` at both call sites.

In `src/components/ChildManagement.tsx`, change:

```ts
      if (data.trackNumber) {
        await TrackSelectionService.syncTrackClasses(
          newChild,
          data.trackNumber
        );
      }
```

to:

```ts
      if (data.trackNumber) {
        await TrackSelectionService.syncTrackClasses(
          newChild,
          data.trackNumber,
          "draft"
        );
      }
```

and change:

```ts
      if (editingChild.trackNumber !== newTrackNumber) {
        await TrackSelectionService.syncTrackClasses(
          updatedChild,
          newTrackNumber
        );
      }
```

to:

```ts
      if (editingChild.trackNumber !== newTrackNumber) {
        await TrackSelectionService.syncTrackClasses(
          updatedChild,
          newTrackNumber,
          "draft"
        );
      }
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: only remaining errors are in `src/pages/SchedulePage.tsx` (the `TrackSelectionService.applyTrackClassChanges` call there is still missing the new `status` argument, and `useChildSchedule` is still called with one argument). This is expected; Task 7 fixes it.

- [ ] **Step 6: Commit**

```bash
git add src/services/trackSelectionService.ts src/services/trackSelectionService.test.ts src/components/ChildManagement.tsx
git commit -m "feat: thread selection status through TrackSelectionService"
```

---

## Task 7: `SchedulePage` wiring — `viewStatus`, `DraftBanner`, Hebrew copy

**Files:**
- Create: `src/elements/DraftBanner.tsx`
- Modify: `src/locales/he.json:61` (new key inside `"schedule"`)
- Modify: `src/pages/SchedulePage.tsx` (imports, `viewStatus`, hook/handler call sites, render)

**Interfaces:**
- Consumes: `ScheduleService.resolveSelectionStatus` (Task 3), `useChildSchedule(child, status)` (Task 5), `TrackSelectionService.applyTrackClassChanges(childId, changes, status)` (Task 6).
- Produces: `viewStatus` as the one place `SchedulePage` decides draft vs. committed; everything downstream (fetch hook, write handlers, banner) takes it as a plain value.

- [ ] **Step 1: Add the Hebrew banner text**

In `src/locales/he.json`, inside the `"schedule"` object, add a new top-level key right after the opening brace (before `"page": {`):

```json
  "schedule": {
    "draftBanner": "טיוטת מערכת",
    "page": {
```

(Only the new line is added — `"page": {` and everything after it stays exactly as-is.)

- [ ] **Step 2: Create the `DraftBanner` element**

Create `src/elements/DraftBanner.tsx`:

```tsx
import { Alert } from "antd";
import { useTranslation } from "react-i18next";

export const DraftBanner = () => {
  const { t } = useTranslation();

  return (
    <Alert
      message={t("schedule.draftBanner")}
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
    />
  );
};
```

This follows the same pattern as the existing `src/elements/DoubleLessonTag.tsx` and `src/elements/TrackTag.tsx` (small, presentational, no props, own translation lookup). No test — matches the existing convention for this class of element (none of `DoubleLessonTag`/`TrackTag`/`GradesRangeTag` have tests either).

- [ ] **Step 3: Wire `viewStatus` into `SchedulePage`**

In `src/pages/SchedulePage.tsx`, add two imports after the existing `import { TrackSelectionService } from "../services/trackSelectionService";` line:

```tsx
import { TrackSelectionService } from "../services/trackSelectionService";
import { ScheduleService } from "../services/scheduleService";
import { DraftBanner } from "../elements/DraftBanner";
```

Right after the existing `const isParent = hasRole("parent");` line, add:

```tsx
  const isParent = hasRole("parent");
  const viewStatus = ScheduleService.resolveSelectionStatus(currentRole?.role);
```

- [ ] **Step 4: Pass `viewStatus` into `useChildSchedule`**

Change:

```tsx
  } = useChildSchedule(isStaff ? staffSelectedChild : selectedChild);
```

to:

```tsx
  } = useChildSchedule(isStaff ? staffSelectedChild : selectedChild, viewStatus);
```

- [ ] **Step 5: Pass `viewStatus` into the track-change handler**

Change:

```tsx
        await TrackSelectionService.applyTrackClassChanges(
          updatedChild.id,
          changes
        );
```

to:

```tsx
        await TrackSelectionService.applyTrackClassChanges(
          updatedChild.id,
          changes,
          viewStatus
        );
```

- [ ] **Step 6: Render the banner**

Change:

```tsx
      <Card className="schedule-card">
        <ScheduleTable
```

to:

```tsx
      {viewStatus === "draft" && <DraftBanner />}

      <Card className="schedule-card">
        <ScheduleTable
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to this feature. (If any unrelated pre-existing errors surface, leave them — out of scope for this plan.)

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 9: Manually smoke-test in the browser**

Run `npm run dev`, sign in as a parent with at least one child, and confirm:
- The "טיוטת מערכת" banner appears above the schedule table.
- Selecting/unselecting a class still works and persists across a page refresh.

Then switch to (or sign in as) a staff/admin user and confirm:
- No banner appears.
- The schedule shown is independent of whatever the parent selected above (starts empty unless something was previously committed).

- [ ] **Step 10: Commit**

```bash
git add src/elements/DraftBanner.tsx src/locales/he.json src/pages/SchedulePage.tsx
git commit -m "feat: resolve draft/committed view status once in SchedulePage and show a draft banner"
```

---

## Task 8: Print/export draft marker

**Files:**
- Modify: `src/utils/printSchedule.ts:17-22` (interface), `:84-92` (props passed to `PrintableSchedule`)
- Modify: `src/components/PrintableSchedule.tsx:17-22` (props interface), `:30-35` (destructure), `:223-230` (render)
- Modify: `src/components/PrintableSchedule.css` (new rule)
- Modify: `src/pages/SchedulePage.tsx:262-267` (`handleExportSchedule`'s call to `printSchedule`)

**Interfaces:**
- Consumes: `viewStatus` (Task 7).
- Produces: `PrintScheduleData.showDraftMarker: boolean` and `PrintableScheduleProps.showDraftMarker?: boolean`.

No automated test — printing goes through `window.open`/a real DOM window, which this repo has no test harness for (consistent with there being no existing tests for either file today). Verified manually in step 6.

- [ ] **Step 1: Add `showDraftMarker` to `PrintScheduleData`**

In `src/utils/printSchedule.ts`, change:

```ts
interface PrintScheduleData {
  child: Child;
  timeSlots: TimeSlot[];
  weeklySchedule: WeeklySchedule;
  selectedClasses: string[];
}
```

to:

```ts
interface PrintScheduleData {
  child: Child;
  timeSlots: TimeSlot[];
  weeklySchedule: WeeklySchedule;
  selectedClasses: string[];
  showDraftMarker: boolean;
}
```

- [ ] **Step 2: Pass it through to `PrintableSchedule`**

Change:

```ts
        const printableScheduleElement = React.createElement(
          PrintableSchedule,
          {
            child: data.child,
            timeSlots: data.timeSlots,
            weeklySchedule: data.weeklySchedule,
            selectedClasses: data.selectedClasses,
          }
        );
```

to:

```ts
        const printableScheduleElement = React.createElement(
          PrintableSchedule,
          {
            child: data.child,
            timeSlots: data.timeSlots,
            weeklySchedule: data.weeklySchedule,
            selectedClasses: data.selectedClasses,
            showDraftMarker: data.showDraftMarker,
          }
        );
```

- [ ] **Step 3: Accept and render `showDraftMarker` in `PrintableSchedule`**

In `src/components/PrintableSchedule.tsx`, change:

```tsx
interface PrintableScheduleProps {
  child: Child;
  timeSlots: TimeSlot[];
  weeklySchedule: WeeklySchedule;
  selectedClasses: string[];
}
```

to:

```tsx
interface PrintableScheduleProps {
  child: Child;
  timeSlots: TimeSlot[];
  weeklySchedule: WeeklySchedule;
  selectedClasses: string[];
  showDraftMarker?: boolean;
}
```

Change the component's destructure:

```tsx
const PrintableSchedule: React.FC<PrintableScheduleProps> = ({
  child,
  timeSlots,
  weeklySchedule,
  selectedClasses,
}) => {
```

to:

```tsx
const PrintableSchedule: React.FC<PrintableScheduleProps> = ({
  child,
  timeSlots,
  weeklySchedule,
  selectedClasses,
  showDraftMarker,
}) => {
```

Change the header render:

```tsx
      <div className="print-header">
        <h1 className="print-title">
          מערכת של {child.firstName} {child.lastName} -{" "}
          {GetGradeName(child.grade)}
        </h1>
      </div>
```

to:

```tsx
      <div className="print-header">
        <h1 className="print-title">
          מערכת של {child.firstName} {child.lastName} -{" "}
          {GetGradeName(child.grade)}
        </h1>
        {showDraftMarker && (
          <div className="print-draft-marker">{t("schedule.draftBanner")}</div>
        )}
      </div>
```

- [ ] **Step 4: Add the marker's style**

In `src/components/PrintableSchedule.css`, add this rule right after the existing `.print-title { ... }` block:

```css
.print-draft-marker {
  font-size: 14px;
  font-weight: bold;
  color: #d46b08;
  margin: 4px 0 0 0;
}
```

- [ ] **Step 5: Pass `viewStatus` from `SchedulePage`'s export handler**

In `src/pages/SchedulePage.tsx`, change:

```tsx
      await printSchedule({
        child: currentChild,
        timeSlots,
        weeklySchedule,
        selectedClasses: getSelectedClasses(),
      });
```

to:

```tsx
      await printSchedule({
        child: currentChild,
        timeSlots,
        weeklySchedule,
        selectedClasses: getSelectedClasses(),
        showDraftMarker: viewStatus === "draft",
      });
```

- [ ] **Step 6: Type-check and manually verify**

Run: `npx tsc --noEmit`
Expected: PASS.

In the browser (`npm run dev`), as a parent with a selected child, click the export/print button and confirm the "טיוטת מערכת" line appears under the printed schedule's title. Then, as staff/admin with a selected child, export again and confirm no marker appears.

- [ ] **Step 7: Commit**

```bash
git add src/utils/printSchedule.ts src/components/PrintableSchedule.tsx src/components/PrintableSchedule.css src/pages/SchedulePage.tsx
git commit -m "feat: show a draft marker when printing/exporting the draft schedule"
```

---

## Task 9: Full manual verification pass

**Files:** none (verification only).

Run this checklist against a real Supabase project with the Task 1 migration applied, using at least two staff/admin accounts and one parent account with two children.

- [ ] **Step 1: Parent draft isolation**

As a parent, select and unselect several classes for one child. Confirm:
- The "טיוטת מערכת" banner is visible the whole time.
- Selections persist across a page refresh.
- Selections for one child don't appear when you switch to a different child.

- [ ] **Step 2: Parent cannot reach committed data**

While still signed in as the parent, attempt (via direct Supabase REST/JS calls with the parent's session, e.g. in the browser console) to `select`/`insert` a row with `status = 'committed'` for your own child. Confirm every attempt is rejected by RLS.

- [ ] **Step 3: Staff committed, independent of the parent's draft**

Sign in as staff, select the same child as the parent used above. Confirm:
- No banner is shown.
- The schedule starts independent of (not pre-filled from) whatever the parent drafted.
- Selecting/unselecting classes here does not change what the parent sees in their draft.

- [ ] **Step 4: Cross-staff write access**

Sign in as a second staff account. Confirm it can see and successfully edit/remove the committed selections the first staff account made in Step 3.

- [ ] **Step 5: One class, two students**

As staff, commit the same class for two different children. Confirm both commits succeed (this exercises the Task 1 uniqueness-index fix).

- [ ] **Step 6: Draft and committed coexist**

For one child, with a parent-drafted class and a staff-committed class both present for the same class, confirm no database error occurs and both rows exist simultaneously (query `schedule_selections` directly, filtered to that `child_id`/`class_id`, and confirm two rows: one `status = 'draft'`, one `status = 'committed'`).

- [ ] **Step 7: Enrollment counts**

Browse the class list as any role and confirm the displayed enrollment/seat count for a class only reflects committed selections, not draft ones (compare the on-screen count to a direct `select count(*) from schedule_selections where class_id = '<id>' and status = 'committed'` query).

- [ ] **Step 8: Track changes stay scoped**

As a parent, change a child's Track and confirm only their draft selections change. As staff (viewing the same child), change the Track again and confirm only committed selections change — the parent's draft is untouched by the staff-side Track change and vice versa.

- [ ] **Step 9: Print markers**

Repeat Task 8's manual print check here if not already done in this session: draft export shows the marker, committed export does not.

- [ ] **Step 10: Self-service "child" role untouched**

If a "child"-role test account is available, confirm it can still select/unselect its own classes exactly as before, with no banner and no visible change in behavior.

No commit for this task — if any step surfaces a bug, fix it as a follow-up commit referencing the specific step that failed.
