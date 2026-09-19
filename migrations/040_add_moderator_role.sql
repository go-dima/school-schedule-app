-- Migration: 040_add_moderator_role
-- Description: Add 'moderator' to the user_role enum (issue #144). This must
--   run as its own migration/transaction: Postgres forbids using a newly
--   added enum value in the same transaction that adds it, so migrations
--   041 and 042 (which grant moderator access via RLS) must be applied
--   as separate, later statements/transactions, never merged into this one.
-- Author: System
-- Date: 2026-09-18

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'moderator';
