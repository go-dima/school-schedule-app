-- Migration: 028_admin_only_class_create_delete
-- Description: Restrict classes INSERT/DELETE to admins only; staff keeps UPDATE (edit) access
-- Author: System
-- Date: 2026-09-13

BEGIN;

DROP POLICY IF EXISTS "Staff and admins can delete classes" ON public.classes;
DROP POLICY IF EXISTS "Staff and admins can insert classes" ON public.classes;

CREATE POLICY "Admins can delete classes" ON public.classes
    FOR DELETE USING (is_admin());

CREATE POLICY "Admins can insert classes" ON public.classes
    FOR INSERT WITH CHECK (is_admin());

COMMIT;
