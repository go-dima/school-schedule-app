-- Migration: 011_fix_admin_rls_policies
-- Description: Add RLS policies to allow admins to view and manage all user approvals
-- Author: System
-- Date: 2025-09-06

BEGIN;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'admin'
          AND approved = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add admin policy for users table (admins can view all users)
CREATE POLICY "users_admin_select_all" ON public.users
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Add admin policy for user_roles table (admins can view all user roles)
CREATE POLICY "user_roles_admin_select_all" ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Add admin policy for user_roles table (admins can update any user role for approval)
CREATE POLICY "user_roles_admin_update_approval" ON public.user_roles
    FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- Add admin policy for user_roles table (admins can delete any user role)
CREATE POLICY "user_roles_admin_delete" ON public.user_roles
    FOR DELETE
    TO authenticated
    USING (is_admin());

-- Verify policies were created
SELECT
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'user_roles')
  AND policyname LIKE '%admin%'
ORDER BY tablename, policyname;

COMMIT;