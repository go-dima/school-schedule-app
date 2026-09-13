-- Migration: 023_split_track_draft_committed
-- Description: children.track_number was a single shared column written by
--   both parents (draft context) and staff/admin (committed context) --
--   unlike schedule_selections, which 022_add_selection_status already split
--   into independently-owned draft/committed rows. A parent freely trying
--   different Tracks would silently overwrite whatever staff had committed
--   for that child (and vice versa), even though the class selections each
--   Track choice auto-toggles were already correctly status-scoped. This
--   splits Track the same way: track_number_draft (parent-owned) and
--   track_number_committed (staff/admin-owned), replacing the single column.
--
--   No new RLS policy: the existing row-level policies on children (parent
--   owns their child's row, staff/admin owns any child's row, from
--   013_add_children_management / 021_allow_staff_update_children) already
--   let either side UPDATE the row. The draft/committed boundary here is
--   enforced only at the API layer (each call site is hardcoded to write the
--   correct column, same pattern already used for schedule_selections'
--   TrackSelectionService callers) -- a deliberate simplicity trade-off, not
--   an oversight; Track is a scalar per child, not a growing collection, so
--   the row-level RLS split schedule_selections needed doesn't map cleanly
--   here without a trigger, which was judged not worth it for this case.
--
--   Backfill: track_number_draft gets the existing value, track_number_committed
--   starts NULL for every child -- matching 022's own precedent (committed
--   selections also started empty; staff re-establishes deliberately). Staff
--   will see "no track" for every child until they re-set it.
-- Author: System
-- Date: 2026-09-09

BEGIN;

-- children_with_parents selects c.*, which Postgres expands and stores at
-- CREATE VIEW time -- must drop before the column shape underneath it
-- changes (same reasoning already documented in 017_add_class_slots.sql).
DROP VIEW IF EXISTS children_with_parents;

ALTER TABLE public.children
    ADD COLUMN track_number_draft INTEGER
        CHECK (track_number_draft IS NULL OR track_number_draft IN (1, 2));
ALTER TABLE public.children
    ADD COLUMN track_number_committed INTEGER
        CHECK (track_number_committed IS NULL OR track_number_committed IN (1, 2));

UPDATE public.children SET track_number_draft = track_number;

ALTER TABLE public.children DROP COLUMN track_number;

COMMENT ON COLUMN public.children.track_number_draft IS
    'מסלול (draft): 1, 2, or NULL. Parent/child-owned, freely edited. Matched against classes.track_number when computing the draft schedule.';
COMMENT ON COLUMN public.children.track_number_committed IS
    'מסלול (committed): 1, 2, or NULL. Staff/admin-owned, the only value staff ever sees. Matched against classes.track_number when computing the committed schedule. Never derived from track_number_draft.';

-- Recreate children_with_parents with the new column shape. Unchanged
-- otherwise (security_invoker + revoke public/anon from 020_fix_children_
-- roster_permissions -- DROP VIEW discards both, so both are re-applied).
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
GROUP BY c.id, c.first_name, c.last_name, c.grade, c.group_number, c.scope, c.created_at, c.updated_at, c.track_number_draft, c.track_number_committed;

REVOKE ALL ON children_with_parents FROM PUBLIC, anon;
GRANT SELECT ON children_with_parents TO authenticated;

-- get_children_with_parent_status powers only staff/admin surfaces (the
-- admin Students page and the staff "select any student" search), so it
-- always resolves the committed value. Output column stays named
-- track_number (not track_number_committed) so callers don't need to
-- change at all. Signature (production_only boolean) is unchanged, so
-- CREATE OR REPLACE applies cleanly without a preceding DROP.
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
    c.track_number_committed as track_number
  FROM public.children c
  LEFT JOIN public.parent_child_relationships pcr ON c.id = pcr.child_id
  WHERE (NOT production_only OR c.scope != 'test')
  ORDER BY c.first_name ASC;
END;
$function$;

REVOKE ALL ON FUNCTION get_children_with_parent_status(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_children_with_parent_status(boolean) TO authenticated;

-- create_child_with_relationship gains p_status so callers (parent-facing
-- vs staff-facing creation flows) can say which column an initial track
-- pick lands in, in the same round-trip as today. Adding a parameter
-- changes the function's identity even with a default (018's own comment
-- on this same function documents why: CREATE OR REPLACE would add a new
-- overload alongside the 6-arg version instead of replacing it, making any
-- 6-arg call ambiguous), so the prior signature is dropped first.
DROP FUNCTION IF EXISTS create_child_with_relationship(text, text, integer, integer, text, integer);
CREATE OR REPLACE FUNCTION create_child_with_relationship(
  p_first_name text,
  p_last_name text,
  p_grade integer,
  p_group_number integer DEFAULT 1,
  p_scope text DEFAULT 'prod',
  p_track_number integer DEFAULT NULL,
  p_status text DEFAULT 'draft'
)
RETURNS children
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_child children;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  INSERT INTO children (
    first_name, last_name, grade, group_number, scope,
    track_number_draft, track_number_committed
  )
  VALUES (
    p_first_name, p_last_name, p_grade, p_group_number, p_scope,
    CASE WHEN p_status = 'draft' THEN p_track_number ELSE NULL END,
    CASE WHEN p_status = 'committed' THEN p_track_number ELSE NULL END
  )
  RETURNING * INTO new_child;

  INSERT INTO parent_child_relationships (parent_id, child_id, is_primary)
  VALUES (current_user_id, new_child.id, true);

  RETURN new_child;
END;
$$;

COMMIT;
