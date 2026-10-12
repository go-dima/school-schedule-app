-- Migration: 054_soft_delete_children
-- Description: Issue #253 (part 2) -- soft delete for Children. Requires 053.
--     - children gets nullable deleted_at (timestamptz) and deleted_by (the
--       user who deleted the row). Deleting a child sets these instead of
--       removing the row; deleted rows are kept forever. Nothing cascades:
--       the child's Selections, Overrides and parent links stay in place and
--       are hidden because the child is.
--     - Soft-deleting a child also clears children.user_id (the child login
--       link), so the UNIQUE constraint on user_id (047) never blocks
--       linking that login to another student. The 'child' role is NOT
--       revoked. guard_children_user_id (047) only rejects a non-NULL
--       user_id, so clearing it is allowed.
--     - guard_soft_delete() (053) gains the 'admin_or_staff' check and the
--       user_id clearing. A soft delete is an UPDATE, and parents may UPDATE
--       their own children ("Parents can update own children"), so from an
--       app session only approved admin/staff may change deleted_at /
--       deleted_by -- one parent can't soft-delete a child shared with
--       another parent. Parents delete through remove_child_for_parent
--       (SECURITY DEFINER, current_user is the owner, so the guard lets it
--       through). The server's now() and auth.uid() are stamped.
--     - remove_child_for_parent: when the caller holds the child's last
--       parent link, the link is KEPT and the child is soft-deleted (was: the
--       link and the child were hard-deleted). Otherwise only the caller's
--       link is removed, as before.
--     - Every SECURITY DEFINER function / view that reads children skips
--       deleted ones: committed_enrollments, get_class_enrolled_children,
--       get_children_with_parent_status, find_child_matches, claim_child,
--       set_track_draft, my_linked_child_id (a linked child user then sees
--       nothing through the child-user RLS policies), approve_child_account,
--       remove_child_for_parent. children_with_parents now also exposes
--       deleted_at (appended last), so the app can filter it.
-- Author: System
-- Date: 2026-10-12
--
-- NOTE: This migration is run manually (Supabase SQL editor / psql). Run it
-- AFTER 053 and BEFORE merging/deploying the #253 part-2 code, which
-- filters on children.deleted_at and children_with_parents.deleted_at.

BEGIN;

-- 1. Columns -----------------------------------------------------------------

ALTER TABLE public.children
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID NULL
        REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.children.deleted_at IS
    'Soft delete (#253): set when the student was deleted (server time, via guard_soft_delete). NULL = live.';
COMMENT ON COLUMN public.children.deleted_by IS
    'Soft delete (#253): the user who deleted the student.';

CREATE INDEX IF NOT EXISTS idx_children_scope_live
    ON public.children(scope) WHERE deleted_at IS NULL;

-- 2. Guard trigger -----------------------------------------------------------
-- TG_ARGV[0]:
--   'admin_or_moderator' -> is_admin_or_moderator()            (classes)
--   'admin_or_staff'     -> approved admin or staff role       (children)

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

        IF TG_ARGV[0] = 'admin_or_staff' AND NOT EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'staff')
              AND ur.approved = true
        ) THEN
            RAISE EXCEPTION 'Only admins and staff can delete %', TG_TABLE_NAME
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
        IF TG_TABLE_NAME = 'children' THEN
            -- Free the child login: it can be linked to another student.
            NEW.user_id := NULL;
        END IF;
    ELSE
        -- Already deleted: keep the original stamp.
        NEW.deleted_at := OLD.deleted_at;
        NEW.deleted_by := OLD.deleted_by;
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_soft_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_children_soft_delete ON public.children;
CREATE TRIGGER guard_children_soft_delete
    BEFORE INSERT OR UPDATE OF deleted_at, deleted_by ON public.children
    FOR EACH ROW EXECUTE FUNCTION public.guard_soft_delete('admin_or_staff');

-- 3. Enrollments skip deleted children (and, from 053, deleted classes) ------

