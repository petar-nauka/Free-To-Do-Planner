
-- Create task_comments table
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on tasks they can see
CREATE POLICY "Users can view comments on accessible tasks"
ON public.task_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
    AND (t.user_id = auth.uid() OR is_project_member(auth.uid(), t.project_id))
  )
);

-- Users can create comments on tasks they can edit
CREATE POLICY "Users can create comments"
ON public.task_comments
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
    AND (t.user_id = auth.uid() OR can_edit_project(auth.uid(), t.project_id))
  )
);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
ON public.task_comments
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON public.task_comments
FOR DELETE
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_task_comments_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
