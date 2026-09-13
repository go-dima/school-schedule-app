-- Data seed: seed_shiluv_classes
-- Description: Populate public.classes with 30 "שילוב" placeholder classes --
--   one for every (day, time slot) combination: 5 learning days (Sun-Thu) x
--   6 lesson periods = 30 rows. Each row is single-slot, non-double,
--   non-mandatory, open to all of grades 1-6, taught by the placeholder
--   teacher "חונכ/ת".
--
--   This is a standalone data seed, NOT a schema migration -- it has no
--   numeric prefix and is not registered in migrations/migrations.json.
--   Run it manually against the target database after
--   018_add_group_and_track_fields has been applied (it uses classes.slots).
--
--   This does NOT delete any existing classes first -- it only adds the 30
--   new rows alongside whatever is already seeded.
-- Author: System
-- Date: 2026-09-13

BEGIN;

WITH days AS (
    SELECT * FROM (VALUES (0), (1), (2), (3), (4)) AS d(day_of_week)
),
periods AS (
    SELECT id AS time_slot_id, name
    FROM public.time_slots
    WHERE name IN (
        'שיעור ראשון', 'שיעור שני', 'שיעור שלישי',
        'שיעור רביעי', 'שיעור חמישי', 'שיעור שישי'
    )
)
INSERT INTO public.classes
    (title, description, teacher, is_mandatory, is_double, grades, track_number, group_number, room, slots, scope)
SELECT
    'שילוב',
    '',
    'חונכ/ת',
    false,
    false,
    ARRAY[1, 2, 3, 4, 5, 6],
    NULL,
    NULL,
    '',
    jsonb_build_array(jsonb_build_object('dayOfWeek', d.day_of_week, 'timeSlotId', p.time_slot_id)),
    'prod'
FROM days d
CROSS JOIN periods p;

COMMIT;
