-- Migration: 052_dedupe_children_roster
-- Description: get_children_with_parent_status (last defined in 044) derived
--   has_parent from a LEFT JOIN on parent_child_relationships, so a child
--   linked to two parents (possible since 049) came back once per link and
--   showed up repeatedly on the Students page and the schedule student
--   search. has_parent is now an EXISTS check: one row per child. The
--   signature and body are otherwise unchanged from 044, so CREATE OR
--   REPLACE keeps the existing grants.
-- Author: System
-- Date: 2026-10-05
--
-- NOTE: Run manually (Supabase SQL editor / psql), after 051.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_children_with_parent_status(production_only boolean DEFAULT false)
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
    EXISTS (
      SELECT 1 FROM public.parent_child_relationships pcr
      WHERE pcr.child_id = c.id
    ) as has_parent,
    c.track_number_committed as track_number,
    c.created_by, u.first_name as creator_first_name,
    u.last_name as creator_last_name, u.email as creator_email,
    u.display_name as creator_display_name
  FROM public.children c
  LEFT JOIN public.users u ON c.created_by = u.id
  WHERE (NOT production_only OR c.scope != 'test')
  ORDER BY c.first_name ASC;
END;
$function$;

COMMIT;

-- Verification ----------------------------------------------------------------

-- Expect no rows: every child appears once.
SELECT id, count(*)
FROM public.get_children_with_parent_status(false)
GROUP BY id
HAVING count(*) > 1;
