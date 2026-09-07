-- Migration: 018_add_class_group_number
-- Description: Add a nullable group_number (מסלול) column to classes, matching the
--   1/2/NULL domain children already have. Also relax children.group_number to allow
--   NULL, since "no group" is now a valid state on both sides of the match. No backfill:
--   existing classes are left with group_number = NULL for the operator to set manually.
-- Author: System
-- Date: 2026-09-07

BEGIN;

-- Step 1: Add group_number to classes. Domain: 1, 2, or NULL (no group / מסלול).
ALTER TABLE public.classes
    ADD COLUMN group_number INTEGER CHECK (group_number IS NULL OR group_number IN (1, 2));

COMMENT ON COLUMN public.classes.group_number IS
    'מסלול: 1, 2, or NULL for no group. Matched against children.group_number for auto-assignment.';

-- Step 2: Relax children.group_number to allow NULL (representing "no group").
-- The existing CHECK (group_number IN (1, 2)) already permits NULL under Postgres's
-- NULL-is-vacuously-true CHECK semantics, so dropping NOT NULL is all that's needed.
ALTER TABLE public.children ALTER COLUMN group_number DROP NOT NULL;

COMMIT;
