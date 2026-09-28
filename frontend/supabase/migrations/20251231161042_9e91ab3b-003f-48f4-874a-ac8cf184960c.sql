-- Add UPDATE policy for task_tags table
CREATE POLICY "Users can update own task tags" 
ON public.task_tags 
FOR UPDATE 
USING (EXISTS ( SELECT 1
   FROM tasks
  WHERE ((tasks.id = task_tags.task_id) AND (tasks.user_id = auth.uid()))));