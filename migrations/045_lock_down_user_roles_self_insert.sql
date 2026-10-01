-- Migration: 045_lock_down_user_roles_self_insert
-- Description: Close a privilege escalation on user_roles.
--   The live DB's self-insert policy is user_roles_insert_own:
--       WITH CHECK ((user_id = auth.uid()) OR (auth.role() = 'service_role'))
--   It checks neither `approved` nor `role`, so any signed-in user can insert
--   { role: 'admin', approved: true } for themselves straight through the
--   API, and is_admin() then passes for them. (002's "Users can request
--   roles", which did check approved = false, isn't on the live DB.)
--
--   Replaced by one self-request policy: your own row, unapproved, and only
--   a role a user may ask for (parent/staff/child, mirroring
--   REQUESTABLE_ROLES in src/constants/roles.ts once that lands; parent is
--   the only role the app requests today).
--
--   Unchanged paths:
--     - signup: ensureUserProfile inserts { role: 'parent', approved: false }.
--     - admin grants (User Management, Pending Approvals) go through
--       user_roles_admin_insert_all (WITH CHECK is_admin()).
--     - service_role bypasses RLS, and also has
--       user_roles_service_role_access.
--   Policies are OR'd, so the loose policy has to be dropped; adding a
--   stricter one next to it would change nothing.
-- Author: System
-- Date: 2026-10-01

BEGIN;

DROP POLICY IF EXISTS user_roles_insert_own ON public.user_roles;
DROP POLICY IF EXISTS "Users can request roles" ON public.user_roles;

CREATE POLICY "Users can request roles" ON public.user_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND
        approved = false AND
        role IN ('parent', 'staff', 'child')
    );

COMMIT;
