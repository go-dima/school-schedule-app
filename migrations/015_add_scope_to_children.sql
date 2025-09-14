-- Migration: 015_add_scope_to_children
-- Description: Add scope field to children table with "prod" as default, similar to classes
-- Date: 2025-09-14
-- Author: Claude Code

-- 1. Add scope column to children table
ALTER TABLE children
ADD COLUMN scope text NOT NULL DEFAULT 'prod'
CHECK (scope IN ('test', 'prod'));

-- 2. Create index for performance on scope filtering
CREATE INDEX idx_children_scope ON children(scope);

-- 3. Update the existing create_child_with_relationship function to support scope
CREATE OR REPLACE FUNCTION create_child_with_relationship(
  p_first_name text,
  p_last_name text,
  p_grade integer,
  p_group_number integer DEFAULT 1,
  p_scope text DEFAULT 'prod'
)
RETURNS children
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_child children;
  current_user_id uuid;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Insert the child with scope
  INSERT INTO children (first_name, last_name, grade, group_number, scope)
  VALUES (p_first_name, p_last_name, p_grade, p_group_number, p_scope)
  RETURNING * INTO new_child;

  -- Create the parent-child relationship
  INSERT INTO parent_child_relationships (parent_id, child_id, is_primary)
  VALUES (current_user_id, new_child.id, true);

  RETURN new_child;
END;
$$;

-- 4. Update children_with_parents view to include scope
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
GROUP BY c.id, c.first_name, c.last_name, c.grade, c.group_number, c.scope, c.created_at, c.updated_at;

-- 5. Grant necessary permissions
GRANT SELECT ON children_with_parents TO public;

-- 6. Update any existing children to have 'prod' scope (redundant due to DEFAULT but explicit)
UPDATE children SET scope = 'prod' WHERE scope IS NULL;

COMMENT ON COLUMN children.scope IS 'Scope of the child: "test" for testing, "prod" for production.';
COMMENT ON INDEX idx_children_scope IS 'Index for efficient filtering of children by scope in production environment';