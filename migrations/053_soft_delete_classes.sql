-- Migration: 053_soft_delete_classes
-- Description: Issue #253 (part 1) -- soft delete for Classes.
--     - classes gets nullable deleted_at (timestamptz) and deleted_by (the
--       user who deleted the row). Deleting a class now sets these instead
--       of removing it. Deleted rows are kept forever.
--     - Overrides stay hard-deleted (the teacher's call), and
--       schedule_overrides.time_slot_id keeps its ON DELETE CASCADE.
--     - Guard trigger (BEFORE INSERT OR UPDATE OF deleted_at, deleted_by):
--         * A soft delete is an UPDATE, and staff may UPDATE classes (041)
--           while only admins and moderators may DELETE them. The trigger
--           therefore requires is_admin_or_moderator() for any change to
--           deleted_at / deleted_by from an app session (current_user
--           authenticated/anon).
--         * When deleted_at goes from NULL to a value, the trigger stamps the
--           server's now() and auth.uid(), so the client clock and a forged
--           deleted_by are ignored. Re-deleting a deleted row keeps the
--           original stamp. Clearing deleted_at (restore -- not exposed in
--           the app yet) also clears deleted_by. INSERT always starts live.
--     - Selections of a deleted class are kept, not cascaded: they are
--       hidden. committed_enrollments only counts live classes, which fixes
--       get_class_enrollment_count(s) and get_class_enrolled_children;
--       get_class_enrollment_counts also skips deleted classes in its outer
--       scan, and classes_with_enrollment hides them.
--     - Deleting a time slot no longer removes classes: they have had no FK
--       to time_slots since 017 (slots is JSONB), and the app drops
--       orphaned slots, so nothing to change here.
--     - The DELETE policy stays (a future purge could use it); the app no
--       longer hard-deletes classes. SELECT policies stay too: the app
--       filters deleted_at in src/services/api.ts.
-- Author: System
-- Date: 2026-10-12
--
-- NOTE: This migration is run manually (Supabase SQL editor / psql). Run it
-- BEFORE merging/deploying the #253 part-1 code, which filters on
-- classes.deleted_at.

BEGIN;

-- 1. Columns -----------------------------------------------------------------

ALTER TABLE public.classes
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID NULL
        REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.classes.deleted_at IS
    'Soft delete (#253): set when the class was deleted (server time, via guard_soft_delete). NULL = live.';
COMMENT ON COLUMN public.classes.deleted_by IS
    'Soft delete (#253): the user who deleted the class.';

-- 2. Guard trigger -----------------------------------------------------------
-- Shared by classes (and children in part 2).
-- TG_ARGV[0] names the permission check:
--   'admin_or_moderator' -> is_admin_or_moderator()
-- SECURITY INVOKER on purpose: current_user is the caller's role, so a
-- SECURITY DEFINER RPC (current_user = postgres) passes, like
-- guard_children_user_id (047).

CREATE OR REPLACE FUNCTION public.guard_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.deleted_at := NULL;
        NEW.deleted_by := NULL;
        RETURN NEW;
    END IF;

    IF NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
       AND NEW.deleted_by IS NOT DISTINCT FROM OLD.deleted_by THEN
        RETURN NEW;
    END IF;

    IF current_user IN ('authenticated', 'anon') THEN
        IF TG_ARGV[0] = 'admin_or_moderator'
           AND NOT public.is_admin_or_moderator() THEN
            RAISE EXCEPTION 'Only admins and moderators can delete %', TG_TABLE_NAME
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF NEW.deleted_at IS NULL THEN
        -- Restore (not exposed in the app yet).
        NEW.deleted_by := NULL;
    ELSIF OLD.deleted_at IS NULL THEN
        -- Soft delete: the server decides when and who.
        NEW.deleted_at := now();
        NEW.deleted_by := auth.uid();
    ELSE
        -- Already deleted: keep the original stamp.
        NEW.deleted_at := OLD.deleted_at;
        NEW.deleted_by := OLD.deleted_by;
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_soft_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_classes_soft_delete ON public.classes;
CREATE TRIGGER guard_classes_soft_delete
    BEFORE INSERT OR UPDATE OF deleted_at, deleted_by ON public.classes
    FOR EACH ROW EXECUTE FUNCTION public.guard_soft_delete('admin_or_moderator');

-- 3. Partial index for the hot filter (scope IN ... AND deleted_at IS NULL)

CREATE INDEX IF NOT EXISTS idx_classes_scope_live
    ON public.classes(scope) WHERE deleted_at IS NULL;

-- 4. Enrollment views and functions skip deleted classes ---------------------
-- Same columns as before (CREATE OR REPLACE keeps grants), plus a live-class
-- filter. Part 2 adds the live-child filter.

CREATE OR REPLACE VIEW public.committed_enrollments AS
SELECT ss.class_id, ss.child_id, ss.user_id, ss.created_at
FROM public.schedule_selections ss
WHERE ss.child_id IS NOT NULL
  AND ss.status = 'committed'
  AND EXISTS (
      SELECT 1 FROM public.classes cls
      WHERE cls.id = ss.class_id AND cls.deleted_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.get_class_enrollment_counts(target_scope class_scope DEFAULT NULL::class_scope)
 RETURNS TABLE(class_id uuid, enrollment_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        c.id as class_id,
        COALESCE(enrollment_data.count, 0) as enrollment_count
    FROM public.classes c
    LEFT JOIN (
        SELECT ce.class_id, COUNT(*) as count
        FROM public.committed_enrollments ce
        GROUP BY ce.class_id
    ) enrollment_data ON c.id = enrollment_data.class_id
    WHERE (target_scope IS NULL OR c.scope = target_scope)
      AND c.deleted_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_class_enrollment_count(p_class_id uuid, target_scope class_scope DEFAULT NULL::class_scope)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    count_result BIGINT;
BEGIN
    SELECT COUNT(*) INTO count_result
    FROM public.committed_enrollments ce
    INNER JOIN public.classes c ON ce.class_id = c.id
    WHERE
        ce.class_id = p_class_id
        AND c.deleted_at IS NULL
        AND (target_scope IS NULL OR c.scope = target_scope);

    RETURN COALESCE(count_result, 0);
END;
$function$;

-- get_class_enrolled_children reads committed_enrollments, so it already
-- skips deleted classes; part 2 adds its deleted-child filter.

-- classes_with_enrollment (unused by the app): same column list, live
-- classes only. security_invoker restated so CREATE OR REPLACE keeps it.
CREATE OR REPLACE VIEW public.classes_with_enrollment
WITH (security_invoker = on) AS
SELECT
    c.id,
    c.title,
    c.description,
    c.teacher,
    c.is_mandatory,
    c.created_at,
    c.updated_at,
    c.grades,
    c.scope,
    c.is_double,
    c.room,
    c.slots,
    c.group_number,
    c.track_number,
    COALESCE(enrollment_data.enrollment_count, (0)::bigint) AS enrollment_count
FROM public.classes c
LEFT JOIN (
    SELECT ce.class_id, count(*) AS enrollment_count
    FROM public.committed_enrollments ce
    GROUP BY ce.class_id
) enrollment_data ON c.id = enrollment_data.class_id
WHERE c.deleted_at IS NULL;

COMMIT;

-- Verification (run manually after applying) ---------------------------------
-- 1. Columns:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'classes'
--      AND column_name IN ('deleted_at', 'deleted_by');
-- 2. As a staff (non-moderator) user, the trigger rejects a class soft delete:
--    UPDATE classes SET deleted_at = now() WHERE id = '<id>';  -- 42501
-- 3. As an admin, a soft delete stamps server time and the caller:
--    UPDATE classes SET deleted_at = '2000-01-01' WHERE id = '<id>'
--    RETURNING deleted_at, deleted_by;                          -- now(), auth.uid()
-- 4. A deleted class drops out of the enrollment RPCs:
--    SELECT * FROM get_class_enrollment_counts() WHERE class_id = '<id>';  -- 0 rows
--    SELECT get_class_enrollment_count('<id>');                            -- 0
