-- Migration: 051_create_profile_on_signup
-- Description: Create the profile and the pending role request in the
--   database when an account is confirmed, instead of relying only on the
--   client.
--
--   Why: public.users rows are created only by ensureUserProfile in
--   src/services/api.ts after sign-in. The on_auth_user_created trigger from
--   003 isn't installed on the live DB. When the client never runs (the
--   Android OAuth race, #200/#201), the auth account exists with no profile
--   and no role, so the user never shows up in Pending Approvals. 11 users
--   got stuck that way and were backfilled by hand.
--
--   1) private.handle_new_auth_user(): a trigger function that inserts
--      - the public.users row (id, email, first/last name split from
--        raw_user_meta_data->>'full_name' the same way ensureUserProfile
--        does: first word, then the rest), and
--      - one pending user_roles row (approved = false). The role is
--        raw_user_meta_data->>'requested_role' when it's parent/staff/child
--        (what email signup stores), otherwise parent. Google signups land on
--        parent here; the client corrects it with request_signup_role() (3).
--        user_meta_data is user-editable, which is fine: this is only a
--        request, and an admin still picks the real role at approval.
--      The role row is added only when this call created the profile row.
--      So an email clash on users_email_key (a stale profile left by a
--      deleted auth user) skips both rows, and an existing profile whose
--      roles an admin rejected (deleted) isn't put back in Pending Approvals.
--
--      Never fails signup:
--      - ON CONFLICT DO NOTHING is untargeted, so it covers both the id
--        primary key and users_email_key.
--      - Accounts without an email (phone signups) are skipped:
--        users.email is NOT NULL.
--      - The body runs in an EXCEPTION WHEN OTHERS block that RAISEs a
--        WARNING (visible in the Postgres logs) and returns. An error here
--        would otherwise abort GoTrue's INSERT/UPDATE on auth.users and the
--        user couldn't sign up or confirm their email at all. A swallowed
--        failure leaves things where they are today: ensureUserProfile still
--        runs on sign-in as the fallback. The block costs one subtransaction
--        per signup, which is negligible.
--
--      SECURITY DEFINER (it writes public tables as GoTrue's
--      supabase_auth_admin role) with search_path = '' and fully qualified
--      names. It lives in the new `private` schema, which isn't exposed
--      through the Data API, and EXECUTE is revoked from PUBLIC, anon and
--      authenticated. Postgres checks EXECUTE on a trigger function only at
--      CREATE TRIGGER time, not when it fires (see 042).
--
--   2) Two triggers on auth.users, both gated on a confirmed email so
--      unconfirmed (mistyped, abandoned) email signups don't fill Pending
--      Approvals or leave stale profile rows behind:
--      - on_auth_user_created: AFTER INSERT, when email_confirmed_at is set
--        already (Google OAuth, or email signup with autoconfirm).
--      - on_auth_user_email_confirmed: AFTER UPDATE, when email_confirmed_at
--        goes from NULL to set (email signup, on clicking the link).
--      The existing on_auth_user_sign_in trigger (029) is left alone.
--
--      The old 003 function public.handle_new_user() is dropped, together
--      with its trigger if some environment still has it. It inserted only
--      (id, email), had no search_path, sat in the exposed public schema and
--      was executable by anon. The new trigger reuses the name
--      on_auth_user_created, so DROP TRIGGER IF EXISTS replaces the old one.
--
--   3) public.request_signup_role(p_role text): lets a user who has no
--      approved role replace their pending request(s) with a single pending
--      request for parent/staff/child. Google OAuth can't carry the signup
--      page's choice in metadata, so the trigger files it as parent and the
--      client calls this with the stored choice. Acts only on auth.uid(); it
--      can never write approved = true or a non-requestable role (the
--      045 self-insert policy has the same limits). It locks the caller's
--      user_roles rows first, so an admin approving at the same moment
--      either finishes first (and this raises) or waits.
--
--   4) Backfill: same rows for existing auth users with a confirmed email
--      and no profile. The role is added only for the profiles this
--      statement creates, and never for a user who already has any role.
--      Idempotent: a second run finds nothing to do.
--
--   Safe to apply before or after the app code: the client keeps creating
--   the profile and role itself when they're missing, and treats an existing
--   profile row as success. If the app deploys first, request_signup_role()
--   doesn't exist yet; the client logs the error and leaves the request as
--   it is.
-- Author: System
-- Date: 2026-10-04

