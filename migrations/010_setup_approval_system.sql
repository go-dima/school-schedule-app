-- Migration: 010_setup_approval_system
-- Description: Setup approval system - ensure proper user_roles structure has approval functionality
-- Author: System
-- Date: 2025-09-06
-- NOTE: This assumes migrations 001-009 have been run, which created the basic schema

BEGIN;

-- Ensure we have the proper user_roles table structure with approval system
-- (This should already exist from migration 001, but we'll ensure it has the approval column)
DO $$ 
BEGIN
    -- Add approved column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='user_roles' AND column_name='approved' AND table_schema='public'
    ) THEN
        ALTER TABLE public.user_roles ADD COLUMN approved BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Ensure we have the proper indexes for the approval system
CREATE INDEX IF NOT EXISTS idx_user_roles_approved ON public.user_roles(approved);

-- Create trigger function for updating updated_at timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure update triggers exist on existing tables
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_time_slots_updated_at ON public.time_slots;
CREATE TRIGGER update_time_slots_updated_at BEFORE UPDATE ON public.time_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_classes_updated_at ON public.classes;
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_selections_updated_at ON public.schedule_selections;
CREATE TRIGGER update_schedule_selections_updated_at BEFORE UPDATE ON public.schedule_selections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verification: Show current state
SELECT 'Users count:' as info, COUNT(*) as count FROM public.users;
SELECT 'User roles count:' as info, COUNT(*) as count FROM public.user_roles;
SELECT 'Pending approvals:' as info, COUNT(*) as count FROM public.user_roles WHERE approved = false;
SELECT 'Approved roles:' as info, COUNT(*) as count FROM public.user_roles WHERE approved = true;

COMMIT;