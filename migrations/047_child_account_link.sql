-- Migration: 047_child_account_link
-- Description: Let a student log in and pick classes for themselves.
--   - children.user_id links a login (a user with the approved, exclusive
--     `child` role) to one children row. The admin sets it at approval via
--     approve_child_account(); nothing else writes it.
--   - A trigger (guard_children_user_id) blocks setting user_id through
--     direct client writes: only the admin RPCs below can link an account.
--   - my_linked_child_id() returns the caller's linked student, and only
--     while they hold an approved `child` role. Every new policy keys off it,
--     so none of them match anyone until an admin links an account.
--   - RLS for a child user mirrors a parent's, scoped to their own student:
--     read their own children row, manage their own draft selections, read
--     their committed selections (035) and their overrides (037). No direct
--     INSERT/UPDATE/DELETE on children; track changes go through
--     set_own_track_draft().
--   - Drops the "Child role can manage own selections" policy and the
--     schedule_selections_user_class_key partial index from 022. Both key on
--     child_id IS NULL, which can't happen since child_id became NOT NULL
--     (014 / #65), so they have done nothing since. No upsert names that
--     index (src/services/api.ts has no onConflict).
--   - approve_child_account() / unlink_child_account(): admin-only RPCs that
--     grant or revoke the child role together with the student link, in one
--     transaction.
--
--   Safe to apply before the app code that uses it: the new column is
--   nullable and unread until then, and no account is linked until an admin
--   calls approve_child_account().
-- Author: System
-- Date: 2026-09-30
-- Depends on: 045_lock_down_user_roles_self_insert (a user can self-request
--   `child`) and 046_drop_open_children_insert (#188).

BEGIN;

-- 1) The link. UNIQUE: one login per student, one student per login.
--    ON DELETE SET NULL: deleting the user keeps the student record.
ALTER TABLE public.children
    ADD COLUMN user_id uuid UNIQUE REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.children.user_id IS
    'The login linked to this student (a user with the approved child role). Set by approve_child_account(); NULL for students without an account.';

-- 1b) Only the RPCs below set the link. Existing policies let parents,
--     staff and admins UPDATE children, which would otherwise let e.g. a
--     parent link their child to an arbitrary account. INSERT is guarded too,
--     in case a direct-insert policy comes back (046 dropped the open one).
--     Direct client writes run as `authenticated`; the SECURITY DEFINER RPCs
--     run as the function owner, so current_user tells them apart. Clearing
--     the link (NULL) stays allowed, which also covers ON DELETE SET NULL.
CREATE OR REPLACE FUNCTION public.guard_children_user_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.user_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.user_id IS DISTINCT FROM OLD.user_id)
       AND current_user IN ('authenticated', 'anon') THEN
        RAISE EXCEPTION 'children.user_id can only be set by approve_child_account';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_children_user_id() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_children_user_id
    BEFORE INSERT OR UPDATE OF user_id ON public.children
    FOR EACH ROW EXECUTE FUNCTION public.guard_children_user_id();

-- 2) The caller's linked student, or NULL. SECURITY DEFINER so policies on
--    children can call it without recursing into children's own RLS.
CREATE OR REPLACE FUNCTION public.my_linked_child_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT c.id
    FROM public.children c
    WHERE c.user_id = auth.uid()
      AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = 'child'
            AND ur.approved = true
      );
$$;

REVOKE EXECUTE ON FUNCTION public.my_linked_child_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_linked_child_id() TO authenticated;

-- 3) children: a child user reads their own record only. (SELECT ...) lets
--    the planner evaluate the function once per query, not once per row.
CREATE POLICY "Child users can view own record" ON public.children
    FOR SELECT
    TO authenticated
    USING (id = (SELECT public.my_linked_child_id()));

-- 4) schedule_selections.
DROP POLICY IF EXISTS "Child role can manage own selections" ON public.schedule_selections;
DROP INDEX IF EXISTS public.schedule_selections_user_class_key;

-- Same shape as "Parents can manage own children draft selections" (022):
-- own rows, draft only, own student only.
CREATE POLICY "Child users manage own draft selections" ON public.schedule_selections
    FOR ALL
    TO authenticated
    USING (
        user_id = auth.uid() AND
        status = 'draft' AND
        child_id = (SELECT public.my_linked_child_id())
    )
    WITH CHECK (
        user_id = auth.uid() AND
        status = 'draft' AND
        child_id = (SELECT public.my_linked_child_id())
    );

