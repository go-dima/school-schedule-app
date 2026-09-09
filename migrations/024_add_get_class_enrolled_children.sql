-- Migration: 020_add_get_class_enrolled_children
-- Description: Add a SECURITY DEFINER function returning the roster of
--   children committed-enrolled in a given class, for the Class Management
--   enrollment drawer. Querying public.children directly for this cannot
--   work: the table's only SELECT RLS policy (013_add_children_management)
--   scopes rows to the caller's own children via parent_child_relationships,
--   so a staff/admin caller embedding children(*) through PostgREST gets
--   `child: null` on every row. This mirrors get_children_with_parent_status
--   (018_add_group_and_track_fields) structurally, but unlike that function
--   -- which is safe to expose broadly because it doesn't disclose anything
--   a parent can't already infer -- this one returns other people's
--   children's names, so it enforces its own admin/staff+approved check
--   internally (mirroring the staff SELECT policy on schedule_selections
--   from 019_add_selection_status) rather than relying on grants alone.
--   Filters exactly match get_class_enrollment_count's WHERE clause so the
--   displayed count and the roster can never diverge.
-- Author: System
-- Date: 2026-09-09

BEGIN;

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
        c.track_number,
        c.scope,
        c.created_at,
        c.updated_at
    FROM public.children c
    INNER JOIN public.schedule_selections ss ON ss.child_id = c.id
    WHERE
        ss.class_id = p_class_id
        AND ss.status = 'committed'
        AND ss.child_id IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_enrolled_children(uuid) TO authenticated;

COMMIT;
