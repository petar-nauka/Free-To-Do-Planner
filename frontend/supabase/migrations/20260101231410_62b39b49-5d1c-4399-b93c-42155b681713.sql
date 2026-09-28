-- Add position column to projects table for drag-and-drop reordering
ALTER TABLE public.projects ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

-- Update existing projects with positions based on created_at (newest = lowest position)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) - 1 as new_pos
  FROM public.projects
)
UPDATE public.projects p
SET position = r.new_pos
FROM ranked r
WHERE p.id = r.id;