-- Mirrors "Parents can view own children committed selections" (035).
CREATE POLICY "Child users view own committed selections" ON public.schedule_selections
    FOR SELECT
    TO authenticated
    USING (
        status = 'committed' AND
        child_id = (SELECT public.my_linked_child_id())
    );

-- 5) schedule_overrides: mirrors "Parents can view own children schedule
--    overrides" (037).
CREATE POLICY "Child users view own schedule overrides" ON public.schedule_overrides
    FOR SELECT
    TO authenticated
    USING (child_id = (SELECT public.my_linked_child_id()));

-- 6) Admin: approve (or grant) the child role and link the student in one
--    step. Pass p_child_id to link an existing student, or the name/grade
--    fields (and no p_child_id) to create one.
CREATE OR REPLACE FUNCTION public.approve_child_account(
    p_user_id uuid,
    p_child_id uuid DEFAULT NULL,
    p_first_name text DEFAULT NULL,
    p_last_name text DEFAULT NULL,
    p_grade integer DEFAULT NULL,
    p_group_number integer DEFAULT 1,
    p_scope text DEFAULT 'prod'
)
RETURNS children
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    linked children;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only admins can approve child accounts';
    END IF;

    -- child is exclusive: no other approved role may remain.
    IF EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND approved = true AND role <> 'child'
    ) THEN
        RAISE EXCEPTION 'User holds another approved role; child cannot be combined with other roles';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.children
        WHERE user_id = p_user_id
          AND (p_child_id IS NULL OR id <> p_child_id)
    ) THEN
        RAISE EXCEPTION 'User is already linked to another student';
    END IF;

    IF p_child_id IS NOT NULL THEN
        UPDATE public.children
        SET user_id = p_user_id, updated_at = now()
        WHERE id = p_child_id
          AND (user_id IS NULL OR user_id = p_user_id)
        RETURNING * INTO linked;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Student not found or already linked to another account';
        END IF;
    ELSE
        IF p_first_name IS NULL OR p_last_name IS NULL OR p_grade IS NULL THEN
            RAISE EXCEPTION 'Pass either p_child_id or the new student''s name and grade';
        END IF;

        INSERT INTO public.children (
            first_name, last_name, grade, group_number, scope, created_by, user_id
        )
        VALUES (
            p_first_name, p_last_name, p_grade, p_group_number, p_scope,
            auth.uid(), p_user_id
        )
        RETURNING * INTO linked;
    END IF;

    -- Replace any pending requests with the approved child role.
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id AND approved = false;

    INSERT INTO public.user_roles (user_id, role, approved)
    VALUES (p_user_id, 'child', true)
    ON CONFLICT (user_id, role) DO UPDATE SET approved = true;

    RETURN linked;
END;
$$;

-- 7) Admin: revoke the child role and clear the student link together.
CREATE OR REPLACE FUNCTION public.unlink_child_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only admins can unlink child accounts';
    END IF;

    UPDATE public.children
    SET user_id = NULL, updated_at = now()
    WHERE user_id = p_user_id;

    DELETE FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'child';
END;
$$;

-- 8) Child user: set their own draft track. Caller-scoped instead of an
--    UPDATE policy on children, so a child can change nothing else.
CREATE OR REPLACE FUNCTION public.set_own_track_draft(p_track_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    own_child_id uuid := public.my_linked_child_id();
BEGIN
    IF own_child_id IS NULL THEN
        RAISE EXCEPTION 'No linked student for this account';
    END IF;

    UPDATE public.children
    SET track_number_draft = p_track_number, updated_at = now()
    WHERE id = own_child_id;
END;
$$;

-- Same hardening as 042: no anon/PUBLIC EXECUTE, authenticated only.
REVOKE EXECUTE ON FUNCTION public.approve_child_account(uuid, uuid, text, text, integer, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unlink_child_account(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_own_track_draft(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_child_account(uuid, uuid, text, text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_child_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_own_track_draft(integer) TO authenticated;

COMMIT;