CREATE OR REPLACE VIEW public.committed_enrollments AS
SELECT ss.class_id, ss.child_id, ss.user_id, ss.created_at
FROM public.schedule_selections ss
WHERE ss.child_id IS NOT NULL
  AND ss.status = 'committed'
  AND EXISTS (
      SELECT 1 FROM public.classes cls
      WHERE cls.id = ss.class_id AND cls.deleted_at IS NULL
  )
  AND EXISTS (
      SELECT 1 FROM public.children ch
      WHERE ch.id = ss.child_id AND ch.deleted_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.get_class_enrolled_children(p_class_id uuid, target_scope text[] DEFAULT NULL::text[])
 RETURNS TABLE(id uuid, first_name text, last_name text, grade integer, group_number integer, track_number integer, scope text, created_at timestamp with time zone, updated_at timestamp with time zone, added_by_user_id uuid, added_by_first_name text, added_by_last_name text, added_by_at timestamp with time zone, added_by_display_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'staff')
        AND ur.approved = true
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.grade,
        c.group_number,
        c.track_number_committed,
        c.scope,
        c.created_at,
        c.updated_at,
        ce.user_id,
        u.first_name,
        u.last_name,
        ce.created_at,
        u.display_name
    FROM public.children c
    INNER JOIN public.committed_enrollments ce ON ce.child_id = c.id
    INNER JOIN public.users u ON u.id = ce.user_id
    WHERE ce.class_id = p_class_id
    AND c.deleted_at IS NULL
    AND (target_scope IS NULL OR c.scope = ANY(target_scope));
END;
$function$;

-- 4. Children listings / lookups ---------------------------------------------

CREATE OR REPLACE FUNCTION public.get_children_with_parent_status(production_only boolean DEFAULT false)
 RETURNS TABLE(id uuid, first_name text, last_name text, grade integer, group_number integer, scope text, created_at timestamp with time zone, updated_at timestamp with time zone, has_parent boolean, track_number integer, created_by uuid, creator_first_name text, creator_last_name text, creator_email text, creator_display_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'staff')
      AND ur.approved = true
  ) THEN
    RAISE EXCEPTION 'Only admins or staff can list all children';
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.first_name, c.last_name, c.grade, c.group_number, c.scope,
    c.created_at, c.updated_at,
    EXISTS (
      SELECT 1 FROM public.parent_child_relationships pcr
      WHERE pcr.child_id = c.id
    ) as has_parent,
    c.track_number_committed as track_number,
    c.created_by, u.first_name as creator_first_name,
    u.last_name as creator_last_name, u.email as creator_email,
    u.display_name as creator_display_name
  FROM public.children c
  LEFT JOIN public.users u ON c.created_by = u.id
  WHERE (NOT production_only OR c.scope != 'test')
    AND c.deleted_at IS NULL
  ORDER BY c.first_name ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.find_child_matches(p_first_name text, p_last_name text, p_grade integer, p_scopes text[], p_exclude_child_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, grade integer, created_by uuid, creator_first_name text, creator_last_name text, creator_display_name text, parent_first_name text, parent_last_name text, parent_display_name text, has_parent boolean, linked_to_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = current_user_id
          AND ur.approved = true
          AND ur.role IN ('parent', 'staff', 'admin')
    ) THEN
        RAISE EXCEPTION 'Only approved parents, staff, or admins can look up children';
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.grade,
        c.created_by,
        creator.first_name,
        creator.last_name,
        creator.display_name,
        linked_parent.first_name,
        linked_parent.last_name,
        linked_parent.display_name,
        linked_parent.parent_id IS NOT NULL,
        EXISTS (
            SELECT 1 FROM public.parent_child_relationships mine
            WHERE mine.child_id = c.id
              AND mine.parent_id = current_user_id
        )
    FROM public.children c
    LEFT JOIN public.users creator ON creator.id = c.created_by
    LEFT JOIN LATERAL (
        -- The primary parent, else the oldest link.
        SELECT pcr.parent_id, u.first_name, u.last_name, u.display_name
        FROM public.parent_child_relationships pcr
        LEFT JOIN public.users u ON u.id = pcr.parent_id
        WHERE pcr.child_id = c.id
        ORDER BY pcr.is_primary DESC NULLS LAST, pcr.created_at ASC
        LIMIT 1
    ) linked_parent ON true
    WHERE lower(trim(c.first_name)) = lower(trim(p_first_name))
      AND lower(trim(c.last_name)) = lower(trim(p_last_name))
      AND c.grade = p_grade
      AND c.scope = ANY (p_scopes)
      AND c.deleted_at IS NULL
      AND (p_exclude_child_id IS NULL OR c.id <> p_exclude_child_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_child(p_child_id uuid)
 RETURNS parent_child_relationships
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    current_user_id UUID;
    caller_is_parent BOOLEAN;
    has_links BOOLEAN;
    relationship public.parent_child_relationships;
BEGIN
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = current_user_id
          AND role = 'parent'
          AND approved = true
    ) INTO caller_is_parent;

    IF NOT caller_is_parent THEN
        RAISE EXCEPTION 'Only approved parents can claim a child';
    END IF;

    -- Lock the child row so two concurrent first claims can't both become
    -- primary. A deleted child can't be claimed.
    PERFORM 1 FROM public.children
    WHERE id = p_child_id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Child not found';
    END IF;

    SELECT * INTO relationship
    FROM public.parent_child_relationships
    WHERE child_id = p_child_id
      AND parent_id = current_user_id;

    IF FOUND THEN
        RETURN relationship;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.parent_child_relationships
        WHERE child_id = p_child_id
    ) INTO has_links;

    INSERT INTO public.parent_child_relationships (parent_id, child_id, is_primary)
    VALUES (current_user_id, p_child_id, NOT has_links)
    RETURNING * INTO relationship;

    RETURN relationship;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_track_draft(p_child_id uuid, p_track_number integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.children
        WHERE id = p_child_id AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Child not found';
    END IF;

    UPDATE public.children
    SET track_number_draft = p_track_number, updated_at = now()
    WHERE id = p_child_id
      AND deleted_at IS NULL
      AND (
          id = public.my_linked_child_id()
          OR EXISTS (
              SELECT 1 FROM public.parent_child_relationships pcr
              WHERE pcr.child_id = p_child_id
                AND pcr.parent_id = auth.uid()
          )
      );

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Not allowed to set this student''s draft track';
    END IF;
END;
$function$;

-- 5. Child accounts ----------------------------------------------------------

-- A deleted student no longer identifies its (cleared) login, so the
-- child-user RLS policies stop matching it.
CREATE OR REPLACE FUNCTION public.my_linked_child_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT c.id
    FROM public.children c
    WHERE c.user_id = auth.uid()
      AND c.deleted_at IS NULL
      AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = 'child'
            AND ur.approved = true
      );
