-- Create table for daily plans / today plans
CREATE TABLE public.today_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  plan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_task_limit INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id, plan_date)
);

-- Create table for MIT tasks (Most Important Tasks)
CREATE TABLE public.mit_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  today_plan_id UUID NOT NULL REFERENCES public.today_plans(id) ON DELETE CASCADE,
  task_id UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on today_plans
ALTER TABLE public.today_plans ENABLE ROW LEVEL SECURITY;

-- Enable RLS on mit_tasks  
ALTER TABLE public.mit_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for today_plans
CREATE POLICY "Users can view own or shared today plans"
ON public.today_plans
FOR SELECT
USING (
  auth.role() = 'authenticated' 
  AND (
    (user_id = auth.uid()) 
    OR is_project_member(auth.uid(), project_id)
  )
);

CREATE POLICY "Users can create today plans in own or editable projects"
ON public.today_plans
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND user_id = auth.uid() 
  AND (
    (EXISTS (SELECT 1 FROM projects WHERE id = today_plans.project_id AND user_id = auth.uid()))
    OR can_edit_project(auth.uid(), project_id)
  )
);

CREATE POLICY "Users can update own or editable today plans"
ON public.today_plans
FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND (
    (user_id = auth.uid()) 
    OR can_edit_project(auth.uid(), project_id)
  )
);

CREATE POLICY "Users can delete own or editable today plans"
ON public.today_plans
FOR DELETE
USING (
  auth.role() = 'authenticated'
  AND (
    (user_id = auth.uid()) 
    OR can_edit_project(auth.uid(), project_id)
  )
);

-- RLS policies for mit_tasks
CREATE POLICY "Users can view MIT tasks for their plans"
ON public.mit_tasks
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.today_plans tp 
    WHERE tp.id = mit_tasks.today_plan_id 
    AND (
      tp.user_id = auth.uid() 
      OR is_project_member(auth.uid(), tp.project_id)
    )
  )
);

CREATE POLICY "Users can create MIT tasks for their plans"
ON public.mit_tasks
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.today_plans tp 
    WHERE tp.id = mit_tasks.today_plan_id 
    AND (
      tp.user_id = auth.uid() 
      OR can_edit_project(auth.uid(), tp.project_id)
    )
  )
);

CREATE POLICY "Users can update MIT tasks for their plans"
ON public.mit_tasks
FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.today_plans tp 
    WHERE tp.id = mit_tasks.today_plan_id 
    AND (
      tp.user_id = auth.uid() 
      OR can_edit_project(auth.uid(), tp.project_id)
    )
  )
);

CREATE POLICY "Users can delete MIT tasks for their plans"
ON public.mit_tasks
FOR DELETE
USING (
  auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.today_plans tp 
    WHERE tp.id = mit_tasks.today_plan_id 
    AND (
      tp.user_id = auth.uid() 
      OR can_edit_project(auth.uid(), tp.project_id)
    )
  )
);

-- Add trigger for updated_at on today_plans
CREATE TRIGGER update_today_plans_updated_at
BEFORE UPDATE ON public.today_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();