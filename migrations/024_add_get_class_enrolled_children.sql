-- Migration: 024_add_get_class_enrolled_children
-- Description: Introduces committed_enrollments as the single source of
--   truth for "what counts as enrolled" (child_id IS NOT NULL AND
--   status = 'committed'), and rewrites get_class_enrollment_counts,
--   get_class_enrollment_count, and classes_with_enrollment -- which had
--   all three independently duplicated that predicate, most recently in
--   022_add_selection_status -- to read from it instead. Also adds a new
--   get_class_enrolled_children(p_class_id) function for the Class
--   Management enrollment drawer, built on the same view so its roster can
--   never drift from what the count functions report.
--
--   committed_enrollments is a plain (non security_invoker) view, so like
--   any such view it runs with its owner's privileges -- including bypassing
--   RLS on schedule_selections, the same way the SECURITY DEFINER functions
--   below already do directly. This is deliberate and is exactly why it
--   must NEVER be granted SELECT to authenticated/anon: doing so would let
--   any signed-in user read every class's full enrollment roster (child_id,
--   class_id pairs) directly through PostgREST, bypassing RLS entirely. It
--   exists only as an internal building block queried from inside the
--   SECURITY DEFINER functions in this file, which each enforce their own
--   access control before touching it.
--
--   Querying public.children directly for the roster cannot work: the
--   table's only SELECT RLS policy (013_add_children_management) scopes
--   rows to the caller's own children via parent_child_relationships, so a
--   staff/admin caller embedding children(*) through PostgREST gets
--   `child: null` on every row. get_class_enrolled_children mirrors
--   get_children_with_parent_status (018_add_group_and_track_fields,
--   hardened in 020_fix_children_roster_permissions) structurally, but
--   unlike that function -- which is safe to expose broadly because it
--   doesn't disclose anything a parent can't already infer -- this one
--   returns other people's children's names, so it enforces its own
--   admin/staff+approved check internally (mirroring the staff SELECT
--   policy on schedule_selections from 022_add_selection_status, and the
--   equivalent check 020_fix_children_roster_permissions added to
--   get_children_with_parent_status) rather than relying on grants alone.
--
--   No target_scope parameter on get_class_enrolled_children, unlike the
--   count functions below: p_class_id already pins the caller to one class,
--   which has exactly one scope, so there's nothing for a separate scope
--   filter to disambiguate (contrast with get_class_enrollment_counts,
--   which aggregates across every class and needs target_scope to know
--   which ones to include).
-- Author: System
-- Date: 2026-09-09

BEGIN;

-- Step 1: single source of truth for "what counts as enrolled". See the
-- header above for why this must not be granted to authenticated/anon.
CREATE OR REPLACE VIEW public.committed_enrollments AS
SELECT ss.class_id, ss.child_id
FROM public.schedule_selections ss
WHERE ss.child_id IS NOT NULL AND ss.status = 'committed';

-- Step 2: rewrite the two count functions to read from it instead of
-- duplicating the predicate. Signatures and return types are unchanged
-- from 022_add_selection_status, so existing grants on these functions
-- carry over automatically -- CREATE OR REPLACE FUNCTION does not reset
-- them the way DROP+CREATE would.
CREATE OR REPLACE FUNCTION public.get_class_enrollment_counts(target_scope class_scope DEFAULT NULL)
RETURNS TABLE (class_id UUID, enrollment_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as class_id,
        COALESCE(enrollment_data.count, 0) as enrollment_count
    FROM public.classes c
    LEFT JOIN (
        SELECT ce.class_id, COUNT(*) as count
        FROM public.committed_enrollments ce
        GROUP BY ce.class_id
    ) enrollment_data ON c.id = enrollment_data.class_id
    WHERE (target_scope IS NULL OR c.scope = target_scope);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_class_enrollment_count(p_class_id UUID, target_scope class_scope DEFAULT NULL)
RETURNS BIGINT AS $$
DECLARE
    count_result BIGINT;
BEGIN
    SELECT COUNT(*) INTO count_result
    FROM public.committed_enrollments ce
    INNER JOIN public.classes c ON ce.class_id = c.id
    WHERE
        ce.class_id = p_class_id
        AND (target_scope IS NULL OR c.scope = target_scope);

    RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: classes_with_enrollment selects c.*, which Postgres expands and
-- freezes at CREATE VIEW time (same trap documented in
-- 017_add_class_slots.sql and 022_add_selection_status.sql) -- drop and
-- recreate rather than CREATE OR REPLACE.
DROP VIEW IF EXISTS public.classes_with_enrollment;

CREATE VIEW public.classes_with_enrollment AS
SELECT
    c.*,
    COALESCE(enrollment_data.enrollment_count, 0) as enrollment_count
FROM public.classes c
LEFT JOIN (
    SELECT ce.class_id, COUNT(*) as enrollment_count
    FROM public.committed_enrollments ce
    GROUP BY ce.class_id
) enrollment_data ON c.id = enrollment_data.class_id;

GRANT SELECT ON public.classes_with_enrollment TO authenticated;
COMMENT ON VIEW public.classes_with_enrollment IS 'View of classes with their current enrollment counts';

-- Step 4: the roster function. Note the SELECT list's 6th column is
-- c.track_number_committed, sourced from the split introduced in
-- 023_split_track_draft_committed, while the function's own output column
-- (from RETURNS TABLE below) is named track_number -- RETURN QUERY matches
-- by position, not name, so callers keep seeing a plain "track_number"
-- field regardless of which underlying column fed it. This roster is
-- staff-only by construction (see the role check below), so it always shows
-- the committed track, never the draft one.
CREATE OR REPLACE FUNCTION public.get_class_enrolled_children(p_class_id uuid)
RETURNS TABLE (
    id uuid,
    first_name text,
    last_name text,
    grade integer,
    group_number integer,
    track_number integer,
    scope text,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'staff')
        AND ur.approved = true
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.grade,
        c.group_number,
        c.track_number_committed,
        c.scope,
        c.created_at,
        c.updated_at
    FROM public.children c
    INNER JOIN public.committed_enrollments ce ON ce.child_id = c.id
    WHERE ce.class_id = p_class_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_class_enrolled_children(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_class_enrolled_children(uuid) TO authenticated;

COMMIT;
