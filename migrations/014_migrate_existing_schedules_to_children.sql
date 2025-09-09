-- Migration: 014_migrate_existing_schedules_to_children
-- Description: Create dummy children for existing users and migrate their schedule selections

-- Create dummy children for users who have schedule selections but don't have children yet
INSERT INTO public.children (first_name, last_name, grade, group_number)
SELECT
    COALESCE(u.first_name, 'לא') as first_name,
    COALESCE(u.last_name, 'צוין') as last_name,
    1 as grade, -- Default to grade 1, users can update this
    1 as group_number
FROM public.users u
WHERE EXISTS (
    SELECT 1 FROM public.schedule_selections ss
    WHERE ss.user_id = u.id
)
AND NOT EXISTS (
    SELECT 1 FROM public.parent_child_relationships pcr
    WHERE pcr.parent_id = u.id
);

-- Create primary parent relationships for the newly created dummy children
INSERT INTO public.parent_child_relationships (parent_id, child_id, is_primary)
SELECT
    u.id as parent_id,
    c.id as child_id,
    true as is_primary
FROM public.users u
CROSS JOIN public.children c
WHERE EXISTS (
    SELECT 1 FROM public.schedule_selections ss
    WHERE ss.user_id = u.id
)
AND NOT EXISTS (
    SELECT 1 FROM public.parent_child_relationships pcr
    WHERE pcr.parent_id = u.id
)
-- Get the most recently created child for each user (our dummy child)
AND c.id IN (
    SELECT c2.id
    FROM public.children c2
    WHERE c2.first_name = COALESCE(u.first_name, 'לא')
    AND c2.last_name = COALESCE(u.last_name, 'צוין')
    ORDER BY c2.created_at DESC
    LIMIT 1
);

-- Update existing schedule_selections to reference the dummy children
UPDATE public.schedule_selections
SET child_id = pcr.child_id
FROM public.parent_child_relationships pcr
WHERE pcr.parent_id = schedule_selections.user_id
AND pcr.is_primary = true
AND schedule_selections.child_id IS NULL;

-- Verify migration completed successfully
DO $$
DECLARE
    orphaned_selections_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_selections_count
    FROM public.schedule_selections
    WHERE child_id IS NULL;

    IF orphaned_selections_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % schedule selections still have no child_id', orphaned_selections_count;
    END IF;

    RAISE NOTICE 'Migration completed successfully. All schedule selections now have child_id assigned.';
END $$;

-- Make child_id NOT NULL after migration
ALTER TABLE public.schedule_selections
ALTER COLUMN child_id SET NOT NULL;

-- Create a view for easier querying of children with their parents
CREATE VIEW public.children_with_parents AS
SELECT
    c.*,
    array_agg(
        json_build_object(
            'user_id', u.id,
            'email', u.email,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'is_primary', pcr.is_primary
        )
    ) as parents
FROM public.children c
JOIN public.parent_child_relationships pcr ON c.id = pcr.child_id
JOIN public.users u ON pcr.parent_id = u.id
GROUP BY c.id, c.first_name, c.last_name, c.grade, c.group_number, c.created_at, c.updated_at;

COMMENT ON VIEW public.children_with_parents IS 'View showing children with all their associated parents';