-- Migration: 025_allow_staff_delete_children
-- Description: The only DELETE policy on public.children was the parent-scoped
--   one from 013_add_children_management.sql. Staff have no
--   parent_child_relationships row for the children they manage, so staff
--   deletes of children were silently filtered to 0 rows by RLS -- the
--   `.delete()` call returned no error, producing a false "success" toast
--   while the row remained. This mirrors 021_allow_staff_update_children.sql
--   (which fixed the identical issue for UPDATE) but for DELETE, adding an
--   additive admin-or-staff DELETE policy (matching the existing
--   admin-or-staff convention in 002_rls_policies.sql /
--   005_fix_classes_rls_policy.sql / 020_fix_children_roster_permissions.sql
--   / 021_allow_staff_update_children.sql), leaving the parent policy
--   untouched -- RLS ORs multiple permissive policies for the same command.
-- Author: System
-- Date: 2026-09-10

BEGIN;

CREATE POLICY "Staff and admins can delete any child" ON public.children
    FOR DELETE
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