$function$;

CREATE OR REPLACE FUNCTION public.approve_child_account(p_user_id uuid, p_child_id uuid DEFAULT NULL::uuid, p_first_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text, p_grade integer DEFAULT NULL::integer, p_group_number integer DEFAULT 1, p_scope text DEFAULT 'prod'::text)
 RETURNS children
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    linked children;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only admins can approve child accounts';
    END IF;

    -- child is exclusive: no other approved role may remain.
    IF EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND approved = true AND role <> 'child'
    ) THEN
        RAISE EXCEPTION 'User holds another approved role; child cannot be combined with other roles';
    END IF;

    -- Deleted students have their link cleared; the filter is belt and braces.
    IF EXISTS (
        SELECT 1 FROM public.children
        WHERE user_id = p_user_id
          AND deleted_at IS NULL
          AND (p_child_id IS NULL OR id <> p_child_id)
    ) THEN
        RAISE EXCEPTION 'User is already linked to another student';
    END IF;

    IF p_child_id IS NOT NULL THEN
        UPDATE public.children
        SET user_id = p_user_id, updated_at = now()
        WHERE id = p_child_id
          AND deleted_at IS NULL
          AND (user_id IS NULL OR user_id = p_user_id)
        RETURNING * INTO linked;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Student not found or already linked to another account';
        END IF;
    ELSE
        IF p_first_name IS NULL OR p_last_name IS NULL OR p_grade IS NULL THEN
            RAISE EXCEPTION 'Pass either p_child_id or the new student''s name and grade';
        END IF;

        INSERT INTO public.children (
            first_name, last_name, grade, group_number, scope, created_by, user_id
        )
        VALUES (
            p_first_name, p_last_name, p_grade, p_group_number, p_scope,
            auth.uid(), p_user_id
        )
        RETURNING * INTO linked;
    END IF;

    -- Replace any pending requests with the approved child role.
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id AND approved = false;

    INSERT INTO public.user_roles (user_id, role, approved)
    VALUES (p_user_id, 'child', true)
    ON CONFLICT (user_id, role) DO UPDATE SET approved = true;

    RETURN linked;
