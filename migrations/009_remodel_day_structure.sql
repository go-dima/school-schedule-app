-- Migration: 009_remodel_day_structure
-- Description: Remodel structure to move day information from time_slots to classes
-- Author: System
-- Date: Current session

-- Step 1: Add day_of_week column to classes table
ALTER TABLE public.classes ADD COLUMN day_of_week INTEGER;

-- Step 2: Migrate data from time_slots.day_of_week to classes.day_of_week
-- This will set the day_of_week for each class based on its time slot
UPDATE public.classes 
SET day_of_week = ts.day_of_week
FROM public.time_slots ts 
WHERE classes.time_slot_id = ts.id;

-- Step 3: Make day_of_week NOT NULL after data migration
ALTER TABLE public.classes ALTER COLUMN day_of_week SET NOT NULL;

-- Step 4: Add constraint to ensure day_of_week is valid (0=Sunday through 6=Saturday)
ALTER TABLE public.classes ADD CONSTRAINT classes_day_of_week_valid 
  CHECK (day_of_week >= 0 AND day_of_week <= 6);

-- Step 5: Remove day_of_week column from time_slots table
ALTER TABLE public.time_slots DROP COLUMN day_of_week;

-- Step 6: Update indexes
-- Drop the old index on time_slots that included day_of_week
DROP INDEX IF EXISTS idx_time_slots_day_time;

-- Create new index on time slots without day
CREATE INDEX idx_time_slots_time ON public.time_slots(start_time);

-- Create new index on classes including day_of_week
CREATE INDEX idx_classes_day_time ON public.classes(day_of_week, time_slot_id);

-- Step 7: Remove unique constraint on time_slots that included day_of_week
-- Find and drop the constraint (it might have a generated name)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find constraint name
    SELECT conname INTO constraint_name 
    FROM pg_constraint 
    WHERE conrelid = 'public.time_slots'::regclass 
    AND contype = 'u'  -- unique constraint
    AND array_length(conkey, 1) = 3;  -- assuming it had 3 columns
    
    -- Drop constraint if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.time_slots DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- Create new unique constraint on time_slots without day_of_week
-- This ensures each time period (name, start_time, end_time) is unique
ALTER TABLE public.time_slots ADD CONSTRAINT time_slots_unique_period 
  UNIQUE(name, start_time, end_time);

-- Step 8: Add comments for clarity
COMMENT ON COLUMN public.classes.day_of_week IS 'Day of week for the class: 0=Sunday, 1=Monday, etc.';
COMMENT ON TABLE public.time_slots IS 'Time periods that are independent of days - classes reference both time_slots and specify their own day_of_week';