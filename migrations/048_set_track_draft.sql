-- Migration: 048_set_track_draft
-- Description: One draft-track write path for parents and child users.
--   Replaces 047's set_own_track_draft(p_track_number), which only a child
--   user could call, with set_track_draft(p_child_id, p_track_number), which
--   the app calls for every draft-track change:
--     - a parent of that child (parent_child_relationships, the same rule as
--       the live "Parents can update own children" policy), or
--     - the child user linked to that student (my_linked_child_id(), 047).
--   It writes only track_number_draft. Child users still have no UPDATE on
--   children, so they can't change anything else. Committed tracks are
--   unchanged: staff/admin write track_number_committed directly.
--
--   Safe to apply before the app code: nothing on main calls
--   set_own_track_draft (it shipped with no caller), and parents' current
--   direct UPDATE path keeps working.
-- Author: System
-- Date: 2026-10-01

BEGIN;

DROP FUNCTION IF EXISTS public.set_own_track_draft(integer);

CREATE OR REPLACE FUNCTION public.set_track_draft(
    p_child_id uuid,
    p_track_number integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.children
    SET track_number_draft = p_track_number, updated_at = now()
    WHERE id = p_child_id
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
$$;

REVOKE EXECUTE ON FUNCTION public.set_track_draft(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_track_draft(uuid, integer) TO authenticated;

COMMIT;
