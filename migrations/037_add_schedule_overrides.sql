-- Migration: 037_add_schedule_overrides
-- Description: Fully isolated schedule_overrides table so staff can drop a
--   one-off lesson into a specific child's schedule without it becoming a
--   classes catalog row or a schedule_selections row. No FK to classes, no
--   coupling to schedule_selections' draft/committed split or RLS.
-- Author: System
-- Date: 2026-09-16

BEGIN;

CREATE TABLE public.schedule_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    teacher TEXT NOT NULL,
    room TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    time_slot_id UUID NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
    scope class_scope NOT NULL DEFAULT 'test',
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.schedule_overrides IS
    'Staff-authored one-off lessons injected directly into a child''s schedule. Never a classes row, never a schedule_selections row -- deliberately outside catalog conflict/lock logic.';

CREATE INDEX idx_schedule_overrides_child ON public.schedule_overrides(child_id);
CREATE INDEX idx_schedule_overrides_time_slot ON public.schedule_overrides(time_slot_id);

ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;

-- Staff/admin: full read/write for any child (single tier, no admin-vs-staff split).
CREATE POLICY "Staff and admins can manage schedule overrides" ON public.schedule_overrides
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'staff')
            AND ur.approved = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'staff')
            AND ur.approved = true
        )
    );

-- Parents: read-only, own linked children only.
CREATE POLICY "Parents can view own children schedule overrides" ON public.schedule_overrides
    FOR SELECT USING (
        child_id IN (
            SELECT child_id FROM public.parent_child_relationships
            WHERE parent_id = auth.uid()
        )
    );

COMMIT;
