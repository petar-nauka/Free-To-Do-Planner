-- Create priority_tasks table for storing user's priority tasks on dashboard
CREATE TABLE public.priority_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.priority_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own priority tasks"
ON public.priority_tasks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own priority tasks"
ON public.priority_tasks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own priority tasks"
ON public.priority_tasks
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own priority tasks"
ON public.priority_tasks
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_priority_tasks_user_id ON public.priority_tasks(user_id);
CREATE INDEX idx_priority_tasks_task_id ON public.priority_tasks(task_id);

-- Unique constraint to prevent duplicate task entries
CREATE UNIQUE INDEX idx_priority_tasks_user_task ON public.priority_tasks(user_id, task_id);