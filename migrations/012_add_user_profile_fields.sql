-- Migration: 012_add_user_profile_fields
-- Description: Add first_name and last_name fields to users table for profile management
-- Author: System
-- Date: 2025-09-06

BEGIN;

-- Add first_name and last_name columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Create index for faster name-based searches
CREATE INDEX IF NOT EXISTS idx_users_names ON public.users(first_name, last_name);

-- Add comment for clarity
COMMENT ON COLUMN public.users.first_name IS 'User first name for profile';
COMMENT ON COLUMN public.users.last_name IS 'User last name for profile';

-- Verification: Show updated table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND table_schema = 'public' 
ORDER BY ordinal_position;

COMMIT;