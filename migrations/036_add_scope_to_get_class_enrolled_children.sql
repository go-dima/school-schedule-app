-- Migration: 036_add_scope_to_get_class_enrolled_children
-- Description: Issue #134 found that get_class_enrolled_children
--   (024_add_get_class_enrolled_children.sql) has no scope filter at all --
--   it joins children to committed_enrollments for one p_class_id and
--   returns every enrolled child regardless of children.scope. That
--   migration's own header reasoned no target_scope was needed because
--   p_class_id pins the caller to one class with exactly one scope -- true
--   for classes.scope, but children.scope is independent (007 vs 015: two
--   separate scope columns, one enum, one plain text with a CHECK
--   constraint), so a test-scope child can be enrolled in a prod-scope
--   class and leak into that class's production roster. Adds a
--   target_scope text[] parameter, mirroring the target_scope pattern
--   already used by get_class_enrollment_count(s), except as an array
--   (rather than a single class_scope enum value) since children.scope is
--   plain text and the app-layer caller (scheduleApi.getClassEnrolledChildren)
--   needs to pass the full getAllowedScopes() list, not one value.
-- Author: System
-- Date: 2026-09-16

BEGIN;

-- CREATE OR REPLACE with a new parameter list creates a second overload
-- rather than replacing the existing one-arg function -- drop it first.
DROP FUNCTION IF EXISTS public.get_class_enrolled_children(uuid);

CREATE OR REPLACE FUNCTION public.get_class_enrolled_children(
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
    WHERE ce.class_id = p_class_id
    AND (target_scope IS NULL OR c.scope = ANY(target_scope));
END;
$$;

REVOKE ALL ON FUNCTION public.get_class_enrolled_children(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_class_enrolled_children(uuid, text[]) TO authenticated;

COMMIT;
