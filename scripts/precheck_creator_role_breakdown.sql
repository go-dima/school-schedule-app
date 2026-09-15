-- Pre-migration check (run before migrations/030_child_ownership_and_duplicates.sql):
-- breakdown of children by whether their current primary
-- parent_child_relationships link points to an actual parent, or to
-- staff/admin (the bug this migration cleans up).
--
-- "parent_creator" = linked person has an approved 'parent' role.
-- "staff_creator"  = linked person has a 'staff'/'admin' role and is NOT
--                    also an approved parent (mirrors the migration's
--                    DELETE condition exactly, so this previews its effect).
-- "no_link"        = no parent_child_relationships row at all.

WITH primary_link AS (
    SELECT c.id AS child_id, pcr.parent_id
    FROM public.children c
    LEFT JOIN public.parent_child_relationships pcr
        ON pcr.child_id = c.id AND pcr.is_primary = true
),
classified AS (
    SELECT
        pl.child_id,
        CASE
            WHEN pl.parent_id IS NULL THEN 'no_link'
            WHEN EXISTS (
                SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = pl.parent_id
                  AND ur.role IN ('staff', 'admin')
                  AND ur.approved = true
            ) AND NOT EXISTS (
                SELECT 1 FROM public.user_roles ur2
                WHERE ur2.user_id = pl.parent_id
                  AND ur2.role = 'parent'
                  AND ur2.approved = true
            ) THEN 'staff_creator'
            ELSE 'parent_creator'
        END AS creator_kind
    FROM primary_link pl
)
SELECT creator_kind, COUNT(*) AS child_count
FROM classified
GROUP BY creator_kind
ORDER BY creator_kind;
