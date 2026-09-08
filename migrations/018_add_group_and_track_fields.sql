-- Migration: 018_add_group_and_track_fields
-- Description: Add Group (קבוצה) and Track (מסלול) as two distinct, independent
--   attributes on classes, plus a Track counterpart on children (Group already
--   exists there as group_number). Both are nullable (1, 2, or none) and settable
--   on any class/child regardless of grade -- the convention that grades 1-2 use
--   Group and grades 3-6 use Track is not enforced at the schema level, and is left
--   for the operator to apply. No backfill: existing rows are left with both
--   attributes unset. Also brings get_children_with_parent_status (previously
--   created out-of-band, not in any prior migration) under tracking here, with
--   track_number added to its output.
-- Author: System
-- Date: 2026-09-07

BEGIN;

-- Step 1: Add Group and Track to classes.
ALTER TABLE public.classes
    ADD COLUMN group_number INTEGER CHECK (group_number IS NULL OR group_number IN (1, 2));
ALTER TABLE public.classes
    ADD COLUMN track_number INTEGER CHECK (track_number IS NULL OR track_number IN (1, 2));

COMMENT ON COLUMN public.classes.group_number IS
    'קבוצה: 1, 2, or NULL. Convention: grades 1-2 classes. Matched against children.group_number.';
COMMENT ON COLUMN public.classes.track_number IS
    'מסלול: 1, 2, or NULL. Convention: grades 3-6 classes. Matched against children.track_number.';

-- Step 2: Add Track to children (Group already exists as group_number), and relax
-- children.group_number to allow NULL -- "no group" is now valid on both sides of
-- the eventual Group match, same as it already is for Track.
ALTER TABLE public.children
    ADD COLUMN track_number INTEGER CHECK (track_number IS NULL OR track_number IN (1, 2));
ALTER TABLE public.children ALTER COLUMN group_number DROP NOT NULL;

COMMENT ON COLUMN public.children.track_number IS
    'מסלול: 1, 2, or NULL. Convention: grades 3-6 children. Matched against classes.track_number.';

-- Step 3: create_child_with_relationship must accept an optional Track value so new
-- children can be created with one (mirrors the existing p_group_number parameter).
-- Adding a parameter changes the function's signature, so CREATE OR REPLACE would not
-- replace either prior version -- it would add a third overload alongside them,
-- making any 4- or 5-arg call ambiguous. Drop both known prior signatures first
-- (013_add_children_management's 4-arg version, 015_add_scope_to_children's 5-arg
-- version) so only the 6-arg version defined below remains.
DROP FUNCTION IF EXISTS create_child_with_relationship(text, text, integer, integer);
DROP FUNCTION IF EXISTS create_child_with_relationship(text, text, integer, integer, text);
CREATE OR REPLACE FUNCTION create_child_with_relationship(
  p_first_name text,
  p_last_name text,
  p_grade integer,
  p_group_number integer DEFAULT 1,
  p_scope text DEFAULT 'prod',
  p_track_number integer DEFAULT NULL
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

  INSERT INTO children (first_name, last_name, grade, group_number, scope, track_number)
  VALUES (p_first_name, p_last_name, p_grade, p_group_number, p_scope, p_track_number)
  RETURNING * INTO new_child;

  INSERT INTO parent_child_relationships (parent_id, child_id, is_primary)
  VALUES (current_user_id, new_child.id, true);

  RETURN new_child;
END;
$$;

-- Step 4: children_with_parents selects c.* but groups by an explicit column list
-- (no track_number in it yet), so the view must be recreated to add it there too.
DROP VIEW IF EXISTS children_with_parents;
CREATE VIEW children_with_parents AS
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

GRANT SELECT ON children_with_parents TO public;

-- Step 5: get_children_with_parent_status (backs the admin Students list) is not
-- defined anywhere else in migrations/ -- it was created directly in the Supabase
-- dashboard. Bringing its current definition in here, tracked, with track_number
-- appended as a new trailing output column. CREATE OR REPLACE cannot change a
-- function's return type at all -- including adding an output column to a
-- TABLE-returning function -- so the existing version must be dropped first.
DROP FUNCTION IF EXISTS get_children_with_parent_status(boolean);
CREATE OR REPLACE FUNCTION public.get_children_with_parent_status(production_only boolean DEFAULT false)
 RETURNS TABLE(id uuid, first_name text, last_name text, grade integer, group_number integer, scope text, created_at timestamp with time zone, updated_at timestamp with time zone, has_parent boolean, track_number integer)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    c.id,
    c.first_name,
    c.last_name,
    c.grade,
    c.group_number,
    c.scope,
    c.created_at,
    c.updated_at,
    CASE WHEN pcr.parent_id IS NOT NULL THEN true ELSE false END as has_parent,
    c.track_number
  FROM children c
  LEFT JOIN parent_child_relationships pcr ON c.id = pcr.child_id
  WHERE (NOT production_only OR c.scope != 'test')
  ORDER BY c.first_name ASC;
$function$;

COMMIT;
