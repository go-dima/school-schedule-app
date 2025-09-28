-- Migration: 016_add_enrollment_functions
-- Description: Add database functions to get class enrollment counts

-- Create function to get enrollment counts for all classes
CREATE OR REPLACE FUNCTION public.get_class_enrollment_counts(target_scope TEXT DEFAULT NULL)
RETURNS TABLE (class_id UUID, enrollment_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as class_id,
        COALESCE(enrollment_data.count, 0) as enrollment_count
    FROM public.classes c
    LEFT JOIN (
        SELECT
            ss.class_id,
            COUNT(*) as count
        FROM public.schedule_selections ss
        INNER JOIN public.classes cls ON ss.class_id = cls.id
        WHERE
            ss.child_id IS NOT NULL  -- Only count child enrollments, not legacy user enrollments
            AND (target_scope IS NULL OR cls.scope = target_scope)  -- Filter by scope if specified
        GROUP BY ss.class_id
    ) enrollment_data ON c.id = enrollment_data.class_id
    WHERE (target_scope IS NULL OR c.scope = target_scope);  -- Filter by scope if specified
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get enrollment count for a specific class
CREATE OR REPLACE FUNCTION public.get_class_enrollment_count(p_class_id UUID, target_scope TEXT DEFAULT NULL)
RETURNS BIGINT AS $$
DECLARE
    count_result BIGINT;
BEGIN
    SELECT COUNT(*) INTO count_result
    FROM public.schedule_selections ss
    INNER JOIN public.classes c ON ss.class_id = c.id
    WHERE
        ss.class_id = p_class_id
        AND ss.child_id IS NOT NULL  -- Only count child enrollments
        AND (target_scope IS NULL OR c.scope = target_scope);  -- Filter by scope if specified

    RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for easy access to classes with enrollment counts
CREATE OR REPLACE VIEW public.classes_with_enrollment AS
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

-- Grant permissions for the functions
GRANT EXECUTE ON FUNCTION public.get_class_enrollment_counts(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_enrollment_count(UUID, TEXT) TO authenticated;
GRANT SELECT ON public.classes_with_enrollment TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.get_class_enrollment_counts IS 'Get enrollment counts for all classes, optionally filtering test classes';
COMMENT ON FUNCTION public.get_class_enrollment_count IS 'Get enrollment count for a specific class';
COMMENT ON VIEW public.classes_with_enrollment IS 'View of classes with their current enrollment counts';