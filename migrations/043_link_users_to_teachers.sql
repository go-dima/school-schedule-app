-- Migration: 043_link_users_to_teachers
-- Description: Issue #163 (Staff View part 2) -- link user accounts to the
--   teacher names on classes and schedule overrides, so a staff member's
--   week ("My schedule" / the Staff tab) can be resolved by user id instead
--   of free-text name matching. Structure only: every link starts empty,
--   so nothing changes visibly until display names and links are set
--   (profile / User Management / the class form, or a one-off data script).
--     - users.display_name: the name a staff member is shown under.
--       Unique (trimmed, case-insensitive) among filled-in values; blank is
--       stored as NULL. Only admins and approved staff/moderators may set
--       one, so a parent can't squat a teacher's name.
--     - classes.user_id / schedule_overrides.user_id: optional link to the
--       teaching user. Teachers without an account stay name-only
--       (user_id IS NULL) and behave exactly as before.
--     - `teacher` stays the text everyone reads (parents and staff can't
--       read other users' rows in public.users). It becomes a cached label:
--       a BEFORE trigger copies the linked user's display_name into it, and
--       an AFTER trigger on users rewrites it on every linked row whenever
--       the display_name changes. Deleting a user nulls the link and keeps
--       the last synced name.
--     - get_staff_directory(): (id, display_name) of approved
--       admin/staff/moderator users with a display name, for the Staff
--       dropdown and the teacher picker. Staff-role callers only.
--     - admin_set_display_name(): users only allows an own-row UPDATE (002)
--       and admin SELECT (011), so admins edit other users' display names
--       through this narrow RPC instead of a broad UPDATE policy.
-- Author: System
-- Date: 2026-09-26
--
-- NOTE: This migration is run manually (Supabase SQL editor / psql). Run it
-- before deploying the Staff View part 2 code, which reads classes.user_id.

BEGIN;

-- 1. Columns ---------------------------------------------------------------

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS display_name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name_unique
    ON public.users (lower(trim(display_name)))
    WHERE display_name IS NOT NULL;

COMMENT ON COLUMN public.users.display_name IS
    'Name a staff member is shown under (Staff View, class/override teacher label). Unique, trimmed; NULL when unset.';

ALTER TABLE public.classes
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_user_id ON public.classes(user_id);

COMMENT ON COLUMN public.classes.user_id IS
    'Optional teaching user. When set, teacher is a cached copy of users.display_name.';

ALTER TABLE public.schedule_overrides
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_overrides_user_id ON public.schedule_overrides(user_id);

COMMENT ON COLUMN public.schedule_overrides.user_id IS
    'Optional teaching user. When set, teacher is a cached copy of users.display_name.';

-- 2. display_name normalization + guard -------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_user_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.display_name := NULLIF(trim(NEW.display_name), '');

    IF NEW.display_name IS NOT NULL
       AND NEW.display_name IS DISTINCT FROM
           (CASE WHEN TG_OP = 'UPDATE' THEN OLD.display_name END)
       -- auth.uid() is NULL in the SQL editor / psql (migrations, backfills).
       AND auth.uid() IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.user_id = auth.uid()
             AND ur.role IN ('admin', 'staff', 'moderator')
             AND ur.approved = true
       ) THEN
        RAISE EXCEPTION 'Only staff members can set a display name'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_user_display_name ON public.users;
CREATE TRIGGER normalize_user_display_name
    BEFORE INSERT OR UPDATE OF display_name ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.normalize_user_display_name();

-- 3. Cached teacher label on classes / schedule_overrides -------------------

-- SECURITY DEFINER: the staff member saving a class or override usually
-- can't read the linked user's row in public.users.
CREATE OR REPLACE FUNCTION public.set_teacher_label_from_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    linked_name TEXT;
BEGIN
    IF NEW.user_id IS NOT NULL THEN
        SELECT u.display_name INTO linked_name
        FROM public.users u
        WHERE u.id = NEW.user_id;

        IF linked_name IS NOT NULL THEN
            NEW.teacher := linked_name;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_teacher_label_from_user ON public.classes;
CREATE TRIGGER set_teacher_label_from_user
    BEFORE INSERT OR UPDATE ON public.classes
    FOR EACH ROW EXECUTE FUNCTION public.set_teacher_label_from_user();

DROP TRIGGER IF EXISTS set_teacher_label_from_user ON public.schedule_overrides;
CREATE TRIGGER set_teacher_label_from_user
    BEFORE INSERT OR UPDATE ON public.schedule_overrides
    FOR EACH ROW EXECUTE FUNCTION public.set_teacher_label_from_user();

-- SECURITY DEFINER: a staff member renaming themselves on the Profile page
-- may not have write access to every class/override linked to them.
CREATE OR REPLACE FUNCTION public.sync_teacher_labels_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.display_name IS NOT NULL
       AND NEW.display_name IS DISTINCT FROM OLD.display_name THEN
        UPDATE public.classes
        SET teacher = NEW.display_name
        WHERE user_id = NEW.id;

        UPDATE public.schedule_overrides
        SET teacher = NEW.display_name
        WHERE user_id = NEW.id;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_teacher_labels_for_user ON public.users;
CREATE TRIGGER sync_teacher_labels_for_user
    AFTER UPDATE OF display_name ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_labels_for_user();

-- Trigger functions never need to be callable through /rpc (see 042 on
-- sync_last_sign_in_at): EXECUTE is only checked when a trigger is created.
REVOKE EXECUTE ON FUNCTION public.normalize_user_display_name() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_teacher_label_from_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_teacher_labels_for_user() FROM PUBLIC, anon, authenticated;

-- 4. RPC: staff directory -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_staff_directory()
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
      AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = u.id
            AND ur.role IN ('admin', 'staff', 'moderator')
            AND ur.approved = true
      )
    ORDER BY u.display_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_directory() TO authenticated;

-- 5. RPC: admin sets any user's display name --------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_display_name(
    p_user_id uuid,
    p_display_name text
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

    -- Normalization, uniqueness (23505) and label sync all come from the
    -- triggers / index above.
    UPDATE public.users
    SET display_name = p_display_name
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_display_name(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_display_name(uuid, text) TO authenticated;

-- 6. Verification -------------------------------------------------------------

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'users' AND column_name = 'display_name')
    OR (table_name IN ('classes', 'schedule_overrides') AND column_name = 'user_id'))
ORDER BY table_name;

SELECT event_object_table AS table_name, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
      'normalize_user_display_name',
      'set_teacher_label_from_user',
      'sync_teacher_labels_for_user'
  )
ORDER BY table_name, trigger_name, event_manipulation;

SELECT p.proname, pg_catalog.array_to_string(p.proacl, ', ') AS grants
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_staff_directory', 'admin_set_display_name')
ORDER BY p.proname;

COMMIT;
