-- Migration: 050_add_scope_to_users
-- Description: Issue #108 -- add a test/prod scope to user accounts, so
--   test accounts can be hidden in production the same way test classes
--   (007) and test children (015) already are.
--     - users.scope: 'test' | 'prod', NOT NULL, default 'prod'. Plain text
--       with a CHECK constraint, like children.scope (015). Every existing
--       and every newly signed-up user is 'prod'.
--     - Guard trigger: users has an own-row UPDATE policy (002), so without
--       a guard any user could flip their own scope. Only an approved admin
--       (public.is_admin()) may set a non-'prod' scope on INSERT or change
--       it on UPDATE. Inside a SECURITY DEFINER function auth.uid() is still
--       the caller, so admin_set_user_scope below passes the check. With no
--       auth.uid() (SQL editor / psql, or the handle_new_user auth trigger
--       from 003) the guard does not apply, matching 043.
--     - admin_set_user_scope(): admins have no UPDATE policy on other
--       users' rows, so they change scope through this narrow RPC (same
--       shape as admin_set_display_name in 043).
--     - get_staff_directory(p_scopes): the teacher pickers / Staff dropdown
--       now pass the scopes they may see (getAllowedScopes()), so a prod
--       build never lists a test account. NULL keeps the old "every scope"
--       behaviour.
-- Author: System
-- Date: 2026-10-04
--
-- NOTE: This migration is run manually (Supabase SQL editor / psql). Run it
-- before deploying the #108 code, which filters users on users.scope and
-- calls get_staff_directory with p_scopes.

BEGIN;

-- 1. Column ------------------------------------------------------------------

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'prod'
    CHECK (scope IN ('test', 'prod'));

CREATE INDEX IF NOT EXISTS idx_users_scope ON public.users(scope);

COMMENT ON COLUMN public.users.scope IS
    'test | prod. Test accounts are hidden in production. Only admins may set or change it (guard trigger, admin_set_user_scope RPC).';

-- 2. Guard: only admins set or change scope ----------------------------------

CREATE OR REPLACE FUNCTION public.guard_user_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.scope IS DISTINCT FROM
           (CASE WHEN TG_OP = 'UPDATE' THEN OLD.scope ELSE 'prod' END)
       -- auth.uid() is NULL in the SQL editor / psql (migrations, backfills)
       -- and in the handle_new_user auth trigger.
       AND auth.uid() IS NOT NULL
       AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only admins can set a user scope'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_scope ON public.users;
CREATE TRIGGER guard_user_scope
    BEFORE INSERT OR UPDATE OF scope ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.guard_user_scope();

-- Trigger functions never need to be callable through /rpc (see 042/043).
REVOKE EXECUTE ON FUNCTION public.guard_user_scope() FROM PUBLIC, anon, authenticated;

-- 3. RPC: admin sets any user's scope ------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_user_scope(
    p_user_id uuid,
    p_scope text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;

    -- An invalid value fails on the CHECK constraint (23514).
    UPDATE public.users
    SET scope = p_scope
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_scope(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_scope(uuid, text) TO authenticated;

-- 4. RPC: staff directory, filtered by scope ---------------------------------

-- CREATE OR REPLACE with a new parameter list creates a second overload
-- rather than replacing the no-argument function (see 038) -- drop it first.
DROP FUNCTION IF EXISTS public.get_staff_directory();

CREATE OR REPLACE FUNCTION public.get_staff_directory(
    p_scopes text[] DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    display_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin', 'staff', 'moderator')
          AND ur.approved = true
    ) THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT u.id, u.display_name
    FROM public.users u
    WHERE u.display_name IS NOT NULL
      AND (p_scopes IS NULL OR u.scope = ANY (p_scopes))
      AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = u.id
            AND ur.role IN ('admin', 'staff', 'moderator')
            AND ur.approved = true
      )
    ORDER BY u.display_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_directory(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_directory(text[]) TO authenticated;

-- 5. Verification -------------------------------------------------------------

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'scope';

SELECT scope, count(*) AS users
FROM public.users
GROUP BY scope
ORDER BY scope;

SELECT event_object_table AS table_name, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'guard_user_scope'
ORDER BY event_manipulation;

-- Expect exactly one get_staff_directory (args: p_scopes text[]).
SELECT p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
       pg_catalog.array_to_string(p.proacl, ', ') AS grants
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('guard_user_scope', 'admin_set_user_scope', 'get_staff_directory')
ORDER BY p.proname;

COMMIT;
