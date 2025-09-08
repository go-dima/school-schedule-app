-- Migration: 013_add_children_management
-- Description: Create tables for children, parent-child relationships, and sharing functionality

-- Create children table
CREATE TABLE public.children (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    grade INTEGER NOT NULL CHECK (grade >= 1 AND grade <= 6),
    group_number INTEGER NOT NULL CHECK (group_number IN (1, 2)) DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create parent_child_relationships table for sharing children between parents
CREATE TABLE public.parent_child_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false, -- Indicates if this parent is the primary parent who created the child
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(parent_id, child_id) -- Prevent duplicate relationships
);

-- Create child_share_tokens table for secure sharing links
CREATE TABLE public.child_share_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    shared_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    used_by_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add child_id column to schedule_selections (nullable for migration)
ALTER TABLE public.schedule_selections
ADD COLUMN child_id UUID REFERENCES public.children(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_parent_child_relationships_parent_id ON public.parent_child_relationships(parent_id);
CREATE INDEX idx_parent_child_relationships_child_id ON public.parent_child_relationships(child_id);
CREATE INDEX idx_schedule_selections_child_id ON public.schedule_selections(child_id);
CREATE INDEX idx_child_share_tokens_token ON public.child_share_tokens(token);
CREATE INDEX idx_child_share_tokens_expires_at ON public.child_share_tokens(expires_at);

-- Enable RLS on new tables
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_child_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_share_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for children table
CREATE POLICY "Parents can view their children" ON public.children
    FOR SELECT USING (
        id IN (
            SELECT child_id
            FROM public.parent_child_relationships
            WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can create children" ON public.children
    FOR INSERT WITH CHECK (true); -- Will be restricted by parent_child_relationships

CREATE POLICY "Parents can update their children" ON public.children
    FOR UPDATE USING (
        id IN (
            SELECT child_id
            FROM public.parent_child_relationships
            WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can delete their children if they are primary parent" ON public.children
    FOR DELETE USING (
        id IN (
            SELECT child_id
            FROM public.parent_child_relationships
            WHERE parent_id = auth.uid() AND is_primary = true
        )
    );

-- Create RLS policies for parent_child_relationships table
CREATE POLICY "Users can view their parent-child relationships" ON public.parent_child_relationships
    FOR SELECT USING (parent_id = auth.uid());

CREATE POLICY "Users can create parent-child relationships for themselves" ON public.parent_child_relationships
    FOR INSERT WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Users can delete their own parent-child relationships" ON public.parent_child_relationships
    FOR DELETE USING (parent_id = auth.uid());

-- Create RLS policies for child_share_tokens table
CREATE POLICY "Users can view share tokens they created" ON public.child_share_tokens
    FOR SELECT USING (shared_by_user_id = auth.uid());

CREATE POLICY "Users can create share tokens for their children" ON public.child_share_tokens
    FOR INSERT WITH CHECK (
        shared_by_user_id = auth.uid() AND
        child_id IN (
            SELECT child_id
            FROM public.parent_child_relationships
            WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Users can update share tokens they created" ON public.child_share_tokens
    FOR UPDATE USING (shared_by_user_id = auth.uid());

-- Allow anyone to view non-expired, unused tokens (for sharing functionality)
CREATE POLICY "Anyone can view valid share tokens" ON public.child_share_tokens
    FOR SELECT USING (
        expires_at > now() AND
        used_at IS NULL
    );

-- Update schedule_selections RLS policies to work with both user_id and child_id
DROP POLICY IF EXISTS "Users can view their own schedule selections" ON public.schedule_selections;
DROP POLICY IF EXISTS "Users can manage their own schedule selections" ON public.schedule_selections;

CREATE POLICY "Users can view their own schedule selections" ON public.schedule_selections
    FOR SELECT USING (
        user_id = auth.uid() OR
        child_id IN (
            SELECT child_id
            FROM public.parent_child_relationships
            WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own schedule selections" ON public.schedule_selections
    FOR ALL USING (
        user_id = auth.uid() OR
        child_id IN (
            SELECT child_id
            FROM public.parent_child_relationships
            WHERE parent_id = auth.uid()
        )
    );

-- Create trigger to update updated_at timestamp for children
CREATE OR REPLACE FUNCTION public.update_children_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_children_updated_at
    BEFORE UPDATE ON public.children
    FOR EACH ROW
    EXECUTE FUNCTION public.update_children_updated_at();

-- Create function to generate share tokens
CREATE OR REPLACE FUNCTION public.generate_child_share_token(
    p_child_id UUID,
    p_expires_in_hours INTEGER DEFAULT 168 -- 7 days default
)
RETURNS TEXT AS $$
DECLARE
    token TEXT;
    existing_token_count INTEGER;
BEGIN
    -- Check if user has permission to share this child
    IF NOT EXISTS (
        SELECT 1 FROM public.parent_child_relationships
        WHERE parent_id = auth.uid() AND child_id = p_child_id
    ) THEN
        RAISE EXCEPTION 'You do not have permission to share this child';
    END IF;

    -- Generate a secure random token
    token := encode(gen_random_bytes(32), 'base64url');

    -- Clean up expired tokens for this child
    DELETE FROM public.child_share_tokens
    WHERE child_id = p_child_id AND expires_at < now();

    -- Check if user already has active tokens for this child (limit to 3)
    SELECT COUNT(*) INTO existing_token_count
    FROM public.child_share_tokens
    WHERE child_id = p_child_id
    AND shared_by_user_id = auth.uid()
    AND expires_at > now()
    AND used_at IS NULL;

    IF existing_token_count >= 3 THEN
        RAISE EXCEPTION 'You can only have 3 active share tokens per child at a time';
    END IF;

    -- Insert new token
    INSERT INTO public.child_share_tokens (child_id, token, shared_by_user_id, expires_at)
    VALUES (p_child_id, token, auth.uid(), now() + (p_expires_in_hours || ' hours')::interval);

    RETURN token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to accept shared child
CREATE OR REPLACE FUNCTION public.accept_shared_child(p_token TEXT)
RETURNS UUID AS $$
DECLARE
    token_record RECORD;
    relationship_id UUID;
BEGIN
    -- Get token details
    SELECT * INTO token_record
    FROM public.child_share_tokens
    WHERE token = p_token
    AND expires_at > now()
    AND used_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired share token';
    END IF;

    -- Check if user already has this child
    IF EXISTS (
        SELECT 1 FROM public.parent_child_relationships
        WHERE parent_id = auth.uid() AND child_id = token_record.child_id
    ) THEN
        RAISE EXCEPTION 'You already have access to this child';
    END IF;

    -- Mark token as used
    UPDATE public.child_share_tokens
    SET used_at = now(), used_by_user_id = auth.uid()
    WHERE id = token_record.id;

    -- Create parent-child relationship
    INSERT INTO public.parent_child_relationships (parent_id, child_id, is_primary)
    VALUES (auth.uid(), token_record.child_id, false)
    RETURNING id INTO relationship_id;

    RETURN relationship_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create child with primary parent relationship
CREATE OR REPLACE FUNCTION public.create_child_with_relationship(
    p_first_name TEXT,
    p_last_name TEXT,
    p_grade INTEGER,
    p_group_number INTEGER DEFAULT 1
)
RETURNS UUID AS $$
DECLARE
    child_id UUID;
BEGIN
    -- Insert child
    INSERT INTO public.children (first_name, last_name, grade, group_number)
    VALUES (p_first_name, p_last_name, p_grade, p_group_number)
    RETURNING id INTO child_id;

    -- Create primary parent relationship
    INSERT INTO public.parent_child_relationships (parent_id, child_id, is_primary)
    VALUES (auth.uid(), child_id, true);

    RETURN child_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.children IS 'Children that can be managed by parents';
COMMENT ON TABLE public.parent_child_relationships IS 'Many-to-many relationship between parents and children';
COMMENT ON TABLE public.child_share_tokens IS 'Secure tokens for sharing children between parents';
COMMENT ON FUNCTION public.generate_child_share_token IS 'Generate a secure token to share a child with another parent';
COMMENT ON FUNCTION public.accept_shared_child IS 'Accept a shared child using a token';
COMMENT ON FUNCTION public.create_child_with_relationship IS 'Create a new child and establish primary parent relationship';