END;
$function$;

-- 6. A parent removing a child -----------------------------------------------
-- Not the last link: remove only the caller's link (unchanged).
-- The last link: keep it, and soft-delete the child (the guard trigger
-- stamps now()/auth.uid() and clears user_id).

CREATE OR REPLACE FUNCTION public.remove_child_for_parent(p_child_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock the child row so two parents unlinking at the same time can't
    -- each see the other's link still present and leave an orphan child.
    PERFORM 1 FROM public.children
    WHERE id = p_child_id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Child not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.parent_child_relationships
        WHERE child_id = p_child_id
          AND parent_id = current_user_id
    ) THEN
        RAISE EXCEPTION 'You are not linked to this child';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.parent_child_relationships
        WHERE child_id = p_child_id
          AND parent_id <> current_user_id
    ) THEN
        DELETE FROM public.parent_child_relationships
        WHERE child_id = p_child_id
          AND parent_id = current_user_id;
    ELSE
        UPDATE public.children
        SET deleted_at = now()
        WHERE id = p_child_id;
    END IF;
END;
$function$;

-- 7. children_with_parents exposes deleted_at --------------------------------
-- Same columns as before, deleted_at appended last (CREATE OR REPLACE VIEW
-- may only add columns at the end; it keeps the grants).

CREATE OR REPLACE VIEW public.children_with_parents
WITH (security_invoker = true) AS
SELECT c.id,
    c.first_name,
    c.last_name,
    c.grade,
    c.group_number,
    c.created_at,
    c.updated_at,
    c.scope,
    c.track_number_draft,
    c.track_number_committed,
    COALESCE(
        json_agg(json_build_object(
            'user_id', u.id,
            'email', u.email,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'is_primary', pcr.is_primary
        )) FILTER (WHERE u.id IS NOT NULL),
        '[]'::json
    ) AS parents,
    c.deleted_at
FROM public.children c
LEFT JOIN public.parent_child_relationships pcr ON c.id = pcr.child_id
LEFT JOIN public.users u ON pcr.parent_id = u.id
GROUP BY c.id, c.first_name, c.last_name, c.grade, c.group_number, c.scope,
    c.created_at, c.updated_at, c.track_number_draft, c.track_number_committed,
    c.deleted_at;

COMMIT;

-- Verification (run manually after applying) ---------------------------------
-- 1. As a parent, a direct soft delete is rejected (42501):
--    UPDATE children SET deleted_at = now() WHERE id = '<own child id>';
-- 2. As staff, a soft delete stamps server time/caller and clears the login:
--    UPDATE children SET deleted_at = '2000-01-01' WHERE id = '<id>'
--    RETURNING deleted_at, deleted_by, user_id;   -- now(), auth.uid(), NULL
-- 3. The deleted child drops out of the RPCs:
--    SELECT count(*) FROM get_children_with_parent_status() WHERE id = '<id>';  -- 0
--    SELECT * FROM find_child_matches('<first>', '<last>', <grade>, '{prod,test}');
--    SELECT claim_child('<id>');                                  -- Child not found
-- 4. remove_child_for_parent on the last link keeps the link:
--    SELECT * FROM parent_child_relationships WHERE child_id = '<id>';  -- still there
-- 5. children_with_parents exposes deleted_at:
--    SELECT id, deleted_at FROM children_with_parents LIMIT 1;
