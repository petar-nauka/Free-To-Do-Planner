-- Enable pg_net extension for HTTP calls from database triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a table to queue notifications (more reliable than direct HTTP calls)
CREATE TABLE public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'task_created', 'note_created'
  project_id UUID NOT NULL,
  item_id UUID NOT NULL,
  item_title TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error TEXT
);

-- Enable RLS
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table
CREATE POLICY "Service role only" ON public.notification_queue
  FOR ALL USING (false);

-- Function to queue task notification
CREATE OR REPLACE FUNCTION public.queue_task_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_shared_project BOOLEAN;
BEGIN
  -- Check if this is a shared project (has other members)
  SELECT EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE project_id = NEW.project_id 
    AND status = 'accepted'
    AND user_id != NEW.user_id
  ) INTO is_shared_project;

  -- Also check if project owner is different from task creator
  IF NOT is_shared_project THEN
    SELECT EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = NEW.project_id 
      AND user_id != NEW.user_id
    ) INTO is_shared_project;
  END IF;

  -- Only queue if shared project
  IF is_shared_project THEN
    INSERT INTO public.notification_queue (type, project_id, item_id, item_title, created_by)
    VALUES ('task_created', NEW.project_id, NEW.id, NEW.title, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Function to queue note notification
CREATE OR REPLACE FUNCTION public.queue_note_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_shared_project BOOLEAN;
BEGIN
  -- Check if this is a shared project (has other members)
  SELECT EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE project_id = NEW.project_id 
    AND status = 'accepted'
    AND user_id != NEW.user_id
  ) INTO is_shared_project;

  -- Also check if project owner is different from note creator
  IF NOT is_shared_project THEN
    SELECT EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = NEW.project_id 
      AND user_id != NEW.user_id
    ) INTO is_shared_project;
  END IF;

  -- Only queue if shared project
  IF is_shared_project THEN
    INSERT INTO public.notification_queue (type, project_id, item_id, item_title, created_by)
    VALUES ('note_created', NEW.project_id, NEW.id, NEW.title, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER on_task_created_notify
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_task_notification();

CREATE TRIGGER on_note_created_notify
  AFTER INSERT ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_note_notification();