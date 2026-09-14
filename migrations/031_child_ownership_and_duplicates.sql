-- Migration: 031_child_ownership_and_duplicates
-- Description: Stop staff/admin accounts from being silently linked as a
--   child's "parent" when they create a child record, and add provenance so
--   the app can tell who actually created a child regardless of whether that
--   person is a real parent.
--     - create_child_with_relationship (last touched in
--       027_lock_down_enrollment_views_and_child_creation) unconditionally
--       inserted a parent_child_relationships row for the caller, even when
--       the caller was staff/admin creating a child from roster tooling, not
--       an actual parent. That silently mislabeled staff/admin as the
--       child's parent.
--     - children.created_by is added to record who created the row,
--       independent of parent_child_relationships, so the UI can show real
--       provenance (Task 3/7) and so a local duplicate-detection query (Task
--       4) can reason about "children this account created" even when no
--       parent link exists.
--     - Existing children are backfilled from their current primary
--       parent_child_relationships row -- this reflects who actually created
--       the record historically, whether or not that person turns out to be
--       staff/admin.
--     - Existing parent_child_relationships rows that wrongly link a
--       staff/admin (who is not also an approved parent) are deleted. Those
--       children become "claimable" via the new claim_child RPC, which lets
--       an approved parent attach themselves to a parentless child.
-- Author: System
-- Date: 2026-09-14
--
-- NOTE: This migration is run manually (Supabase SQL editor / psql), not by
-- an automated migration runner. It is NOT executed as part of this change.

BEGIN;

-- 1) Provenance column: who actually created this child record.
ALTER TABLE public.children
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);

-- 2) Backfill created_by for ALL existing children from their current
--    primary parent_child_relationships row, unconditionally -- this is
--    valid data (it reflects who actually created the record) regardless
--    of whether that person turns out to be a real parent or staff/admin.
UPDATE public.children c
SET created_by = pcr.parent_id
FROM public.parent_child_relationships pcr
WHERE pcr.child_id = c.id
  AND pcr.is_primary = true
  AND c.created_by IS NULL;

-- 3) Clean up bad parent links: remove parent_child_relationships rows
--    where the linked "parent" is staff/admin and is NOT also an approved
--    parent in their own right (this guards the rare multi-role
--    staff-who-is-also-a-parent user from losing their own real link).
DELETE FROM public.parent_child_relationships pcr
WHERE EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = pcr.parent_id
      AND ur.role IN ('staff', 'admin')
      AND ur.approved = true
)
AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = pcr.parent_id
      AND ur2.role = 'parent'
      AND ur2.approved = true
);

-- 4) Going forward: record created_by for every new child, and only link
--    the caller as parent (parent_child_relationships) if they actually are
--    an approved parent. Signature is unchanged from
--    027_lock_down_enrollment_views_and_child_creation (confirmed by
--    reading that migration directly), so CREATE OR REPLACE keeps existing
--    grants.
CREATE OR REPLACE FUNCTION public.create_child_with_relationship(
  p_first_name text,
  p_last_name text,
  p_grade integer,
  p_group_number integer DEFAULT 1,
  p_scope text DEFAULT 'prod',
  p_track_number integer DEFAULT NULL,
  p_status text DEFAULT 'draft'
)
RETURNS children
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_child children;
  current_user_id uuid;
  caller_is_parent boolean;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = current_user_id
      AND approved = true
      AND role IN ('parent', 'staff', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only approved parents, staff, or admins can add children';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = current_user_id
      AND role = 'parent'
      AND approved = true
  ) INTO caller_is_parent;

  INSERT INTO children (
    first_name, last_name, grade, group_number, scope,
    track_number_draft, track_number_committed, created_by
  )
  VALUES (
    p_first_name, p_last_name, p_grade, p_group_number, p_scope,
    CASE WHEN p_status = 'draft' THEN p_track_number ELSE NULL END,
    CASE WHEN p_status = 'committed' THEN p_track_number ELSE NULL END,
    current_user_id
  )
  RETURNING * INTO new_child;

  -- Only link the caller as a parent if they actually are one. A
  -- staff/admin creating a child from roster tooling is recorded via
  -- created_by above but is NOT registered as the child's parent.
  IF caller_is_parent THEN
    INSERT INTO parent_child_relationships (parent_id, child_id, is_primary)
    VALUES (current_user_id, new_child.id, true);
  END IF;

  RETURN new_child;
END;
$$;

-- 5) Claim flow: an approved parent can attach themselves to a
--    staff/admin-created child that has no parent linked yet (i.e. the
--    children left parentless by step 3's cleanup, and any created going
--    forward by staff/admin via create_child_with_relationship above).
CREATE OR REPLACE FUNCTION public.claim_child(p_child_id UUID)
RETURNS public.parent_child_relationships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_user_id UUID;
    caller_is_parent BOOLEAN;
    existing_relationship_count INTEGER;
    new_relationship public.parent_child_relationships;
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

    SELECT COUNT(*) INTO existing_relationship_count
    FROM public.parent_child_relationships
    WHERE child_id = p_child_id;

    IF existing_relationship_count > 0 THEN
        RAISE EXCEPTION 'This child already has a linked parent and cannot be claimed';
    END IF;

    INSERT INTO public.parent_child_relationships (parent_id, child_id, is_primary)
    VALUES (current_user_id, p_child_id, true)
    RETURNING * INTO new_relationship;

    RETURN new_relationship;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_child(UUID) TO authenticated;

-- 6) Staff/admin SELECT access on children: the only SELECT policy on
--    public.children is the parent-scoped one from
--    013_add_children_management.sql (a parent can only see children they
--    are linked to via parent_child_relationships). Staff/admin already
--    have UPDATE (021_allow_staff_update_children.sql) and DELETE
--    (025_allow_staff_delete_children.sql) policies on this table, but no
--    SELECT policy, so staff/admin can only ever see 0 rows here -- which
--    breaks the local duplicate-detection query (Task 4) for staff/admin
--    callers entirely, and after step 3 above removes their bogus parent
--    links, silently breaks anything else that expects staff/admin to be
--    able to read children. This adds an additive admin-or-staff SELECT
--    policy, following the exact same convention as the UPDATE/DELETE
--    policies above, leaving the parent policy untouched -- RLS ORs
--    multiple permissive policies for the same command.
CREATE POLICY "Staff and admins can view all children" ON public.children
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'staff')
              AND ur.approved = true
        )
    );

COMMIT;

-- ---------------------------------------------------------------------
-- Post-migration verification (run manually, eyeball the output --- NOT
-- executed as part of this migration):
--
-- SELECT
--     (SELECT COUNT(*) FROM public.children) AS total_children,
--     (SELECT COUNT(DISTINCT child_id) FROM public.parent_child_relationships) AS children_with_parent,
--     (SELECT COUNT(*) FROM public.children)
--       - (SELECT COUNT(DISTINCT child_id) FROM public.parent_child_relationships) AS children_without_parent;
--
-- Sanity expectation: children_without_parent should roughly equal the
-- number of children that were only ever linked to a staff/admin account
-- (the ones step 3 above just cleaned up) -- these are now the pool of
-- "claimable" children. Get this output back before continuing to Task 3,
-- since Task 4's local duplicate query and Task 7's "created by" UI both
-- depend on created_by actually being populated.
-- ---------------------------------------------------------------------
