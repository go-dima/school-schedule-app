-- Migration: 021_add_selection_status
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
--
-- OPERATOR NOTE -- read before applying: every existing schedule_selections
-- row (including the child-linked rows every current student's schedule is
-- built from) defaults to status = 'draft' on this migration -- there is no
-- backfill to 'committed', per an explicit spec decision that nothing in
-- existing data is worth preserving as authoritative. The moment this lands:
--   - get_class_enrollment_counts / get_class_enrollment_count /
--     classes_with_enrollment (which now only count status = 'committed')
--     will show 0 enrollment for every class, everywhere they're displayed
--     (including to parents browsing classes), until staff re-commits picks.
--   - Staff/admin will see an empty schedule for every child until they
--     independently commit selections for them.
-- This is expected per the spec, not a bug -- but it is a visible,
-- immediate change in what staff/parents see, so time applying this
-- accordingly (e.g. alongside a staff-facing heads-up), not as a silent
-- background migration.

BEGIN;

-- Step 0: Pre-flight check. The constraint being dropped in Step 2 is keyed
-- on user_id, so under the old RLS policies (013_add_children_management)
-- two different co-parents of the same child could each have inserted a row
-- for the same (child_id, class_id) -- both permitted by the old "manage
-- their own schedule selections" policy. If any such duplicate exists, the
-- new partial unique index below will fail to create, aborting the entire
-- migration with a much less obvious error. Fail fast here instead, with a
-- message that tells the operator exactly what to dedupe.
DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dup_count
    FROM (
        SELECT child_id, class_id
        FROM public.schedule_selections
        WHERE child_id IS NOT NULL
        GROUP BY child_id, class_id
        HAVING COUNT(*) > 1
    ) dupes;

    IF dup_count > 0 THEN
        RAISE EXCEPTION
            'Found % (child_id, class_id) pair(s) with more than one schedule_selections row. '
            'The new unique index requires at most one row per (child_id, class_id, status). '
            'Run: SELECT child_id, class_id, count(*) FROM public.schedule_selections '
            'WHERE child_id IS NOT NULL GROUP BY child_id, class_id HAVING count(*) > 1; '
            'and dedupe before re-running this migration.',
            dup_count;
    END IF;
END $$;

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
    DROP CONSTRAINT IF EXISTS schedule_selections_user_id_class_id_key;

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
    FOR ALL USING (auth.uid() = user_id AND child_id IS NULL AND status = 'draft');

-- 3b. Parents: can only ever read or write their own children's draft rows.
-- They can never read or write a committed row -- enforced here, not just
-- hidden in the UI.
--
-- Known, accepted limitation: the user_id = auth.uid() clause below means a
-- second parent linked to the same child (parent_child_relationships
-- supports more than one) cannot edit/delete a draft row the first parent
-- created for that child -- unlike the prior policy (013_add_children_
-- management), which used user_id = auth.uid() OR child_id IN (...) and so
-- let any linked parent manage any of that child's rows. Tightened here to
-- close a user_id-spoofing gap on insert; multi-parent co-editing of the
-- same draft is not a current requirement, so this was left as-is rather
-- than split into a narrower WITH CHECK. Revisit if co-parent editing of a
-- shared child's draft becomes a real requirement.
CREATE POLICY "Parents can manage own children draft selections" ON public.schedule_selections
    FOR ALL USING (
        user_id = auth.uid() AND
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

-- classes_with_enrollment selects `c.*`, which Postgres expands and freezes
-- at CREATE VIEW time. 018_add_group_and_track_fields added
-- group_number/track_number to public.classes without recreating this view,
-- so a plain CREATE OR REPLACE VIEW here would re-expand c.* with those
-- columns inserted before enrollment_count -- which Postgres rejects as an
-- illegal column rename (CREATE OR REPLACE VIEW only allows new columns to
-- be appended at the very end). 017_add_class_slots.sql hit this exact trap
-- and fixed it the same way: drop and recreate instead.
DROP VIEW IF EXISTS public.classes_with_enrollment;

CREATE VIEW public.classes_with_enrollment AS
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

GRANT SELECT ON public.classes_with_enrollment TO authenticated;
COMMENT ON VIEW public.classes_with_enrollment IS 'View of classes with their current enrollment counts';

COMMIT;
