-- Post-migration verification for migrations/031_child_ownership_and_duplicates.sql
-- Run this separately (and re-run any time) after applying 031 — it's a
-- read-only sanity check, not part of the migration itself.

SELECT
    (SELECT COUNT(*) FROM public.children) AS total_children,
    (SELECT COUNT(DISTINCT child_id) FROM public.parent_child_relationships) AS children_with_parent,
    (SELECT COUNT(*) FROM public.children)
      - (SELECT COUNT(DISTINCT child_id) FROM public.parent_child_relationships) AS children_without_parent;

-- Sanity expectation: children_without_parent should roughly equal the
-- number of children that were only ever linked to a staff/admin account
-- (the ones migration 031's cleanup step just removed) — these are now the
-- pool of "claimable" children (see the claim_child RPC, also added by 031).
