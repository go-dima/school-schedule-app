-- Migration: 007_add_scope_to_classes
-- Description: Add scope column to classes table for test/prod separation
-- Author: System
-- Date: Current session

-- Create enum for class scope
DO $$ BEGIN
    CREATE TYPE class_scope AS ENUM ('test', 'prod');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add scope column to classes table with default 'test' value
ALTER TABLE public.classes ADD COLUMN scope class_scope DEFAULT 'test' NOT NULL;

-- Update existing classes to have 'test' scope
UPDATE public.classes SET scope = 'test' WHERE scope IS NULL;

-- Add index for better performance when filtering by scope
CREATE INDEX idx_classes_scope ON public.classes(scope);