-- Migration: 017_add_class_slots
-- Description: Introduce a slots JSONB column on classes so a class can occupy
--   multiple, arbitrary (day_of_week, time_slot) pairs. Keeps classes.is_double as
--   the stored Double Lesson attribute. Backfills existing classes (including the
--   second slot for double lessons), then drops the now-superseded flat
--   day_of_week/time_slot_id columns.
-- Author: System
-- Date: 2026-09-07

BEGIN;

-- Step 1: Add the slots column. Array of {dayOfWeek, timeSlotId} objects.
ALTER TABLE public.classes ADD COLUMN slots JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Step 2: Backfill. Every class gets a slot matching its current
-- (day_of_week, time_slot_id). Double-lesson classes also get a second slot for
-- the immediately-following LESSONS-category time slot (by start_time), same day —
-- mirrors ScheduleService.getNextConsecutiveTimeSlot / isLessonTimeSlot, which
-- filter to lesson slots (skipping breaks/meetings) by matching these Hebrew names.
WITH lesson_slots AS (
    SELECT
        id,
        start_time,
        LEAD(id) OVER (ORDER BY start_time) AS next_id
    FROM public.time_slots
    WHERE name IN (
        'שיעור ראשון', 'שיעור שני', 'שיעור שלישי',
        'שיעור רביעי', 'שיעור חמישי', 'שיעור שישי'
    )
),
computed AS (
    SELECT
        c.id,
        CASE WHEN c.is_double AND ls.next_id IS NOT NULL THEN
            jsonb_build_array(
                jsonb_build_object('dayOfWeek', c.day_of_week, 'timeSlotId', c.time_slot_id),
                jsonb_build_object('dayOfWeek', c.day_of_week, 'timeSlotId', ls.next_id)
            )
        ELSE
            jsonb_build_array(
                jsonb_build_object('dayOfWeek', c.day_of_week, 'timeSlotId', c.time_slot_id)
            )
        END AS slots_json
    FROM public.classes c
    LEFT JOIN lesson_slots ls ON ls.id = c.time_slot_id
)
UPDATE public.classes c
SET slots = computed.slots_json
FROM computed
WHERE computed.id = c.id;

-- Step 3: Surface (not fail on) double-lesson classes whose slot had no following
-- lesson slot to backfill into — today's ScheduleService silently no-ops this case
-- via a console warning; a migration can't warn, so make it visible via a SELECT.
SELECT id, title FROM public.classes WHERE is_double AND jsonb_array_length(slots) < 2;

-- Step 3b: Those classes end up with is_double = true but only 1 slot, which
-- breaks the "Double Lesson implies 2 slots" invariant every reader now relies
-- on. Rather than leave that inconsistency in the new schema from day one,
-- clear is_double for them — matching the fact that no second slot exists.
UPDATE public.classes
SET is_double = false
WHERE is_double AND jsonb_array_length(slots) < 2;

-- Step 4: Every class must have at least one slot.
ALTER TABLE public.classes
    ADD CONSTRAINT classes_slots_not_empty CHECK (jsonb_array_length(slots) > 0);

-- Step 5: Drop columns now fully superseded by slots. Every reader/writer is
-- updated to go through `slots` in this same change, so keeping the old columns
-- around would create a second, unmaintained source of truth. is_double is kept
-- untouched — it remains the stored Double Lesson attribute alongside slots.
--
-- classes_with_enrollment (migrations/016_add_enrollment_functions.sql) selects
-- `c.*`, which Postgres expands and stores at CREATE VIEW time — so it holds a
-- real dependency on day_of_week/time_slot_id and blocks dropping them unless
-- the view is dropped first and recreated after (picking up the new column set
-- automatically via the same `c.*`).
DROP VIEW IF EXISTS public.classes_with_enrollment;

DROP INDEX IF EXISTS idx_classes_day_time;
DROP INDEX IF EXISTS idx_classes_time_slot;
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_day_of_week_valid;
ALTER TABLE public.classes DROP COLUMN day_of_week;
ALTER TABLE public.classes DROP COLUMN time_slot_id;

CREATE VIEW public.classes_with_enrollment AS
SELECT
    c.*,
    COALESCE(enrollment_data.enrollment_count, 0) as enrollment_count
FROM public.classes c
LEFT JOIN (
    SELECT
        ss.class_id,
        COUNT(*) as enrollment_count
    FROM public.schedule_selections ss
    INNER JOIN public.classes cls ON ss.class_id = cls.id
    WHERE
        ss.child_id IS NOT NULL
    GROUP BY ss.class_id
) enrollment_data ON c.id = enrollment_data.class_id;

GRANT SELECT ON public.classes_with_enrollment TO authenticated;
COMMENT ON VIEW public.classes_with_enrollment IS 'View of classes with their current enrollment counts';

COMMENT ON COLUMN public.classes.slots IS
    'Class Slots: array of {dayOfWeek, timeSlotId} objects. A class occupies one or more.';

COMMIT;
