-- Migration: 036_update_time_slots_schedule
-- Description: Update the school's daily time slots to match the new
--   published schedule: rename הפסקת אוכל ->
--   ארוחת בוקר (09:00-09:10, was 09:00-09:15) and הפסקה -> הפסקה גדולה
--   (unchanged 10:30-11:00), and retime the four surrounding lesson slots
--   (שיעור ראשון/שני/שלישי/רביעי) that shift by 5-10 minutes to make room.
--   All rows are matched and updated in place by their existing `name` (no
--   deletes/inserts), so classes.time_slot_id references -- and the
--   ON DELETE CASCADE on that FK -- are never touched.
--
--   validate_time_slot() (003_triggers_functions.sql) still referenced
--   NEW.day_of_week, a column 009_remodel_day_structure.sql dropped from
--   time_slots; any INSERT/UPDATE on time_slots has been erroring since
--   migration 009. This migration also fixes that function (drops the
--   day_of_week check, and checks for overlaps table-wide instead of
--   per-day, matching time_slots' current day-independent
--   time_slots_unique_period(start_time, end_time) constraint from 009) so
--   the UPDATEs below -- and any future admin edit via the UI -- can
--   actually run.
-- Author: System
-- Date: 2026-09-16

BEGIN;

-- Fix validate_time_slot(): time_slots no longer has day_of_week (009).
CREATE OR REPLACE FUNCTION validate_time_slot()
RETURNS trigger AS $$
BEGIN
    IF NEW.start_time >= NEW.end_time THEN
        RAISE EXCEPTION 'Start time must be before end time';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.time_slots
        WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
        AND (
            (start_time <= NEW.start_time AND end_time > NEW.start_time) OR
            (start_time < NEW.end_time AND end_time >= NEW.end_time) OR
            (start_time >= NEW.start_time AND end_time <= NEW.end_time)
        )
    ) THEN
        RAISE EXCEPTION 'Time slot conflicts with existing time slot';
    END IF;

    RETURN NEW;
END;
$$ language plpgsql;

-- Shrink the morning breakfast break first so it no longer overlaps
-- שיעור ראשון's new start time.
UPDATE public.time_slots
SET name = 'ארוחת בוקר', start_time = '09:00', end_time = '09:10'
WHERE name = 'הפסקת אוכל' AND start_time = '09:00' AND end_time = '09:15';

UPDATE public.time_slots
SET start_time = '09:10', end_time = '09:50'
WHERE name = 'שיעור ראשון' AND start_time = '09:15' AND end_time = '09:55';

UPDATE public.time_slots
SET start_time = '09:50', end_time = '10:30'
WHERE name = 'שיעור שני' AND start_time = '09:55' AND end_time = '10:30';

UPDATE public.time_slots
SET name = 'הפסקה גדולה'
WHERE name = 'הפסקה' AND start_time = '10:30' AND end_time = '11:00';

UPDATE public.time_slots
SET start_time = '11:00', end_time = '11:40'
WHERE name = 'שיעור שלישי' AND start_time = '11:00' AND end_time = '11:45';

UPDATE public.time_slots
SET start_time = '11:40', end_time = '12:20'
WHERE name = 'שיעור רביעי' AND start_time = '11:45' AND end_time = '12:20';

COMMIT;
