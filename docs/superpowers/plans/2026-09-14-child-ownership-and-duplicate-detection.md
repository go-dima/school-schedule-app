# Child Ownership & Duplicate Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop staff/admin from being silently linked as a child's parent on creation, clean up existing bad links, track who created each child (and show it in the UI), let a parent claim a staff-created child, and give a client-side heads-up when creating a child whose name+grade already exists.

**Architecture:** All child-creation funnels through one Postgres RPC, `create_child_with_relationship` (called from `childrenApi.createChild` in `src/services/api.ts`), which today unconditionally inserts a `parent_child_relationships` row for whoever calls it. This plan runs one manually-executed migration (schema change + one-time data cleanup + RPC fix), then a small frontend change: a plain client-side query against `children` (no new RPC) to warn on name+grade matches, and a `created_by` column surfaced in the UI. Volume of existing duplicates is small (≤5, per the earlier investigation) and gets fixed by hand — this plan is about stopping new ones and cleaning root cause, not building an exhaustive detection system.

**Tech Stack:** Postgres (Supabase) migration, React + TypeScript, Ant Design, react-i18next, Vitest.

**Spec:** GitHub issue [#105](https://github.com/go-dima/school-schedule-app/issues/105) and its follow-up comment.

## Global Constraints

- Every new user-facing string goes through `t("namespace.key")` via react-i18next, added to `src/locales/he.json` — no inline Hebrew literals in JSX.
- The existing single child ↔ one primary parent model is **not** changed — `created_by` is provenance only, never a second relationship.
- Duplicate name+grade is a **soft block**: creating a second child with the same name+grade must stay possible, but the creator must explicitly acknowledge a warning first.
- The duplicate check is a **local/client-side check only** — a plain query against `children`, not a dedicated backend RPC. Coverage is whatever's visible under existing RLS to the current role; this is an accepted tradeoff given the low volume.
- Exact warning copy: `שם הילד/ה <NAME> כבר נוצר ע"י <CREATOR NAME>`, plus the grade. Group/track number is **not** shown.
- Same-creator redirect copy: `ניתן לערוך פרטי ילד/ה במסך עריכת תלמיד` — no confirm-anyway option, it takes them straight to editing.
- The database migration is **run manually** by the user against Supabase (SQL editor / `psql`) — it is not wired into `scripts/run-migrations.sh` as part of this plan, and no task should assume it runs automatically.
- All work happens on a dedicated branch, not on `refactor/shared-filters-bar` or `main`.
- Commit once per task (not once per step) to keep history readable.
- New service-layer tests follow the existing Vitest mock pattern in `src/services/api.test.ts` (module-level `mockRpcResult`/`mockFromResult`).

---

### Task 1: Create the working branch

**Files:** none (git only)

- [x] **Step 1: Branch from the current base** — DONE (branch `feat/child-ownership-and-duplicate-check` created, this worktree checked out on it).

---

### Task 2: Database migration (run manually) — created_by, cleanup, RPC fixes

**Files:**

- Create: `migrations/030_child_ownership_and_duplicates.sql`
- Modify: `migrations/migrations.json` (register the filename in whatever format existing entries use)

**Interfaces:**

- Produces: `children.created_by UUID` — consumed by Task 3 (`Child.createdBy`) and Task 4/6 (local duplicate query, creator display).
- Produces: `public.claim_child(p_child_id UUID)` RPC — consumed by Task 4.
- Produces: updated `public.create_child_with_relationship(...)` — same signature as today, role-gated body.

This migration is **not run by an agent** — it's handed to the user to run manually in the Supabase SQL editor (or `psql`) against the real database. Write it once, verify it reads correctly, and stop; do not attempt to execute it yourself against a live environment.

- [ ] **Step 1: Confirm the current RPC's exact signature before touching it**

```bash
grep -n "CREATE OR REPLACE FUNCTION public.create_child_with_relationship" -A 60 migrations/027_lock_down_enrollment_views_and_child_creation.sql
```

Copy the real parameter list into the migration below instead of guessing — the block assumes params `p_first_name, p_last_name, p_grade, p_group_number, p_scope, p_track_number, p_status` based on the call site in `src/services/api.ts`; adjust names if Step 1 shows otherwise.

- [ ] **Step 2: Write the migration**

```sql
-- migrations/030_child_ownership_and_duplicates.sql
-- Run manually (Supabase SQL editor / psql) — not part of the automated
-- migration runner for this change.

-- 1) Provenance column.
ALTER TABLE public.children
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);

-- 2) Backfill created_by for ALL existing children from their current
--    primary parent_child_relationships row, unconditionally — this is
--    valid data (it reflects who actually created the record) regardless
--    of whether that person turns out to be a real parent or staff/admin.
UPDATE public.children c
SET created_by = pcr.parent_id
FROM public.parent_child_relationships pcr
WHERE pcr.child_id = c.id
  AND pcr.is_primary = true
  AND c.created_by IS NULL;

-- 3) Clean up bad parent links: remove parent_child_relationships rows
--    where the linked "parent" is staff/admin and is NOT also an approved
--    parent in their own right (this guards the rare multi-role
--    staff-who-is-also-a-parent user from losing their own real link).
DELETE FROM public.parent_child_relationships pcr
WHERE EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = pcr.parent_id
      AND ur.role IN ('staff', 'admin')
      AND ur.approved = true
)
AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = pcr.parent_id
      AND ur2.role = 'parent'
      AND ur2.approved = true
);

-- 4) Going forward: only link the caller as parent if they actually are one.
CREATE OR REPLACE FUNCTION public.create_child_with_relationship(
    p_first_name TEXT,
    p_last_name TEXT,
    p_grade INTEGER,
    p_group_number INTEGER DEFAULT NULL,
    p_scope TEXT DEFAULT 'prod',
    p_track_number INTEGER DEFAULT NULL,
    p_status TEXT DEFAULT 'draft'
)
RETURNS public.children
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID;
    caller_is_parent BOOLEAN;
    new_child public.children;
BEGIN
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = current_user_id
          AND role = 'parent'
          AND approved = true
    ) INTO caller_is_parent;

    INSERT INTO public.children (
        first_name, last_name, grade, group_number, scope,
        track_number_draft, track_number_committed, created_by
    )
    VALUES (
        p_first_name, p_last_name, p_grade, p_group_number, p_scope,
        p_track_number, p_track_number, current_user_id
    )
    RETURNING * INTO new_child;

    IF caller_is_parent THEN
        INSERT INTO public.parent_child_relationships (parent_id, child_id, is_primary)
        VALUES (current_user_id, new_child.id, true);
    END IF;

    RETURN new_child;
END;
$$;

-- 5) Claim flow: a parent can attach themselves to a staff-created child
--    that has no parent linked yet.
CREATE OR REPLACE FUNCTION public.claim_child(p_child_id UUID)
RETURNS public.parent_child_relationships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID;
    caller_is_parent BOOLEAN;
    existing_relationship_count INTEGER;
    new_relationship public.parent_child_relationships;
BEGIN
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = current_user_id
          AND role = 'parent'
          AND approved = true
    ) INTO caller_is_parent;

    IF NOT caller_is_parent THEN
        RAISE EXCEPTION 'Only approved parents can claim a child';
    END IF;

    SELECT COUNT(*) INTO existing_relationship_count
    FROM public.parent_child_relationships
    WHERE child_id = p_child_id;

    IF existing_relationship_count > 0 THEN
        RAISE EXCEPTION 'This child already has a linked parent and cannot be claimed';
    END IF;

    INSERT INTO public.parent_child_relationships (parent_id, child_id, is_primary)
    VALUES (current_user_id, p_child_id, true)
    RETURNING * INTO new_relationship;

    RETURN new_relationship;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_child(UUID) TO authenticated;
```

- [ ] **Step 3: Write the post-migration verification query (run manually, eyeball the output)**

```sql
SELECT
    (SELECT COUNT(*) FROM public.children) AS total_children,
    (SELECT COUNT(DISTINCT child_id) FROM public.parent_child_relationships) AS children_with_parent,
    (SELECT COUNT(*) FROM public.children)
      - (SELECT COUNT(DISTINCT child_id) FROM public.parent_child_relationships) AS children_without_parent;
```

Sanity expectation: `children_without_parent` should roughly equal the number of children that were only ever linked to a staff/admin account (the ones step 3 of the migration just cleaned up) — these are now the pool of "claimable" children.

- [ ] **Step 4: Hand off for manual execution**

Do not run this migration yourself. Paste it into the Supabase SQL editor (or hand the file to whoever runs migrations) and get the verification query's output back before continuing to Task 3, since Task 4's local duplicate query and Task 7's "created by" UI both depend on `created_by` actually being populated.

- [ ] **Step 5: Commit**

```bash
git add migrations/030_child_ownership_and_duplicates.sql migrations/migrations.json
git commit -m "feat: add children.created_by, clean up staff-as-parent links, add claim_child"
```

---

### Task 3: TypeScript types

**Files:**

- Modify: `src/types/index.ts`

**Interfaces:**

- Produces: `Child.createdBy: string | null`, `Child.createdByName: string | null` — consumed by Task 4 (local duplicate query mapping) and Task 6/7 (UI display + warning copy).

- [ ] **Step 1: Extend `Child` and add a small duplicate-match shape**

```ts
export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  grade: number;
  groupNumber: number | null;
  trackNumber: number | null;
  scope: Scope;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DuplicateChildMatch {
  id: string;
  grade: number;
  createdByUserId: string | null;
  createdByName: string | null;
  createdByIsSelf: boolean;
}
```

- [ ] **Step 2: Update the row-mapping function(s) that build `Child` objects**

```bash
grep -rn "trackNumber:" src/services/api.ts
```

Add `createdBy: row.created_by ?? null` and `createdByName` (derived from a joined `users` row — see Task 4 for the exact select shape) to whatever function maps a raw Supabase row to `Child`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/services/api.ts
git commit -m "feat: add createdBy/createdByName to Child type"
```

---

### Task 4: Service layer — local duplicate query + claimChild

**Files:**

- Modify: `src/services/api.ts`
- Modify: `src/services/api.test.ts`

**Interfaces:**

- Consumes: `DuplicateChildMatch` (Task 3).
- Produces: `childrenApi.findLocalDuplicateChildren(firstName, lastName, grade, excludeChildId?): Promise<DuplicateChildMatch[]>` (plain `.from("children")` query, **not** an RPC) and `childrenApi.claimChild(childId): Promise<ParentChildRelationship>` — consumed by Task 6/7.

- [ ] **Step 1: Confirm the FK name Supabase generates for `created_by`**

```bash
grep -n "children_created_by" migrations/030_child_ownership_and_duplicates.sql
```

If Postgres named the constraint something other than `children_created_by_fkey` (check with `\d children` in psql after Task 2 runs, or read the migration's `ALTER TABLE` — Postgres auto-names it `<table>_<column>_fkey` unless overridden, so it should be `children_created_by_fkey`), use the actual name in the embedded-resource select below.

- [ ] **Step 2: Write the failing tests**

```ts
// src/services/api.test.ts
describe("childrenApi.findLocalDuplicateChildren", () => {
  it("queries children directly (no RPC) filtered by name+grade and maps creator info", async () => {
    mockFromResult = {
      data: [
        {
          id: "child-1",
          grade: 6,
          created_by: "user-1",
          creator: {
            first_name: "נתלי",
            last_name: "צינדורף",
            email: "natalie@example.com",
          },
        },
      ],
      error: null,
    };

    const currentUserId = "user-2";
    const result = await childrenApi.findLocalDuplicateChildren(
      "ליאו",
      "פלד",
      6,
      undefined,
      currentUserId
    );

    expect(result).toEqual([
      {
        id: "child-1",
        grade: 6,
        createdByUserId: "user-1",
        createdByName: "נתלי צינדורף",
        createdByIsSelf: false,
      },
    ]);
  });

  it("excludes the given child id from results", async () => {
    mockFromResult = { data: [], error: null };

    await childrenApi.findLocalDuplicateChildren(
      "ליאו",
      "פלד",
      6,
      "child-1",
      "user-2"
    );

    expect(supabase.from).toHaveBeenCalledWith("children");
  });
});

describe("childrenApi.claimChild", () => {
  it("calls claim_child RPC and returns the mapped relationship", async () => {
    mockRpcResult = {
      data: {
        id: "rel-1",
        parent_id: "user-1",
        child_id: "child-1",
        is_primary: true,
        created_at: "2026-09-14T00:00:00Z",
      },
      error: null,
    };

    const result = await childrenApi.claimChild("child-1");

    expect(supabase.rpc).toHaveBeenCalledWith("claim_child", {
      p_child_id: "child-1",
    });
    expect(result).toEqual({
      id: "rel-1",
      parentId: "user-1",
      childId: "child-1",
      isPrimary: true,
      createdAt: "2026-09-14T00:00:00Z",
    });
  });

  it("throws when the RPC errors", async () => {
    mockRpcResult = {
      data: null,
      error: {
        message: "This child already has a linked parent and cannot be claimed",
      },
    };

    await expect(childrenApi.claimChild("child-1")).rejects.toThrow(
      "This child already has a linked parent and cannot be claimed"
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/services/api.test.ts -t "findLocalDuplicateChildren"
npx vitest run src/services/api.test.ts -t "claimChild"
```

- [ ] **Step 4: Implement both functions**

```ts
// src/services/api.ts, inside childrenApi
async findLocalDuplicateChildren(
  firstName: string,
  lastName: string,
  grade: number,
  excludeChildId: string | undefined,
  currentUserId: string,
): Promise<DuplicateChildMatch[]> {
  let query = supabase
    .from("children")
    .select("id, grade, created_by, creator:users!children_created_by_fkey(first_name, last_name, email)")
    .ilike("first_name", firstName.trim())
    .ilike("last_name", lastName.trim())
    .eq("grade", grade);

  if (excludeChildId) {
    query = query.neq("id", excludeChildId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to check for duplicate children: ${error.message}`);
  }

  return (data ?? []).map((row: {
    id: string;
    grade: number;
    created_by: string | null;
    creator: { first_name: string | null; last_name: string | null; email: string } | null;
  }) => ({
    id: row.id,
    grade: row.grade,
    createdByUserId: row.created_by,
    createdByName: row.creator
      ? [row.creator.first_name, row.creator.last_name].filter(Boolean).join(" ") || row.creator.email
      : null,
    createdByIsSelf: row.created_by === currentUserId,
  }));
},

async claimChild(childId: string): Promise<ParentChildRelationship> {
  const { data, error } = await supabase.rpc("claim_child", { p_child_id: childId });

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    parentId: data.parent_id,
    childId: data.child_id,
    isPrimary: data.is_primary,
    createdAt: data.created_at,
  };
},
```

_(`currentUserId` is passed in rather than fetched inside this function so the function stays easily testable — get it from whatever the app's existing auth context/hook exposes, e.g. `grep -rn "supabase.auth.getUser\|useAuth" src/` to find the established pattern before wiring the caller in Task 6.)_

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/services/api.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/services/api.ts src/services/api.test.ts
git commit -m "feat: add local duplicate-child query and claimChild"
```

---

### Task 5: i18n keys

**Files:**

- Modify: `src/locales/he.json`

- [ ] **Step 1: Add keys**

```json
"duplicateWarning": {
  "title": "שם דומה כבר קיים",
  "existsMessage": "שם הילד/ה {{name}} כבר נוצר ע\"י {{creator}}, כיתה {{grade}}",
  "continueAnyway": "המשך בכל זאת",
  "cancel": "ביטול",
  "sameCreatorMessage": "ניתן לערוך פרטי ילד/ה במסך עריכת תלמיד",
  "goToEdit": "מעבר לעריכה"
}
```

Add as a sibling under the existing `"child"` block. Also add, under `"students": { "page": { ... } }`:

```json
"createdByColumn": "נוצר ע\"י",
"claimAction": "שייך אליי",
"claimSuccess": "הילד/ה שויך/ה אליך בהצלחה"
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/he.json', 'utf8'))"
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/he.json
git commit -m "feat: add i18n keys for duplicate warning and claim action"
```

---

### Task 6: `ChildForm` duplicate-check UI

**Files:**

- Create: `src/components/childDuplicateWarning.ts`
- Create: `src/components/childDuplicateWarning.test.ts`
- Modify: `src/components/ChildForm.tsx`

**Interfaces:**

- Consumes: `childrenApi.findLocalDuplicateChildren`, `DuplicateChildMatch`, i18n keys.
- Produces: `ChildForm` prop `onDuplicateRedirect?: (childId: string) => void` — consumed by Task 7.

- [ ] **Step 1: Pure branching-logic helper + test**

```ts
// src/components/childDuplicateWarning.ts
import type { DuplicateChildMatch } from "../types";

export type DuplicateWarningDecision =
  | { kind: "none" }
  | { kind: "redirect"; childId: string }
  | { kind: "confirm"; match: DuplicateChildMatch };

export function decideDuplicateWarning(
  matches: DuplicateChildMatch[]
): DuplicateWarningDecision {
  const selfMatch = matches.find(m => m.createdByIsSelf);
  if (selfMatch) {
    return { kind: "redirect", childId: selfMatch.id };
  }
  if (matches.length > 0) {
    return { kind: "confirm", match: matches[0] };
  }
  return { kind: "none" };
}
```

```ts
// src/components/childDuplicateWarning.test.ts
import { describe, it, expect } from "vitest";
import { decideDuplicateWarning } from "./childDuplicateWarning";

describe("decideDuplicateWarning", () => {
  it("returns none when there are no matches", () => {
    expect(decideDuplicateWarning([])).toEqual({ kind: "none" });
  });

  it("returns redirect when the current user already created a match", () => {
    const matches = [
      {
        id: "c1",
        grade: 6,
        createdByUserId: "u1",
        createdByName: "Me",
        createdByIsSelf: true,
      },
    ];
    expect(decideDuplicateWarning(matches)).toEqual({
      kind: "redirect",
      childId: "c1",
    });
  });

  it("returns confirm when someone else created a match", () => {
    const matches = [
      {
        id: "c1",
        grade: 6,
        createdByUserId: "u2",
        createdByName: "Other",
        createdByIsSelf: false,
      },
    ];
    expect(decideDuplicateWarning(matches)).toEqual({
      kind: "confirm",
      match: matches[0],
    });
  });

  it("prefers redirect even if a self match is not first in the list", () => {
    const matches = [
      {
        id: "c1",
        grade: 6,
        createdByUserId: "u2",
        createdByName: "Other",
        createdByIsSelf: false,
      },
      {
        id: "c2",
        grade: 6,
        createdByUserId: "u1",
        createdByName: "Me",
        createdByIsSelf: true,
      },
    ];
    expect(decideDuplicateWarning(matches)).toEqual({
      kind: "redirect",
      childId: "c2",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/components/childDuplicateWarning.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Run the test to verify it passes**

```bash
npx vitest run src/components/childDuplicateWarning.test.ts
```

Expected: PASS (the implementation in Step 1 is already correct — this confirms it).

- [ ] **Step 4: Wire the check into `ChildForm`'s submit handler**

Read the current `ChildForm.tsx` submit handler first (`grep -n "onFinish\|handleSubmit\|onSubmit" src/components/ChildForm.tsx`) to match its exact current structure, then wrap it:

```tsx
// src/components/ChildForm.tsx
import { Modal } from "antd";
import { useTranslation } from "react-i18next";
import { childrenApi } from "../services/api";
import { decideDuplicateWarning } from "./childDuplicateWarning";

interface ChildFormProps {
  // ...existing props
  onDuplicateRedirect?: (childId: string) => void;
  excludeChildId?: string; // pass the child's own id when editing, so it doesn't flag itself
  currentUserId: string;
}

const handleFinish = async (values: {
  firstName: string;
  lastName: string;
  grade: number;
  groupNumber?: number;
  scope?: string;
}) => {
  const matches = await childrenApi.findLocalDuplicateChildren(
    values.firstName,
    values.lastName,
    values.grade,
    excludeChildId,
    currentUserId
  );
  const decision = decideDuplicateWarning(matches);

  if (decision.kind === "redirect") {
    Modal.info({
      title: t("child.duplicateWarning.title"),
      content: t("child.duplicateWarning.sameCreatorMessage"),
      okText: t("child.duplicateWarning.goToEdit"),
      onOk: () => onDuplicateRedirect?.(decision.childId),
    });
    return;
  }

  if (decision.kind === "confirm") {
    Modal.confirm({
      title: t("child.duplicateWarning.title"),
      content: t("child.duplicateWarning.existsMessage", {
        name: `${values.firstName} ${values.lastName}`,
        creator: decision.match.createdByName ?? "",
        grade: decision.match.grade,
      }),
      okText: t("child.duplicateWarning.continueAnyway"),
      cancelText: t("child.duplicateWarning.cancel"),
      onOk: () => onSubmit(values),
    });
    return;
  }

  await onSubmit(values);
};
```

Replace the `Form`'s existing `onFinish={onSubmit}` (or whatever the current wiring is — confirmed via the `grep` above) with `onFinish={handleFinish}`.

- [ ] **Step 5: Type-check and lint**

```bash
npx tsc --noEmit && npx eslint src/components/ChildForm.tsx src/components/childDuplicateWarning.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ChildForm.tsx src/components/childDuplicateWarning.ts src/components/childDuplicateWarning.test.ts
git commit -m "feat: block duplicate name+grade child creation with local check"
```

---

### Task 7: Wire callers, show creator name, add claim action

**Files:**

- Modify: `src/components/ChildManagement.tsx`
- Modify: `src/pages/StudentsPage.tsx`
- Modify: `src/components/AddChildButton.tsx`
- Modify: `src/components/StudentSearchSelector.tsx`
- Modify: `src/hooks/useAllChildren.ts` (creator name in the roster query)

**Interfaces:**

- Consumes: `onDuplicateRedirect` (Task 6), `childrenApi.claimChild` (Task 4), `Child.createdByName` (Task 3).

- [ ] **Step 1: Pass `currentUserId`, `excludeChildId`, `onDuplicateRedirect` from each `ChildForm` caller**

`ChildManagement.tsx`:

```tsx
<ChildForm
  // ...existing props
  currentUserId={currentUser.id}
  excludeChildId={editingChild?.id}
  onDuplicateRedirect={childId => {
    const match = children.find(c => c.id === childId);
    if (match) setEditingChild(match);
  }}
/>
```

`StudentsPage.tsx`:

```tsx
<ChildForm
  // ...existing props
  currentUserId={currentUser.id}
  excludeChildId={editingChild?.id}
  onDuplicateRedirect={childId => {
    const match = allChildren.find(c => c.id === childId);
    if (match) openEditModal(match);
  }}
/>
```

`AddChildButton.tsx` (no local edit UI — point the parent at Child Management instead):

```tsx
const { children } = useChildContext();

<ChildForm
  // ...existing props
  currentUserId={currentUser.id}
  onDuplicateRedirect={() => {
    setModalOpen(false);
    message.info(t("child.duplicateWarning.sameCreatorMessage"));
  }}
/>;
```

Use `grep -rn "currentUser\|useAuth" src/components/ChildManagement.tsx src/pages/StudentsPage.tsx src/components/AddChildButton.tsx` first to find this app's actual current-user accessor — the snippets above assume a `currentUser` object is already available; adjust to match.

- [ ] **Step 2: Same duplicate check in `StudentSearchSelector.tsx`'s direct-create path**

```tsx
const handleCreateStudent = async (
  firstName: string,
  lastName: string,
  grade: number,
  groupNumber?: number
) => {
  const matches = await childrenApi.findLocalDuplicateChildren(
    firstName,
    lastName,
    grade,
    undefined,
    currentUser.id
  );
  const decision = decideDuplicateWarning(matches);

  if (decision.kind === "redirect") {
    Modal.info({
      title: t("child.duplicateWarning.title"),
      content: t("child.duplicateWarning.sameCreatorMessage"),
    });
    return;
  }

  if (decision.kind === "confirm") {
    Modal.confirm({
      title: t("child.duplicateWarning.title"),
      content: t("child.duplicateWarning.existsMessage", {
        name: `${firstName} ${lastName}`,
        creator: decision.match.createdByName ?? "",
        grade: decision.match.grade,
      }),
      okText: t("child.duplicateWarning.continueAnyway"),
      cancelText: t("child.duplicateWarning.cancel"),
      onOk: () => createStudentNow(firstName, lastName, grade, groupNumber),
    });
    return;
  }

  await createStudentNow(firstName, lastName, grade, groupNumber);
};
```

Rename the existing body of `handleCreateStudent` (the part that actually calls `childrenApi.createChild(...)` and does `window.location.reload()`) to a new `createStudentNow` function so it can be called either directly or from the confirm dialog's `onOk`.

- [ ] **Step 3: Show "created by" in the roster table**

In `useAllChildren.ts`, extend the query to select the joined creator name (same shape as Task 4's local-duplicate query), and add a column to the `StudentsPage.tsx` table:

```tsx
{
  title: t("students.page.createdByColumn"),
  dataIndex: "createdByName",
  key: "createdByName",
  render: (name: string | null) => name ?? "—",
}
```

- [ ] **Step 4: Add a "claim" action for unclaimed staff-created children on `StudentsPage`**

In the row-actions dropdown (where "Edit" already lives per prior investigation), add a conditional item shown only when the record has no parent yet (requires the roster query to also expose whether a child has any `parent_child_relationships` row — check `useAllChildren.ts`'s existing query; if it doesn't already return this, extend it to select a `has_parent: boolean` alongside the existing fields):

```tsx
{
  isCurrentUserParent && !record.hasParent && (
    <Menu.Item
      key="claim"
      onClick={async () => {
        try {
          await childrenApi.claimChild(record.id);
          message.success(t("students.page.claimSuccess"));
          refetch();
        } catch (err) {
          message.error((err as Error).message);
        }
      }}>
      {t("students.page.claimAction")}
    </Menu.Item>
  );
}
```

- [ ] **Step 5: Type-check the whole project**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Manual smoke test**

Run the dev server (`npm run dev` or the project's documented script) and walk through:

1. As a parent, add a child whose name+grade matches an existing one created by someone else → confirm dialog appears with the exact `<NAME>`/`<CREATOR>`/grade text → "continue anyway" creates it.
2. As the same parent, try adding the same name+grade again → redirected to edit instead of a second confirm.
3. As staff, add a child on `/students` → confirm no row appears in `parent_child_relationships` for that staff user (re-run the Task 2 Step 3 verification query).
4. As a parent, claim an unclaimed staff-created child → relationship appears, "claim" action disappears for that row.

- [ ] **Step 7: Commit**

```bash
git add src/components/ChildManagement.tsx src/components/AddChildButton.tsx src/pages/StudentsPage.tsx src/components/StudentSearchSelector.tsx src/hooks/useAllChildren.ts src/locales/he.json
git commit -m "feat: wire duplicate-check, creator display, and claim action into UI"
```

---

## Self-Review Notes

- **Spec coverage:** staff/admin no longer auto-linked going forward (Task 2 step 2's RPC change); existing bad links cleaned up (Task 2 step 2's `DELETE`); `created_by` provenance backfilled unconditionally and surfaced in the UI (Task 2 step 2's `UPDATE`, Task 3, Task 7 step 3); claim flow restricted to staff-created + unclaimed (Task 2's `claim_child` guard); duplicate-name+grade blocker as a local/client-side check, both flows, exact copy, redirect-to-edit for the same-creator case (Tasks 5–7).
- **Scope change from the previous revision:** dropped the dedicated `find_duplicate_children` SECURITY DEFINER RPC in favor of a plain client-side `.from("children")` query (Task 4) — per direction, duplicates are low-volume (≤5) and fixable by hand, so a full cross-role backend lookup isn't worth building; coverage is whatever's visible under existing RLS to the caller.
- **Commit granularity:** one commit per task instead of one per step, per direction; Task 1 (branch creation) has no commit of its own.
- **Type consistency:** `DuplicateChildMatch` fields (`id`, `grade`, `createdByUserId`, `createdByName`, `createdByIsSelf`) are identical across Task 3's definition, Task 4's mapping code and tests, and Task 6/7's usage.
