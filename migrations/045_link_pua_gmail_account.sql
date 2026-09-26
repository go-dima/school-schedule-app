-- Migration: 045_link_pua_gmail_account
-- Description: Issue #163 (Staff View part 2) -- פועה דרוקס has two staff
--   accounts. 044 linked the taded one (0c9e4490-...), but her committed
--   tutoring selections (חונכות / שילוב) were all made from the gmail one
--   (a4b21a1b-..., puadruks@gmail.com), which is also the account she
--   actually uses at school. Staff View resolves a staff member's week by a
--   single user id, so for now the gmail account becomes her main one:
--     1. clear the taded account's display name (display names are unique)
--     2. give the gmail account the display name
--     3. move her catalog class / override links from taded to gmail
--   Merging the two accounts into one stays a separate, deferred decision.
--   Idempotent: re-running changes nothing.
-- Author: System
-- Date: 2026-09-26
--
-- NOTE: Run manually, after 044.

BEGIN;

-- 1. Free the name on the taded account.
UPDATE public.users
SET display_name = NULL
WHERE id = '0c9e4490-d6fc-442c-b4da-5a0b7e256314'
  AND display_name IS NOT NULL;

-- 2. The gmail account becomes "פועה דרוקס".
UPDATE public.users
SET display_name = 'פועה דרוקס'
WHERE id = 'a4b21a1b-7b45-4c7c-9f02-351781499a64'
  AND display_name IS DISTINCT FROM 'פועה דרוקס';

-- 3. Move the links (the trigger keeps teacher = 'פועה דרוקס').
UPDATE public.classes
SET user_id = 'a4b21a1b-7b45-4c7c-9f02-351781499a64'
WHERE user_id = '0c9e4490-d6fc-442c-b4da-5a0b7e256314';

UPDATE public.schedule_overrides
SET user_id = 'a4b21a1b-7b45-4c7c-9f02-351781499a64'
WHERE user_id = '0c9e4490-d6fc-442c-b4da-5a0b7e256314';

COMMIT;

-- Verification ----------------------------------------------------------------

-- Expect: gmail = פועה דרוקס with 6 linked classes; taded = NULL with 0.
SELECT u.email, u.display_name, count(c.id) AS linked_classes
FROM public.users u
LEFT JOIN public.classes c ON c.user_id = u.id
WHERE u.id IN ('0c9e4490-d6fc-442c-b4da-5a0b7e256314',
               'a4b21a1b-7b45-4c7c-9f02-351781499a64')
GROUP BY u.email, u.display_name
ORDER BY u.email;
