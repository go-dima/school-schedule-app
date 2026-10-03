-- Migration: 049_allow_multiple_parents
-- Description: Let a second (third, ...) approved parent link themselves to a
--   child another parent already added, through the normal add-child flow
--   (add child -> enter details -> "add me as parent"). There is no invite
--   step; admin approval of accounts is the only guard (accepted trade-off).
--     - find_child_matches: the client-side duplicate check
--       (findLocalDuplicateChildren) was a plain RLS-subject SELECT, and the
--       parent SELECT policies (013, 033) hide children already linked to
--       another family. Parent B adding a child parent A already added got
--       zero matches and silently created a second record. This SECURITY
--       DEFINER function looks past RLS but returns only what the duplicate
--       dialog needs (id, grade, creator name, whether any parent is linked
--       and that parent's name, whether the caller is already linked). A
--       child can be staff-created AND have a parent, so creator and parent
--       are reported separately, each with display_name (043) so the client
--       can name them like everywhere else (formatPersonName). Names match with lower(trim(...)) equality, not
--       ilike, so '%' or '_' typed into a name can't act as wildcards. The
--       caller passes the scopes it may see (getAllowedScopes()), so a prod
--       parent never matches -- and links to -- a test-scope child.
--     - claim_child (031): no longer refuses a child that already has a
--       parent. It now means "link me as a parent": idempotent when the
--       caller is already linked, and the new link is primary only when it
--       is the child's first link (so the StudentsPage claim flow for
--       staff-created, unclaimed children behaves exactly as before).
--     - remove_child_for_parent: for a parent, deleting a child now means
--       removing their own link. The children row (and, by cascade, its
--       schedule selections) is deleted only when the last parent link is
--       removed. Both steps run in one function so they happen together.
-- Author: System
-- Date: 2026-10-03
--
-- NOTE: This migration is run manually (Supabase SQL editor / psql), not by
-- an automated migration runner. It is NOT executed as part of this change.

BEGIN;

-- 1) Duplicate lookup that can see children linked to other families.
CREATE OR REPLACE FUNCTION public.find_child_matches(
    p_first_name text,
    p_last_name text,
    p_grade integer,
    p_scopes text[],
    p_exclude_child_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    grade integer,
    created_by uuid,
    creator_first_name text,
    creator_last_name text,
    creator_display_name text,
    parent_first_name text,
    parent_last_name text,
    parent_display_name text,
    has_parent boolean,
    linked_to_me boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
      AND (p_exclude_child_id IS NULL OR c.id <> p_exclude_child_id);
END;
$$;

-- 2) claim_child becomes "link me as a parent". Same signature as 031, so
--    CREATE OR REPLACE keeps the grants from 042.
CREATE OR REPLACE FUNCTION public.claim_child(p_child_id UUID)
RETURNS public.parent_child_relationships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    -- primary.
    PERFORM 1 FROM public.children WHERE id = p_child_id FOR UPDATE;
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
$$;

-- 3) A parent removes their own link; the child goes with the last link.
CREATE OR REPLACE FUNCTION public.remove_child_for_parent(p_child_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock the child row so two parents unlinking at the same time can't
    -- each see the other's link still present and leave an orphan child.
    PERFORM 1 FROM public.children WHERE id = p_child_id FOR UPDATE;

    DELETE FROM public.parent_child_relationships
    WHERE child_id = p_child_id
      AND parent_id = current_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'You are not linked to this child';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.parent_child_relationships
        WHERE child_id = p_child_id
    ) THEN
        DELETE FROM public.children WHERE id = p_child_id;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.find_child_matches(text, text, integer, text[], uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_child_for_parent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_child_matches(text, text, integer, text[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_child_for_parent(uuid) TO authenticated;

COMMIT;
