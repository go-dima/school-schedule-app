-- Migration: 044_backfill_staff_teacher_links
-- Description: Issue #163 (Staff View part 2) -- the user <-> teacher mapping
--   agreed while designing part 2 (see
--   docs/superpowers/specs/2026-09-26-staff-view-p2-design.html, section 4).
--     1. Sets display_name on the 12 staff users who teach catalog classes.
--     2. Links their catalog classes (classes.user_id) by the exact current
--        teacher text. 043's trigger then rewrites teacher to the display
--        name -- the only visible change is מיכל הסקלוביץ -> מיכל חסקלוביץ.
--     3. Renames the two "דניאל" overrides to the full catalog name
--        "דניאל גוסמן ויטורי" (no account, so no user_id).
--   Everything else -- name-only teachers, placeholders (חונכ/ת, כללי,
--   לא ידוע, בת שירות), test users, the תמר / חונכ/ת overrides -- is left
--   untouched. Idempotent: every statement matches on exact ids and on the
--   exact current text, and only rows that are still unlinked.
-- Author: System
-- Date: 2026-09-26
--
-- NOTE: Run manually, after 043.

BEGIN;

-- The mapping is repeated inline in each statement (not a temp table): the
-- Supabase SQL editor may run the statements of one script on different
-- pooled connections, so session-local objects don't survive between them.

-- 1. Display names.
UPDATE public.users u
SET display_name = m.display_name
FROM (VALUES
    ('57b60ab3-d6e8-4d0a-902b-b04a2f01cfc1'::uuid, 'ארי נירון',      'ארי נירון'),
    ('5daaf43f-69fa-46a2-b2ff-8e1cdae5d279'::uuid, 'שחר גודמן',      'שחר גודמן'),
    ('6de38a72-982f-48c0-bf4d-f257fd802f9f'::uuid, 'טלוש שור',       'טלוש שור'),
    ('0d8287f1-83a2-4369-b41d-888ff7cfa08b'::uuid, 'הדר קרן',        'הדר קרן'),
    ('af602a46-7171-44cd-853a-cd66bdcb73a6'::uuid, 'חגי לדרר',       'חגי לדרר'),
    ('36995369-a2bc-4955-bcaa-9a8f6928e363'::uuid, 'ליאת פישר',      'ליאת פישר'),
    ('4724f7a0-ab7a-4cd4-b1cd-d8c8a3bb4efa'::uuid, 'נתלי צינדורף',   'נתלי צינדורף'),
    ('90cec7fa-8a7a-4960-8d68-4807e4e69e75'::uuid, 'ענתי ערן אור',   'ענתי ערן אור'),
    ('be804f17-7d41-4198-9b20-f72dc4891c45'::uuid, 'רחל פלדפוגל',    'רחל פלדפוגל'),
    ('9980bb11-133f-42ab-beec-b4e769fca085'::uuid, 'מיכל חסקלוביץ',  'מיכל הסקלוביץ'),
    ('cc9fcc51-5218-437f-b3af-c4bf6248a169'::uuid, 'רמי בליטנטל',    'רמי בליטנטל'),
    ('0c9e4490-d6fc-442c-b4da-5a0b7e256314'::uuid, 'פועה דרוקס',     'פועה דרוקס')
) AS m(user_id, display_name, catalog_name)
WHERE u.id = m.user_id
  AND u.display_name IS DISTINCT FROM m.display_name;

-- 2. Catalog links (the trigger rewrites teacher to the display name).
UPDATE public.classes c
SET user_id = m.user_id
FROM (VALUES
    ('57b60ab3-d6e8-4d0a-902b-b04a2f01cfc1'::uuid, 'ארי נירון',      'ארי נירון'),
    ('5daaf43f-69fa-46a2-b2ff-8e1cdae5d279'::uuid, 'שחר גודמן',      'שחר גודמן'),
    ('6de38a72-982f-48c0-bf4d-f257fd802f9f'::uuid, 'טלוש שור',       'טלוש שור'),
    ('0d8287f1-83a2-4369-b41d-888ff7cfa08b'::uuid, 'הדר קרן',        'הדר קרן'),
    ('af602a46-7171-44cd-853a-cd66bdcb73a6'::uuid, 'חגי לדרר',       'חגי לדרר'),
    ('36995369-a2bc-4955-bcaa-9a8f6928e363'::uuid, 'ליאת פישר',      'ליאת פישר'),
    ('4724f7a0-ab7a-4cd4-b1cd-d8c8a3bb4efa'::uuid, 'נתלי צינדורף',   'נתלי צינדורף'),
    ('90cec7fa-8a7a-4960-8d68-4807e4e69e75'::uuid, 'ענתי ערן אור',   'ענתי ערן אור'),
    ('be804f17-7d41-4198-9b20-f72dc4891c45'::uuid, 'רחל פלדפוגל',    'רחל פלדפוגל'),
    ('9980bb11-133f-42ab-beec-b4e769fca085'::uuid, 'מיכל חסקלוביץ',  'מיכל הסקלוביץ'),
    ('cc9fcc51-5218-437f-b3af-c4bf6248a169'::uuid, 'רמי בליטנטל',    'רמי בליטנטל'),
    ('0c9e4490-d6fc-442c-b4da-5a0b7e256314'::uuid, 'פועה דרוקס',     'פועה דרוקס')
) AS m(user_id, display_name, catalog_name)
WHERE c.user_id IS NULL
  AND trim(c.teacher) = m.catalog_name;

-- 3. Overrides: "דניאל" is the catalog's דניאל גוסמן ויטורי (no account).
UPDATE public.schedule_overrides
SET teacher = 'דניאל גוסמן ויטורי'
WHERE user_id IS NULL
  AND trim(teacher) = 'דניאל';

COMMIT;

-- Verification (run after the commit; the SQL editor shows only the last
-- result set, so run these one at a time if you want to see each) ----------

-- Expect 12 rows, each with linked_classes > 0 and labels = display_name.
SELECT u.display_name,
       count(c.id) AS linked_classes,
       string_agg(DISTINCT c.teacher, ', ') AS labels
FROM public.users u
LEFT JOIN public.classes c ON c.user_id = u.id
WHERE u.display_name IS NOT NULL
GROUP BY u.display_name
ORDER BY u.display_name;

-- Expect: name-only teachers, placeholders and test data only.
SELECT trim(teacher) AS teacher, count(*) AS classes
FROM public.classes
WHERE user_id IS NULL
GROUP BY 1
ORDER BY 1;

-- Expect: דניאל גוסמן ויטורי 2, חונכ/ת 2, תמר 1.
SELECT trim(teacher) AS teacher, count(*) AS overrides
FROM public.schedule_overrides
GROUP BY 1
ORDER BY 1;
