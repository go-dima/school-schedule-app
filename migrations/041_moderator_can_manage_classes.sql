-- Migration: 041_moderator_can_manage_classes
-- Description: Issue #144 — grant moderator class-management rights: same
--   create/delete rights as admin (canCreateClasses/canDeleteClasses in
--   permissions.ts; staff stays excluded, per migration 028's admin-only
--   restriction), and the same update rights as staff/admin
--   (canManageClasses covers admin || staff || moderator), extending the
--   "Staff and admins can update classes" policy from migration 005.
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
