-- Migration: 033_allow_parent_view_unclaimed_children
-- Description: Closes a real gap surfaced by manual testing of
--   031_child_ownership_and_duplicates: an approved parent's only SELECT
--   policy on public.children (013_add_children_management) scopes to
--   children they're already linked to via parent_child_relationships.
--   A staff-created, still-unclaimed child (no parent link at all) is
--   therefore invisible to every parent, which means:
--     - the client-side duplicate-name+grade check (findLocalDuplicateChildren,
--       a plain RLS-subject SELECT) silently returns zero rows for a parent
--       even when an exact staff-created match exists, so the warning never
--       fires and a duplicate gets created with no notice at all;
--     - the claim_child RPC has nothing to point a parent at, since they
--       can't discover unclaimed children to claim in the first place.
--   This adds an additive SELECT policy: any approved parent can see
--   children that have NO parent_child_relationships row yet (i.e. only
--   unclaimed ones, never another family's already-claimed child). RLS ORs
--   multiple permissive policies for the same command, so the existing
--   "Parents can view their children" policy is untouched.
-- Author: System
-- Date: 2026-09-14
--
-- NOTE: This migration is run manually (Supabase SQL editor / psql), not by
-- an automated migration runner. It is NOT executed as part of this change.

BEGIN;

CREATE POLICY "Parents can view unclaimed children" ON public.children
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role = 'parent'
              AND ur.approved = true
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.parent_child_relationships pcr
            WHERE pcr.child_id = children.id
        )
    );

COMMIT;
