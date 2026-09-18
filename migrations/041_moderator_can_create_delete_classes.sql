-- Migration: 041_moderator_can_create_delete_classes
-- Description: Issue #144 — grant moderator the same class create/delete
--   rights as admin (canCreateClasses/canDeleteClasses in permissions.ts).
--   Staff intentionally stays excluded from create/delete (migration 028
--   already restricted it to admin-only; moderator now joins admin, staff
--   still cannot create or delete classes, only update them).
-- Author: System
-- Date: 2026-09-18
--
-- Requires migration 040 (adds 'moderator' to the user_role enum) to have
-- been applied and committed first.

BEGIN;

-- Helper mirroring is_admin() (migration 011), extended to admin OR moderator.
CREATE OR REPLACE FUNCTION is_admin_or_moderator()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role IN ('admin', 'moderator')
          AND approved = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Admins can delete classes" ON public.classes;
DROP POLICY IF EXISTS "Admins can insert classes" ON public.classes;

CREATE POLICY "Admins and moderators can delete classes" ON public.classes
    FOR DELETE USING (is_admin_or_moderator());

CREATE POLICY "Admins and moderators can insert classes" ON public.classes
    FOR INSERT WITH CHECK (is_admin_or_moderator());

COMMIT;
