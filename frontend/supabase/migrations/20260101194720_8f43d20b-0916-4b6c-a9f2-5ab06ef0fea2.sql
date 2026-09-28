-- Add archived_at column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for faster archive queries
CREATE INDEX idx_tasks_archived_at ON public.tasks(archived_at) WHERE archived_at IS NOT NULL;