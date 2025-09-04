-- Migration: 002_rls_policies
-- Description: Enable Row Level Security and create security policies
-- Author: System
-- Date: 2024-01-01

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_selections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for migration safety)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Everyone can view time slots" ON public.time_slots;
DROP POLICY IF EXISTS "Admins can manage time slots" ON public.time_slots;
DROP POLICY IF EXISTS "Everyone can view classes" ON public.classes;
DROP POLICY IF EXISTS "Staff and admins can manage classes" ON public.classes;
DROP POLICY IF EXISTS "Users can view own selections" ON public.schedule_selections;
DROP POLICY IF EXISTS "Users can manage own selections" ON public.schedule_selections;
DROP POLICY IF EXISTS "Parents can view child selections" ON public.schedule_selections;
DROP POLICY IF EXISTS "Staff and admins can view all selections" ON public.schedule_selections;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'admin' 
            AND ur.approved = true
        )
    );

CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'admin' 
            AND ur.approved = true
        )
    );

CREATE POLICY "Users can request roles" ON public.user_roles
    FOR INSERT WITH CHECK (auth.uid() = user_id AND approved = false);

-- Time slots policies
CREATE POLICY "Everyone can view time slots" ON public.time_slots
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage time slots" ON public.time_slots
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'admin' 
            AND ur.approved = true
        )
    );

-- Classes policies
CREATE POLICY "Everyone can view classes" ON public.classes
    FOR SELECT USING (true);

CREATE POLICY "Staff and admins can manage classes" ON public.classes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff') 
            AND ur.approved = true
        )
    );

-- Schedule selections policies
CREATE POLICY "Users can view own selections" ON public.schedule_selections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own selections" ON public.schedule_selections
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Parents can view child selections" ON public.schedule_selections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'parent' 
            AND ur.approved = true
        )
    );

CREATE POLICY "Staff and admins can view all selections" ON public.schedule_selections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff') 
            AND ur.approved = true
        )
    );