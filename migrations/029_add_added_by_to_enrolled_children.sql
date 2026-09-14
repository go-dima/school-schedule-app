-- Migration: 029_add_added_by_to_enrolled_children
-- Description: Issue #110 -- surface who committed a child's class
--   selection (and when) in the Class Management enrollment roster drawer.
--   schedule_selections.user_id (NOT NULL) and created_at already record
--   this for every row, including committed ones (see selectSchedule in
--   src/services/api.ts and migrations 001/022/023) -- no new column or
--   write-path change is needed, this only exposes existing data through
--   get_class_enrolled_children.
--
--   committed_enrollments gains ss.user_id and ss.created_at. It remains
--   revoked from anon/authenticated (027_lock_down_enrollment_views_and_
--   child_creation) and is only ever queried from inside SECURITY DEFINER
--   functions, so widening its columns carries no exposure risk.
--
--   get_class_enrolled_children's RETURNS TABLE shape changes (four new
--   trailing columns), which CREATE OR REPLACE cannot do -- so this is a
--   DROP FUNCTION + CREATE FUNCTION. DROP FUNCTION strips all grants, and
--   Postgres' default for a freshly created function is EXECUTE granted to
--   PUBLIC -- exactly the grant regression 027 had to fix for
--   committed_enrollments itself. To avoid repeating that mistake, the
--   REVOKE/GRANT pair is reissued immediately after CREATE FUNCTION, inside
--   this same transaction.
--
--   The committer's name requires this SECURITY DEFINER path rather than a
--   client-side join: staff can SELECT all schedule_selections rows
--   directly ("Staff and admins can view all selections",
--   022_add_selection_status), but cannot read other users' rows in
--   public.users directly -- that table only allows auth.uid() = id or an
--   admin via is_admin() (migrations 002, 011).
--
--   RETURN QUERY matches RETURNS TABLE by position, not name (see 024's own
--   note re: track_number/track_number_committed) -- the SELECT list below
--   is written in the same order as the RETURNS TABLE declaration to keep
--   that mapping easy to verify by eye.
-- Author: System
-- Date: 2026-09-14

BEGIN;

CREATE OR REPLACE VIEW public.committed_enrollments AS
SELECT ss.class_id, ss.child_id, ss.user_id, ss.created_at
FROM public.schedule_selections ss
WHERE ss.child_id IS NOT NULL AND ss.status = 'committed';

DROP FUNCTION public.get_class_enrolled_children(uuid);

CREATE FUNCTION public.get_class_enrolled_children(p_class_id uuid)
RETURNS TABLE (
    id uuid,
    first_name text,
    last_name text,
    grade integer,
    group_number integer,
    track_number integer,
    scope text,
    created_at timestamptz,
    updated_at timestamptz,
    added_by_user_id uuid,
    added_by_first_name text,
    added_by_last_name text,
    added_by_at timestamptz
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
        c.updated_at,
        ce.user_id,
        u.first_name,
        u.last_name,
        ce.created_at
    FROM public.children c
    INNER JOIN public.committed_enrollments ce ON ce.child_id = c.id
    INNER JOIN public.users u ON u.id = ce.user_id
    WHERE ce.class_id = p_class_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_class_enrolled_children(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_class_enrolled_children(uuid) TO authenticated;

COMMIT;
