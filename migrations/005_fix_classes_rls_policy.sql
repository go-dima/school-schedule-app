-- Migration: 003_fix_classes_rls_policy
-- Description: Fix RLS policy for classes INSERT operations
-- Author: System
-- Date: Current session

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Staff and admins can manage classes" ON public.classes;

-- Create separate policies for different operations
-- SELECT and DELETE can use USING clause (checking existing rows)
CREATE POLICY "Staff and admins can view and delete classes" ON public.classes
    FOR SELECT USING (true);

CREATE POLICY "Staff and admins can delete classes" ON public.classes
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff') 
            AND ur.approved = true
        )
    );

-- INSERT and UPDATE need WITH CHECK clause (for new/modified rows)
CREATE POLICY "Staff and admins can insert classes" ON public.classes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff') 
            AND ur.approved = true
        )
    );

CREATE POLICY "Staff and admins can update classes" ON public.classes
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff') 
            AND ur.approved = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff') 
            AND ur.approved = true
        )
    );