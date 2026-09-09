-- Migration: 019_drop_child_sharing
-- Description: Remove the child-sharing feature entirely. A security review found
--   that the "Anyone can view valid share tokens" RLS policy on child_share_tokens
--   let any caller -- including anonymous, unauthenticated ones -- list every live
--   share token in the system, and accept_shared_child() only checked that the
--   caller was logged in, not that they were the token's intended recipient.
--   Chained together, this let anyone harvest a live token, sign up for a free
--   account, and redeem it to become a parent of someone else's child. The feature
--   isn't needed right now, so instead of narrowing the RLS policy, it is dropped
--   entirely. parent_child_relationships and create_child_with_relationship are
--   unrelated to sharing and are left untouched.
-- Author: System
-- Date: 2026-09-09

BEGIN;

DROP FUNCTION IF EXISTS public.accept_shared_child(TEXT);
DROP FUNCTION IF EXISTS public.generate_child_share_token(UUID, INTEGER);

-- Dropping the table also drops its indexes and RLS policies.
DROP TABLE IF EXISTS public.child_share_tokens;

COMMIT;
