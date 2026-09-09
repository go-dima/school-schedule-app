-- Migration: 020_fix_children_roster_permissions
-- Description: A security review found that children_with_parents (view) and
--   get_children_with_parent_status() (RPC) were both reachable by anyone with
--   the project's public anon key, with no login and no permission check --
--   leaking every child's name/grade/track and every linked parent's name and
--   email to unauthenticated callers. This locks both down:
--     - children_with_parents switches to security_invoker so it honors the
--       caller's own RLS instead of running with view-owner rights. It has no
--       current callers in the app, so this is a pure tightening.
--     - get_children_with_parent_status gains an explicit admin-or-staff check.
--       It powers both the admin Students page and the staff "select any
--       student" search on the Schedule page, so the check allows either role
--       (matching the existing admin-or-staff convention used for classes RLS
--       in 002_rls_policies.sql / 005_fix_classes_rls_policy.sql) rather than
--       admin only, to avoid breaking staff users.
--   Both objects are also regranted to `authenticated` only, revoking public/anon
--   access entirely.
-- Author: System
-- Date: 2026-09-09

BEGIN;

-- 1. children_with_parents: security_invoker so RLS on children /
--    parent_child_relationships / users is honored for the calling user.
DROP VIEW IF EXISTS children_with_parents;
CREATE VIEW children_with_parents
WITH (security_invoker = true) AS
SELECT
  c.*,
  COALESCE(
    json_agg(
      json_build_object(
        'user_id', u.id,
        'email', u.email,
        'first_name', u.first_name,
        'last_name', u.last_name,
        'is_primary', pcr.is_primary
      )
    ) FILTER (WHERE u.id IS NOT NULL),
    '[]'::json
  ) as parents
FROM children c
LEFT JOIN parent_child_relationships pcr ON c.id = pcr.child_id
LEFT JOIN users u ON pcr.parent_id = u.id
GROUP BY c.id, c.first_name, c.last_name, c.grade, c.group_number, c.scope, c.created_at, c.updated_at, c.track_number;

REVOKE ALL ON children_with_parents FROM PUBLIC, anon;
GRANT SELECT ON children_with_parents TO authenticated;

-- 2. get_children_with_parent_status: intentionally bypasses per-parent RLS
--    (it powers the "see everyone" admin/staff lists), so it needs an explicit
--    role check inside it instead of security_invoker. LANGUAGE changes from
--    sql to plpgsql because the check needs an IF/RAISE -- the query itself is
--    unchanged from 018_add_group_and_track_fields.sql.
DROP FUNCTION IF EXISTS get_children_with_parent_status(boolean);
CREATE OR REPLACE FUNCTION public.get_children_with_parent_status(production_only boolean DEFAULT false)
 RETURNS TABLE(id uuid, first_name text, last_name text, grade integer, group_number integer, scope text, created_at timestamptz, updated_at timestamptz, has_parent boolean, track_number integer)
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
    c.track_number
  FROM public.children c
  LEFT JOIN public.parent_child_relationships pcr ON c.id = pcr.child_id
  WHERE (NOT production_only OR c.scope != 'test')
  ORDER BY c.first_name ASC;
END;
$function$;

REVOKE ALL ON FUNCTION get_children_with_parent_status(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_children_with_parent_status(boolean) TO authenticated;

COMMIT;
