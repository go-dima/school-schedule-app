-- Migration: 021_allow_staff_update_children
-- Description: The only UPDATE policy on public.children was the parent-scoped
--   one from 013_add_children_management.sql. Staff have no
--   parent_child_relationships row for the children they manage, so staff
--   updates to children (e.g. clearing a track) were silently filtered to 0
--   rows by RLS, which made `.select().single()` throw PGRST116 ("Cannot
--   coerce the result to a single JSON object"). This adds an additive
--   admin-or-staff UPDATE policy (matching the existing admin-or-staff
--   convention in 002_rls_policies.sql / 005_fix_classes_rls_policy.sql /
--   020_fix_children_roster_permissions.sql), leaving the parent policy
--   untouched -- RLS ORs multiple permissive policies for the same command.
-- Author: System
-- Date: 2026-09-09

BEGIN;

CREATE POLICY "Staff and admins can update any child" ON public.children
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'staff')
              AND ur.approved = true
        )
    );

COMMIT;