BEGIN;

-- 1) Trigger function, in a schema the Data API doesn't expose.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_full_name text := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
    v_first_name text := split_part(v_full_name, ' ', 1);
    v_requested text := NEW.raw_user_meta_data->>'requested_role';
    v_profile_created integer;
BEGIN
    IF NEW.email IS NULL THEN
        RETURN NEW;
    END IF;

    BEGIN
        INSERT INTO public.users (id, email, first_name, last_name)
        VALUES (
            NEW.id,
            NEW.email,
            v_first_name,
            -- The rest after the first space, as split(" ").slice(1).join(" ").
            substr(v_full_name, length(v_first_name) + 2)
        )
        ON CONFLICT DO NOTHING;

        GET DIAGNOSTICS v_profile_created = ROW_COUNT;

        IF v_profile_created = 1 AND NOT EXISTS (
            SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
        ) THEN
            INSERT INTO public.user_roles (user_id, role, approved)
            VALUES (
                NEW.id,
                CASE WHEN v_requested IN ('parent', 'staff', 'child')
                     THEN v_requested
                     ELSE 'parent'
                END::public.user_role,
                false
            )
            ON CONFLICT DO NOTHING;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_auth_user: profile for % not created: % (%)',
            NEW.id, SQLERRM, SQLSTATE;
    END;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

-- 2) Triggers. Drop the 003 trigger (same name) and function first.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    WHEN (NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION private.handle_new_auth_user();

CREATE TRIGGER on_auth_user_email_confirmed
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION private.handle_new_auth_user();

-- 3) Replace the caller's pending request(s) with one for p_role.
CREATE OR REPLACE FUNCTION public.request_signup_role(p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller uuid := auth.uid();
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
    END IF;

    IF p_role IS NULL OR p_role NOT IN ('parent', 'staff', 'child') THEN
        RAISE EXCEPTION 'Role % cannot be requested', p_role
            USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_caller) THEN
        RAISE EXCEPTION 'No profile for the current user'
            USING ERRCODE = 'P0002';
    END IF;

    -- Hold the caller's role rows so an approval can't land in between the
    -- check below and the rewrite.
    PERFORM 1 FROM public.user_roles WHERE user_id = v_caller FOR UPDATE;

    IF EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = v_caller AND approved = true
    ) THEN
        RAISE EXCEPTION 'User already has an approved role'
            USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.user_roles
    WHERE user_id = v_caller
      AND approved = false
      AND role <> p_role::public.user_role;

    INSERT INTO public.user_roles (user_id, role, approved)
    VALUES (v_caller, p_role::public.user_role, false)
    ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.request_signup_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_signup_role(text) TO authenticated;

-- 4) Backfill confirmed accounts that have no profile.
WITH created AS (
    INSERT INTO public.users (id, email, first_name, last_name)
    SELECT
        au.id,
        au.email,
        split_part(COALESCE(au.raw_user_meta_data->>'full_name', ''), ' ', 1),
        substr(
            COALESCE(au.raw_user_meta_data->>'full_name', ''),
            length(split_part(COALESCE(au.raw_user_meta_data->>'full_name', ''), ' ', 1)) + 2
        )
    FROM auth.users au
    WHERE au.email IS NOT NULL
      AND au.email_confirmed_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = au.id)
    ON CONFLICT DO NOTHING
    RETURNING id
)
INSERT INTO public.user_roles (user_id, role, approved)
SELECT
    au.id,
    CASE WHEN au.raw_user_meta_data->>'requested_role' IN ('parent', 'staff', 'child')
         THEN au.raw_user_meta_data->>'requested_role'
         ELSE 'parent'
    END::public.user_role,
    false
FROM created c
JOIN auth.users au ON au.id = c.id
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = au.id)
ON CONFLICT DO NOTHING;

COMMIT;
