-- Migration: 029_add_last_sign_in_at
-- Description: Sync auth.users.last_sign_in_at into public.users so the admin
--   User Management page can display it (previously always undefined, since
--   auth.users cannot be queried from the browser client)
-- Author: System
-- Date: 2026-09-13

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

-- Function to sync last_sign_in_at from auth.users on every sign-in
CREATE OR REPLACE FUNCTION public.sync_last_sign_in_at()
RETURNS trigger AS $$
BEGIN
    UPDATE public.users
    SET last_sign_in_at = NEW.last_sign_in_at
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ language plpgsql security definer set search_path = public;

-- Trigger fires on every login (auth.users.last_sign_in_at update)
DROP TRIGGER IF EXISTS on_auth_user_sign_in ON auth.users;
CREATE TRIGGER on_auth_user_sign_in
    AFTER UPDATE OF last_sign_in_at ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.sync_last_sign_in_at();

-- Backfill existing users so the column is populated immediately
UPDATE public.users u
SET last_sign_in_at = au.last_sign_in_at
FROM auth.users au
WHERE au.id = u.id;
