-- Add archived_at column to projects table
ALTER TABLE public.projects 
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for faster filtering
CREATE INDEX idx_projects_archived_at ON public.projects(archived_at);

-- Function to archive a project
CREATE OR REPLACE FUNCTION public.archive_project(p_project_id uuid)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.projects;
BEGIN
  UPDATE public.projects
  SET archived_at = now(),
      updated_at = now()
  WHERE id = p_project_id
    AND user_id = auth.uid()
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'Project not found or not allowed';
  END IF;

  RETURN updated_row;
END;
$$;

-- Function to unarchive a project
CREATE OR REPLACE FUNCTION public.unarchive_project(p_project_id uuid)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.projects;
BEGIN
  UPDATE public.projects
  SET archived_at = NULL,
      updated_at = now()
  WHERE id = p_project_id
    AND user_id = auth.uid()
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'Project not found or not allowed';
  END IF;

  RETURN updated_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unarchive_project(uuid) TO authenticated;