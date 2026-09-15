-- Migration: 035_allow_parents_view_committed_selections
-- Description: Issue #49 added a parent-facing read-only toggle to view a
--   child's committed (published) schedule, reusing the existing
--   status-generic scheduleApi.getSelectedSchedule/useSelectedSchedule path.
--   That path was blocked outright: 022_add_selection_status.sql's "Parents
--   can manage own children draft selections" policy is scoped to
--   status = 'draft' only, and no other policy on schedule_selections grants
--   parents SELECT on status = 'committed' rows (022's "Staff and admins can
--   view all selections" is role-gated to staff/admin). So toggling to the
--   committed view for a parent silently returned zero rows -- not a
--   frontend bug, a missing RLS grant. Adds an additive, read-only SELECT
--   policy so a parent can view (never write) their own children's committed
--   selections; RLS ORs multiple permissive policies for the same command,
--   so 022's write-scoped policy is untouched.
-- Author: System
-- Date: 2026-09-15

BEGIN;

CREATE POLICY "Parents can view own children committed selections" ON public.schedule_selections
    FOR SELECT
    TO authenticated
    USING (
        status = 'committed' AND
        child_id IN (
            SELECT child_id
            FROM public.parent_child_relationships
            WHERE parent_id = auth.uid()
        )
    );

COMMIT;
