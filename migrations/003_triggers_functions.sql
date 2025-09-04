-- Migration: 003_triggers_functions
-- Description: Create database functions and triggers
-- Author: System
-- Date: 2024-01-01

-- Function to handle updated_at timestamps
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS handle_users_updated_at ON public.users;
CREATE TRIGGER handle_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS handle_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER handle_user_roles_updated_at BEFORE UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS handle_time_slots_updated_at ON public.time_slots;
CREATE TRIGGER handle_time_slots_updated_at BEFORE UPDATE ON public.time_slots
    FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS handle_classes_updated_at ON public.classes;
CREATE TRIGGER handle_classes_updated_at BEFORE UPDATE ON public.classes
    FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS handle_schedule_selections_updated_at ON public.schedule_selections;
CREATE TRIGGER handle_schedule_selections_updated_at BEFORE UPDATE ON public.schedule_selections
    FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (new.id, new.email);
    RETURN new;
END;
$$ language plpgsql security definer;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to validate time slot conflicts
CREATE OR REPLACE FUNCTION validate_time_slot()
RETURNS trigger AS $$
BEGIN
    -- Check if start time is before end time
    IF NEW.start_time >= NEW.end_time THEN
        RAISE EXCEPTION 'Start time must be before end time';
    END IF;
    
    -- Check for overlapping time slots on the same day
    IF EXISTS (
        SELECT 1 FROM public.time_slots 
        WHERE day_of_week = NEW.day_of_week 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
        AND (
            (start_time <= NEW.start_time AND end_time > NEW.start_time) OR
            (start_time < NEW.end_time AND end_time >= NEW.end_time) OR
            (start_time >= NEW.start_time AND end_time <= NEW.end_time)
        )
    ) THEN
        RAISE EXCEPTION 'Time slot conflicts with existing time slot on the same day';
    END IF;
    
    RETURN NEW;
END;
$$ language plpgsql;

-- Trigger for time slot validation
DROP TRIGGER IF EXISTS validate_time_slot_trigger ON public.time_slots;
CREATE TRIGGER validate_time_slot_trigger
    BEFORE INSERT OR UPDATE ON public.time_slots
    FOR EACH ROW EXECUTE PROCEDURE validate_time_slot();