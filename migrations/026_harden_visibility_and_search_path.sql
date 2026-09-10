-- Migration: 026_harden_visibility_and_search_path
-- Description: Close out the remaining low-severity items from the Supabase
--   Security Advisor review (Findings 3, 4, 5 -- Findings 1 and 2 were already
--   fixed by 019_drop_child_sharing and 020_fix_children_roster_permissions).
--   All changes here are permission tightening with no logic change and no
--   functional impact on any real user path:
--     - Finding 3: children / parent_child_relationships / schedule_selections /
--       user_roles / users are all still queryable by anon at the GraphQL/REST
--       schema level, but RLS already returns zero rows to anon on every one of
--       them (auth.uid() is NULL for anonymous callers, matching none of their
--       policies). Revoking anon SELECT just stops advertising schema shape --
--       no anon caller ever got real rows from these.
--     - Finding 4: classes and time_slots have "everyone can view" policies
--       that (unlike Finding 3's tables) apply to anon too, so the full
--       curriculum is currently readable with no login. Confirmed with product
--       owner there is no pre-login schedule view planned, so restrict both to
--       authenticated only.
--     - Finding 5: is_admin(), get_class_enrollment_count(s) predate the
--       SET search_path convention later migrations (023, 024) already
--       adopted for new SECURITY DEFINER functions. Pinning it here is a
--       no-op behaviorally since all three already fully schema-qualify their
--       references. is_admin_user() is an orphaned duplicate of is_admin(),
--       created out-of-band and never referenced in migrations/ or src/ --
--       confirmed via a live-DB check (pg_proc, pg_rewrite/pg_depend, and
--       pg_policies all came back clean) that nothing depends on it. Safe to
--       drop.
-- Author: System
-- Date: 2026-09-10

BEGIN;

-- Finding 3: stop advertising schema shape to anon for tables where RLS
-- already returns zero rows to unauthenticated callers.
REVOKE SELECT ON public.children FROM anon;
REVOKE SELECT ON public.parent_child_relationships FROM anon;
REVOKE SELECT ON public.schedule_selections FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;
REVOKE SELECT ON public.users FROM anon;

-- Finding 4: no pre-login schedule view exists or is planned -- restrict
-- classes/time_slots to signed-in users only.
DROP POLICY IF EXISTS "Everyone can view time slots" ON public.time_slots;
CREATE POLICY "Signed-in users can view time slots" ON public.time_slots
    FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.time_slots FROM anon;

DROP POLICY IF EXISTS "Everyone can view classes" ON public.classes;
CREATE POLICY "Signed-in users can view classes" ON public.classes
    FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.classes FROM anon;

-- Finding 5: pin search_path on the functions that predate this convention.
-- No behavior change -- all three already fully schema-qualify their refs.
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_class_enrollment_count(uuid, class_scope) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_class_enrollment_counts(class_scope) SET search_path = public, pg_temp;

-- Orphaned duplicate of is_admin(), created out-of-band. Confirmed via live-DB
-- checks (pg_proc, pg_rewrite/pg_depend, pg_policies) that nothing references
-- it, and it does not appear anywhere in migrations/ or src/.
DROP FUNCTION IF EXISTS public.is_admin_user();

COMMIT;
