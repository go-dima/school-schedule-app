-- Migration: 039_restore_added_by_with_scope
-- Description: Issue #147 -- 038_add_scope_to_get_class_enrolled_children.sql
--   (target_scope filter, #134) had to DROP FUNCTION + CREATE FUNCTION to
--   change get_class_enrolled_children's signature, and re-declared
--   RETURNS TABLE/SELECT from 024's original shape instead of 030's,
--   silently dropping the four added_by_* columns and the public.users
--   join that 030 (#110) added. This left the Class Management enrollment
--   drawer's "added by" tooltip showing "Invalid Date / unknown user" for
--   every class, even though the underlying data was never touched --
--   committed_enrollments (030's view over schedule_selections.user_id/
--   created_at) was untouched by 038. This migration restores 030's
--   added_by_* columns/join on top of 038's target_scope parameter/filter;
--   no frontend changes are needed since src/services/api.ts and
--   EnrolledChild (src/types/index.ts) already expect these fields.
-- Author: System
-- Date: 2026-09-18

BEGIN;

DROP FUNCTION IF EXISTS public.get_class_enrolled_children(uuid, text[]);

CREATE FUNCTION public.get_class_enrolled_children(
    p_class_id uuid,
    target_scope text[] DEFAULT NULL
)
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
    WHERE ce.class_id = p_class_id
    AND (target_scope IS NULL OR c.scope = ANY(target_scope));
END;
$$;

REVOKE ALL ON FUNCTION public.get_class_enrolled_children(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_class_enrolled_children(uuid, text[]) TO authenticated;

COMMIT;
