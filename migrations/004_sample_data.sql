-- Migration: 004_sample_data
-- Description: Insert sample time slots and demo data
-- Author: System
-- Date: 2024-01-01

-- Initial time slots based on PRD requirements (for Sunday - day 0)
INSERT INTO public.time_slots (name, start_time, end_time, day_of_week) VALUES
    ('מפגש בוקר', '08:30', '09:00', 0),
    ('הפסקת אוכל', '09:00', '09:15', 0),
    ('שיעור ראשון', '09:15', '09:55', 0),
    ('שיעור שני', '09:55', '10:30', 0),
    ('הפסקה', '10:30', '11:00', 0),
    ('שיעור שלישי', '11:00', '11:45', 0),
    ('שיעור רביעי', '11:45', '12:20', 0),
    ('הפסקה קטנה', '12:20', '12:30', 0),
    ('מפגש צהריים', '12:30', '12:45', 0),
    ('ארוחת צהריים', '12:45', '13:30', 0),
    ('שיעור חמישי', '13:30', '14:15', 0),
    ('שיעור שישי', '14:15', '15:00', 0)
ON CONFLICT (day_of_week, start_time, end_time) DO NOTHING;

-- Replicate for Monday-Thursday (days 1-4)
INSERT INTO public.time_slots (name, start_time, end_time, day_of_week)
SELECT name, start_time, end_time, 1 as day_of_week
FROM public.time_slots WHERE day_of_week = 0
ON CONFLICT (day_of_week, start_time, end_time) DO NOTHING;

INSERT INTO public.time_slots (name, start_time, end_time, day_of_week)
SELECT name, start_time, end_time, 2 as day_of_week
FROM public.time_slots WHERE day_of_week = 0
ON CONFLICT (day_of_week, start_time, end_time) DO NOTHING;

INSERT INTO public.time_slots (name, start_time, end_time, day_of_week)
SELECT name, start_time, end_time, 3 as day_of_week
FROM public.time_slots WHERE day_of_week = 0
ON CONFLICT (day_of_week, start_time, end_time) DO NOTHING;

INSERT INTO public.time_slots (name, start_time, end_time, day_of_week)
SELECT name, start_time, end_time, 4 as day_of_week
FROM public.time_slots WHERE day_of_week = 0
ON CONFLICT (day_of_week, start_time, end_time) DO NOTHING;

-- Sample classes (only if no classes exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.classes LIMIT 1) THEN
        -- Insert sample classes for different time slots and grades
        WITH sample_time_slots AS (
            SELECT id, day_of_week, start_time
            FROM public.time_slots
            WHERE name NOT IN ('מפגש בוקר', 'הפסקת אוכל', 'הפסקה', 'הפסקה קטנה', 'מפגש צהריים', 'ארוחת צהריים')
            ORDER BY day_of_week, start_time
            LIMIT 10
        )
        INSERT INTO public.classes (title, description, teacher, time_slot_id, grade, is_mandatory)
        SELECT
            CASE
                WHEN row_number() OVER (ORDER BY id) % 5 = 1 THEN 'מתמטיקה'
                WHEN row_number() OVER (ORDER BY id) % 5 = 2 THEN 'עברית'
                WHEN row_number() OVER (ORDER BY id) % 5 = 3 THEN 'אנגלית'
                WHEN row_number() OVER (ORDER BY id) % 5 = 4 THEN 'מדעים'
                ELSE 'אומנות'
            END as title,
            CASE
                WHEN row_number() OVER (ORDER BY id) % 5 = 1 THEN 'שיעור מתמטיקה מתקדם'
                WHEN row_number() OVER (ORDER BY id) % 5 = 2 THEN 'שיעור עברית ספרות'
                WHEN row_number() OVER (ORDER BY id) % 5 = 3 THEN 'שיעור אנגלית דיבור'
                WHEN row_number() OVER (ORDER BY id) % 5 = 4 THEN 'שיעור מדעי הטבע'
                ELSE 'שיעור אומנות יצירתית'
            END as description,
            CASE
                WHEN row_number() OVER (ORDER BY id) % 4 = 1 THEN 'מורה שרה כהן'
                WHEN row_number() OVER (ORDER BY id) % 4 = 2 THEN 'מורה דוד לוי'
                WHEN row_number() OVER (ORDER BY id) % 4 = 3 THEN 'מורה רחל אבני'
                ELSE 'מורה מיכל ברק'
            END as teacher,
            id as time_slot_id,
            ((row_number() OVER (ORDER BY id) - 1) % 6) + 1 as grade,
            CASE
                WHEN row_number() OVER (ORDER BY id) % 5 IN (1, 2) THEN true  -- Make math and Hebrew mandatory
                ELSE false
            END as is_mandatory
        FROM sample_time_slots;
    END IF;
END $$;