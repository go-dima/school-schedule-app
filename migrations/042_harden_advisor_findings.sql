-- Migration: 042_harden_advisor_findings
-- Description: Clear the remaining Supabase Security Advisor warnings that are
--   fixable in schema. Like 026 and 027, this is permission tightening only:
--   no logic change, and no change for any signed-in user path.
--     - anon_security_definer_function_executable: seven SECURITY DEFINER
--       functions still carry Postgres's default EXECUTE grant to PUBLIC (and
--       Supabase's explicit grant to anon). Every one of them already checks
--       auth.uid() / the caller's role, so anon gets nothing useful out of
--       them, but there is no reason for anon to be able to call them at all.
--       REVOKE ... FROM PUBLIC also drops authenticated's inherited grant, so
--       the six RPC / RLS-policy helpers are explicitly re-granted to
--       authenticated.
--     - sync_last_sign_in_at() is a trigger function on auth.users (029).
--       Postgres checks EXECUTE on a trigger function only when the trigger is
--       created, not when it fires, so it is revoked from authenticated too --
--       no one should be calling it through /rpc.
--     - function_search_path_mutable: validate_time_slot() (036) and
--       is_admin_or_moderator() (041) were created without SET search_path.
--       Pinning it follows the convention from 026; no behavior change, since
--       both bodies already fully qualify their public.* references.
--     - pg_graphql_anon_table_exposed on schedule_overrides: both RLS policies
--       from 037 key on auth.uid(), so anon already gets zero rows. Revoking
--       anon SELECT just stops advertising schema shape (same as 026
--       Finding 3).
--   The remaining authenticated_security_definer_function_executable warnings
--   are intended: those functions are the app's RPCs and RLS helpers.
-- Author: System
-- Date: 2026-09-24

BEGIN;

-- anon_security_definer_function_executable: remove anon/PUBLIC EXECUTE.
REVOKE EXECUTE ON FUNCTION public.claim_child(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_child_with_relationship(text, text, integer, integer, text, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_class_enrollment_count(uuid, class_scope) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_class_enrollment_counts(class_scope) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_moderator() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_last_sign_in_at() FROM PUBLIC, anon, authenticated;

-- Keep signed-in paths unchanged: RPCs called from src/services/api.ts and
-- the helpers used inside RLS policies (evaluated as the calling role).
GRANT EXECUTE ON FUNCTION public.claim_child(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_child_with_relationship(text, text, integer, integer, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_enrollment_count(uuid, class_scope) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_enrollment_counts(class_scope) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_moderator() TO authenticated;

-- function_search_path_mutable: pin search_path (026 convention).
ALTER FUNCTION public.validate_time_slot() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin_or_moderator() SET search_path = public, pg_temp;

-- pg_graphql_anon_table_exposed: RLS already returns zero rows to anon.
REVOKE SELECT ON public.schedule_overrides FROM anon;

COMMIT;
