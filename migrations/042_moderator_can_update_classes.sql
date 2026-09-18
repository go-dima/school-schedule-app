-- Migration: 042_moderator_can_update_classes
-- Description: Issue #144 — grant moderator the same class-catalog update
--   rights as staff/admin (canManageClasses in permissions.ts covers
--   admin || staff || moderator). Extends the existing "Staff and admins
--   can update classes" policy (migration 005) to also allow moderator.
-- Author: System
-- Date: 2026-09-18
--
-- Requires migration 040 (adds 'moderator' to the user_role enum) to have
-- been applied and committed first.

BEGIN;

DROP POLICY IF EXISTS "Staff and admins can update classes" ON public.classes;

CREATE POLICY "Staff, admins and moderators can update classes" ON public.classes
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'staff', 'moderator')
            AND ur.approved = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'staff', 'moderator')
            AND ur.approved = true
        )
    );

COMMIT;
