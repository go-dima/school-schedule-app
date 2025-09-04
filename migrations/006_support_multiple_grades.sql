-- Migration: 006_support_multiple_grades
-- Description: Change classes.grade from single integer to array of integers
-- Author: System
-- Date: Current session

-- Add new grades column (array of integers)
ALTER TABLE public.classes ADD COLUMN grades integer[] DEFAULT '{}';

-- Migrate existing data from grade to grades array
UPDATE public.classes SET grades = ARRAY[grade] WHERE grade IS NOT NULL;

-- Drop the old grade column
ALTER TABLE public.classes DROP COLUMN grade;

-- Add constraint to ensure grades array is not empty
ALTER TABLE public.classes ADD CONSTRAINT classes_grades_not_empty
  CHECK (array_length(grades, 1) > 0);

-- Add index for better performance when querying by grades
CREATE INDEX idx_classes_grades ON public.classes USING GIN (grades);