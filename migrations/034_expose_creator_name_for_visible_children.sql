-- Migration: 034_expose_creator_name_for_visible_children
-- Description: The duplicate-warning dialog needs to show who created a
--   matching child (e.g. "already created by <teacher name>"), but the
--   only SELECT policy on public.users is "view own profile" (plus an
--   admin-view-all policy). So the client-side join to users for the
--   creator's name resolved to NULL for anyone but the creator/an admin,
--   showing a generic "another user" fallback instead of the real name.
--   This adds a SELECT policy: any authenticated user can see the row of
--   whoever is the created_by of a children row THEY can already see
--   (composing on top of children's own RLS, which after
--   031/033 correctly scopes to: their own children, any unclaimed child
--   if they're an approved parent, or all children if they're staff/admin).
--   This does not broaden who can see which CHILDREN -- only whether the
--   already-visible child's creator's name is resolvable.
-- Author: System
-- Date: 2026-09-14
--
-- NOTE: This migration is run manually (Supabase SQL editor / psql), not by
-- an automated migration runner. It is NOT executed as part of this change.

BEGIN;

CREATE POLICY "Users can view creators of children they can see" ON public.users
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.created_by = users.id
        )
    );

COMMIT;
