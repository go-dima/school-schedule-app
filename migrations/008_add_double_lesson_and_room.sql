-- Migration: 008_add_double_lesson_and_room
-- Description: Add is_double and room columns to classes table for double lesson support and room assignment
-- Author: System
-- Date: Current session

-- Add is_double column to classes table with default false value
ALTER TABLE public.classes ADD COLUMN is_double BOOLEAN DEFAULT false NOT NULL;

-- Add room column to classes table with default empty string
ALTER TABLE public.classes ADD COLUMN room TEXT DEFAULT '' NOT NULL;

-- Update existing classes to have false is_double and empty room
UPDATE public.classes SET is_double = false WHERE is_double IS NULL;
UPDATE public.classes SET room = '' WHERE room IS NULL;

-- Add index for better performance when filtering by double lessons
CREATE INDEX idx_classes_is_double ON public.classes(is_double);

-- Add index for room searches (optional, but useful for admin queries)
CREATE INDEX idx_classes_room ON public.classes(room);

-- Comment on columns for clarity
COMMENT ON COLUMN public.classes.is_double IS 'Indicates if this lesson takes two consecutive time slots';
COMMENT ON COLUMN public.classes.room IS 'The room or location where the lesson takes place';