-- Migration: 046_drop_open_children_insert
-- Description: Issue #188. Drop the live "Authenticated users can create
--   children" policy (INSERT, WITH CHECK auth.uid() IS NOT NULL). It isn't in
--   any repo migration -- it was created out of band -- and it lets any
--   signed-in user, including one still pending approval, insert student
--   records directly with any scope and any created_by.
--
--   Nothing needs it: the app only creates children through
--   create_child_with_relationship (SECURITY DEFINER, so RLS doesn't apply),
--   which already allows only approved parents, staff and admins and sets
--   created_by itself. Seed SQL runs as postgres. With no INSERT policy left,
--   direct client inserts are denied.
-- Author: System
-- Date: 2026-10-01

BEGIN;

DROP POLICY IF EXISTS "Authenticated users can create children" ON public.children;

COMMIT;
