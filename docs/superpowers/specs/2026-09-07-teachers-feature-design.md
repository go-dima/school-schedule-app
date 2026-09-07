# Teachers feature — design

Date: 2026-09-07
Status: Approved (design), not yet implemented

## Problem

Classes currently store a teacher as a free-text string (`classes.teacher`).
There's no way to reuse a teacher across classes, manage teachers as a list,
or (eventually) link a teacher to children they teach. Admins need a
`Teachers` entity: name-based records, assignable to classes, manageable from
a dedicated admin page, and optionally linked to a login (`users`) account.

## Goals

- A `teachers` table: first name, last name, optional email, optional link
  to a `users` row (for teachers who log in).
- Classes reference a teacher via `teacher_id` (FK), chosen from a searchable
  list or created inline, when creating/editing a class.
- A `Teachers` admin page (sidebar-linked) to list/add/edit/delete teachers
  and to link/unlink a teacher to a user account.
- Existing `classes.teacher` free-text values are left as-is (fallback
  display only) — no backfill, no forced migration of historical data.

## Explicit non-goals (deferred)

- Teacher ↔ children relationship (a separate, future feature).
- Any new role or auto-granted permissions from linking a teacher to a user
  (linking is a pure identity association; `staff` role assignment stays a
  separate admin action via the existing approval flow).
- A teacher-specific "my classes" view.
- Migrating/backfilling existing free-text `teacher` values into the new
  table.

## Data model

New migration (next in sequence, `017_add_teachers.sql`), following the
`013_add_children_management.sql` template — plain table + RLS policies
matching the `classes` pattern (public read, admin/staff write):

```sql
CREATE TABLE public.teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,                                    -- optional
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- optional, identity link only
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX teachers_user_id_key ON public.teachers(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.classes ADD COLUMN teacher_id UUID REFERENCES public.teachers(id);

CREATE POLICY "Everyone can view teachers" ON public.teachers FOR SELECT USING (true);
CREATE POLICY "Staff and admins can manage teachers" ON public.teachers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'staff')));
```

`classes.teacher` (TEXT) is untouched. New/edited classes populate
`teacher_id`; rows that still only have the old text field keep showing it
as a fallback until someone edits them.

The unique partial index on `teachers.user_id` enforces one teacher record
per user account.

## Service layer

`teachersApi` in `src/services/api.ts`, modeled on the existing
`timeSlotsApi` (simple-entity CRUD template):

- `getTeachers(): Promise<Teacher[]>`
- `createTeacher(teacher: Omit<Teacher, "id" | "createdAt" | "updatedAt">)`
- `updateTeacher(id: string, updates: Partial<Omit<Teacher, ...>>)`
- `deleteTeacher(id: string)`
- `linkTeacherToUser(teacherId: string, userId: string)`
- `unlinkTeacherFromUser(teacherId: string)`

`classesApi.createClass` / `updateClass` gain `teacherId` in their
insert/update payloads (same pattern as the existing `timeSlotId` FK wiring).

## Types (`src/types/index.ts`)

- New `Teacher { id: string; firstName: string; lastName: string; email?: string; userId?: string }`.
- `Class` keeps `teacher: string` (fallback display) and gains
  `teacherId?: string`.
- New `ClassWithTeacher` extension, mirroring the existing
  `ClassWithTimeSlot` pattern.

## UI

### Class form (`src/components/ClassForm.tsx`)

Replace the free-text `Input` at `teacher` (lines ~124–134) with a new
`TeacherSelector` component (patterned on `ScopeSelector.tsx`): an antd
`Select` with `showSearch` over existing teachers, plus antd's built-in
"add new option" affordance to inline-create a teacher (first + last name
only — email and user-linking are admin-page-only, not part of quick-add).

### Teachers admin page (`src/pages/TeachersPage.tsx`)

Structural copy of `ClassManagementPage.tsx`:

- Permission-gated (`canManageClasses()` — admin or staff) with an early
  `Alert` return if unauthorized.
- `Table` of teachers: name, email, linked-user status; row actions for
  edit/delete.
- `Modal` + form for add/edit (first name, last name, email).
- Within the edit modal, a "Link to user" control: searchable `Select` over
  `users` (by email/name), plus an "Unlink" action when already linked. The
  search covers all users regardless of signup order, so it supports both
  flows (teacher record created first, then linked to a user who signs up
  later; or a user exists first and is linked to a newly created teacher
  record).

### Navigation

- Add `"teachers"` to the `Page` union type in both `src/App.tsx` and
  `src/layouts/Sidebar.tsx`.
- Add a `case "teachers": return <TeachersPage />;` in `App.tsx`'s
  `renderPage()`.
- Add a sidebar `Menu` item, gated the same way as `class-management`
  (`canManageClasses()`, hidden via `style={{ display: "none" }}` when
  unauthorized, per the existing pattern rather than omitted from the array).

## Permissions

Managing teachers (CRUD + linking) uses the existing `canManageClasses()`
check (`admin` or `staff`) — same tier as class management, for consistency
with the fact that staff already manage classes.

## Testing

- Unit tests for `teachersApi` methods (mocked Supabase client), following
  existing service-layer test patterns.
- Unit tests for `TeacherSelector`'s inline-create flow.
- Manual verification: create a class picking an existing teacher; create a
  class inline-creating a new teacher; edit a teacher's name and confirm it
  reflects on already-assigned classes; link/unlink a teacher to a user from
  the Teachers page; confirm sidebar/permission gating matches class
  management for both admin and staff test accounts.
