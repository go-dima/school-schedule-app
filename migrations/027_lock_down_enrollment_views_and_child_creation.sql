-- Migration: 027_lock_down_enrollment_views_and_child_creation
-- Description: Close out items surfaced by a follow-up Supabase Security
--   Advisor export, plus one residual gap found while re-reading the code
--   during that review:
--     - committed_enrollments (024_add_get_class_enrolled_children) was built
--       specifically to bypass RLS on schedule_selections for internal use by
--       the SECURITY DEFINER functions defined alongside it -- its own header
--       comment says it must never be granted to authenticated/anon. No
--       REVOKE was ever issued, though, and Supabase's public schema grants
--       SELECT to anon/authenticated on new relations by default unless
--       explicitly revoked. Result: anon could read every class's full
--       enrollment roster (child_id, class_id pairs) directly through
--       PostgREST, bypassing RLS entirely -- the advisor confirmed this live.
--     - classes_with_enrollment was anon-exposed from the very first advisor
--       export (016_add_enrollment_functions) and was never revoked; low
--       severity (aggregate counts only, no child-level data) but locked down
--       for consistency with restricting classes/time_slots to authenticated
--       (026_harden_visibility_and_search_path).
--     - create_child_with_relationship was redefined again in
--       023_split_track_draft_committed (gained p_status) and still lacks a
--       pinned search_path, missed when 026 addressed the same gap on
--       is_admin/get_class_enrollment_count(s).
--     - create_child_with_relationship also still only checked
--       auth.uid() IS NOT NULL, not an approved role. The original share-token
--       review recommended an approved-role check here too, but the fix that
--       shipped (019_drop_child_sharing) explicitly left this function
--       untouched, scoped to removing the sharing feature only. Any
--       freshly-signed-up, not-yet-approved account could still create child
--       records. Checked actual callers (src/services/api.ts createChild(),
--       called from both StudentSearchSelector.tsx and
--       StudentsPage.tsx/useChildren.ts) before deciding the check should
--       allow approved parent, staff, or admin -- parents create their own
--       children, staff/admin create children directly from roster/class-
--       selection tooling.
-- Author: System
-- Date: 2026-09-10

BEGIN;

-- committed_enrollments must never be reachable by anon/authenticated -- it
-- deliberately bypasses RLS on schedule_selections for internal use only by
-- the SECURITY DEFINER functions defined alongside it.
REVOKE ALL ON public.committed_enrollments FROM PUBLIC, anon, authenticated;

-- classes_with_enrollment: same anon lockdown as classes/time_slots, keeping
-- authenticated access (aggregate enrollment counts, no PII).
REVOKE SELECT ON public.classes_with_enrollment FROM anon;

-- create_child_with_relationship: pin search_path and add the approved-role
-- check. Signature and return type are unchanged from
-- 023_split_track_draft_committed, so CREATE OR REPLACE keeps existing grants.
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

  INSERT INTO children (
    first_name, last_name, grade, group_number, scope,
    track_number_draft, track_number_committed
  )
  VALUES (
    p_first_name, p_last_name, p_grade, p_group_number, p_scope,
    CASE WHEN p_status = 'draft' THEN p_track_number ELSE NULL END,
    CASE WHEN p_status = 'committed' THEN p_track_number ELSE NULL END
  )
  RETURNING * INTO new_child;

  INSERT INTO parent_child_relationships (parent_id, child_id, is_primary)
  VALUES (current_user_id, new_child.id, true);

  RETURN new_child;
END;
$$;

COMMIT;
