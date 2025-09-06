-- Migration: 009_remodel_day_structure
-- Description: Safely remodel structure to move day information from time_slots to classes
-- Author: System
-- Date: Current session

BEGIN;

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

-- Step 5: Update foreign key references BEFORE deleting duplicates
-- Update classes to reference the kept time slots (day 0 versions)
UPDATE classes SET time_slot_id = '4c2b78df-7f9a-4125-8ee0-4806f29fde94' WHERE id = '45eb7bf0-0e29-46fd-b4fb-bcc303ec473f';
UPDATE classes SET time_slot_id = '4c2b78df-7f9a-4125-8ee0-4806f29fde94' WHERE id = '606587f6-726c-4672-bf5e-0fc85c5a453a';
UPDATE classes SET time_slot_id = '588d549f-7ca6-471d-adbc-1dd075c80c56' WHERE id = 'f50ecb99-25ec-4927-b887-a6e47e986b8c';
UPDATE classes SET time_slot_id = '588d549f-7ca6-471d-adbc-1dd075c80c56' WHERE id = '450e61c9-3f35-444a-aca1-b9d9a9279707';

-- Step 6: Remove day_of_week column from time_slots table
ALTER TABLE public.time_slots DROP COLUMN day_of_week;

-- Step 7: Delete duplicate time slots (keeping day 0 version of each pattern)
-- This removes 48 duplicate records, keeping 12 unique time periods
DELETE FROM public.time_slots 
WHERE id NOT IN (
    -- Keep these 12 time slots (day 0 versions)
    '6593ddf1-0ef1-4fa8-ab75-0199bed66900', -- מפגש בוקר 08:30-09:00
    'cf049434-1773-4afe-b404-64fcd1f5efa9', -- הפסקת אוכל 09:00-09:15
    '4c2b78df-7f9a-4125-8ee0-4806f29fde94', -- שיעור ראשון 09:15-09:55
    'e710e27a-c29c-4edd-9ba2-3fcedd6fd80f', -- שיעור שני 09:55-10:30
    '99d78589-86ff-478e-8e78-bb6360fe09ce', -- הפסקה 10:30-11:00
    '588d549f-7ca6-471d-adbc-1dd075c80c56', -- שיעור שלישי 11:00-11:45
    '6d4b677f-c48d-4d83-b0d8-67959eeb47c1', -- שיעור רביעי 11:45-12:20
    '77e2351e-39d5-498f-9a18-469c88099c3c', -- הפסקה קטנה 12:20-12:30
    '12f9e127-2086-4f19-8c1b-35f7721ff158', -- מפגש צהריים 12:30-12:45
    '20031dea-db6c-42a3-a0b1-e18c03bc08bc', -- ארוחת צהריים 12:45-13:30
    'ed15ad65-14a4-4447-b453-ddfa9082a49a', -- שיעור חמישי 13:30-14:15
    '4feba7d9-573e-43b4-b3d5-9c0c6394283d'  -- שיעור שישי 14:15-15:00
);

-- Step 8: Update indexes
-- Drop the old index on time_slots that included day_of_week
DROP INDEX IF EXISTS idx_time_slots_day_time;

-- Create new index on time slots without day
CREATE INDEX idx_time_slots_time ON public.time_slots(start_time);

-- Create new index on classes including day_of_week
CREATE INDEX idx_classes_day_time ON public.classes(day_of_week, time_slot_id);

-- Step 9: Remove old unique constraint on time_slots that included day_of_week
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

-- Step 10: Add new unique constraint on the deduplicated time_slots
ALTER TABLE public.time_slots ADD CONSTRAINT time_slots_unique_period 
  UNIQUE(start_time, end_time);

-- Step 11: Add comments for clarity
COMMENT ON COLUMN public.classes.day_of_week IS 'Day of week for the class: 0=Sunday, 1=Monday, etc.';
COMMENT ON TABLE public.time_slots IS 'Time periods that are independent of days - classes reference both time_slots and specify their own day_of_week';

-- Step 12: Verification queries (will show results)
SELECT 'Time slots after migration:' as info, COUNT(*) as count FROM time_slots;
SELECT 'Classes with valid time slot references:' as info, COUNT(*) as count FROM classes c 
    JOIN time_slots ts ON c.time_slot_id = ts.id;

COMMIT;