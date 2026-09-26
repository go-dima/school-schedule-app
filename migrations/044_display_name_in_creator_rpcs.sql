-- Migration: 044_display_name_in_creator_rpcs
-- Description: Issue #163 (Staff View part 2) -- name staff by their Display
--   Name (043's users.display_name) wherever the app says who created or
--   added a child, falling back to first + last name as before:
--     - get_children_with_parent_status (Students page "created by" column;
--       last defined in 032) gains creator_display_name
--     - get_class_enrolled_children (class drawer "added by" tooltip; last
--       defined in 039) gains added_by_display_name
--   Both bodies are otherwise copied unchanged from 032 / 039. The new
--   column is appended LAST in each RETURNS TABLE, because RETURN QUERY maps
--   by position (see 030's note). Changing RETURNS TABLE needs DROP +
--   CREATE, so REVOKE/GRANT are reissued in the same transaction (039
--   pattern).
--   Safe in either deploy order: the client treats a missing
--   *_display_name as "no display name" and falls back.
-- Author: System
-- Date: 2026-09-26
--
-- NOTE: Run manually (Supabase SQL editor / psql), after 043.

BEGIN;

-- 1. Students roster (from 032) + creator_display_name ------------------------

DROP FUNCTION IF EXISTS public.get_children_with_parent_status(boolean);

CREATE FUNCTION public.get_children_with_parent_status(production_only boolean DEFAULT false)
 RETURNS TABLE(
   id uuid, first_name text, last_name text, grade integer, group_number integer,
   scope text, created_at timestamptz, updated_at timestamptz, has_parent boolean,
   track_number integer, created_by uuid, creator_first_name text,
   creator_last_name text, creator_email text, creator_display_name text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'staff')
      AND ur.approved = true
  ) THEN
    RAISE EXCEPTION 'Only admins or staff can list all children';
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.first_name, c.last_name, c.grade, c.group_number, c.scope,
    c.created_at, c.updated_at,
    (pcr.parent_id IS NOT NULL) as has_parent,
    c.track_number_committed as track_number,
    c.created_by, u.first_name as creator_first_name,
    u.last_name as creator_last_name, u.email as creator_email,
    u.display_name as creator_display_name
  FROM public.children c
  LEFT JOIN public.parent_child_relationships pcr ON c.id = pcr.child_id
  LEFT JOIN public.users u ON c.created_by = u.id
  WHERE (NOT production_only OR c.scope != 'test')
  ORDER BY c.first_name ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_children_with_parent_status(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_children_with_parent_status(boolean) TO authenticated;

-- 2. Class enrollment (from 039) + added_by_display_name ----------------------

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
    added_by_at timestamptz,
    added_by_display_name text
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
        ce.created_at,
        u.display_name
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

-- Verification ----------------------------------------------------------------

-- Expect both functions, each with its new last column, EXECUTE for
-- authenticated only (plus postgres / service_role).
SELECT p.proname,
       pg_catalog.pg_get_function_result(p.oid) AS returns,
       pg_catalog.array_to_string(p.proacl, ', ') AS grants
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_children_with_parent_status', 'get_class_enrolled_children')
ORDER BY p.proname;
