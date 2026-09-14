-- Migration: 032_expose_creator_in_roster_rpc
-- Description: Surface who created each child in the admin/staff roster
--   (get_children_with_parent_status), so the Students page can show a
--   "created by" column (Task 7). 031_child_ownership_and_duplicates added
--   children.created_by but this RPC's RETURNS TABLE never picked it up, so
--   api.ts's getAllChildren() mapping of `created_by`/creator name was
--   always null in practice. Joins users the same way Task 4's
--   findLocalDuplicateChildren query does (first/last name, falling back to
--   email), so the app-side name formatting stays identical between the two
--   call sites.
-- Author: System
-- Date: 2026-09-14
--
-- NOTE: This migration is run manually (Supabase SQL editor / psql), not by
-- an automated migration runner. It is NOT executed as part of this change.

BEGIN;

DROP FUNCTION IF EXISTS get_children_with_parent_status(boolean);
CREATE OR REPLACE FUNCTION public.get_children_with_parent_status(production_only boolean DEFAULT false)
 RETURNS TABLE(
   id uuid, first_name text, last_name text, grade integer, group_number integer,
   scope text, created_at timestamptz, updated_at timestamptz, has_parent boolean,
   track_number integer, created_by uuid, creator_first_name text,
   creator_last_name text, creator_email text
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
    u.last_name as creator_last_name, u.email as creator_email
  FROM public.children c
  LEFT JOIN public.parent_child_relationships pcr ON c.id = pcr.child_id
  LEFT JOIN public.users u ON c.created_by = u.id
  WHERE (NOT production_only OR c.scope != 'test')
  ORDER BY c.first_name ASC;
END;
$function$;

REVOKE ALL ON FUNCTION get_children_with_parent_status(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_children_with_parent_status(boolean) TO authenticated;

COMMIT;
