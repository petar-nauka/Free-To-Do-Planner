-- Create reminders table
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reminder_date TIMESTAMP WITH TIME ZONE NOT NULL,
  reminder_email TEXT NOT NULL,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create recurring tasks table
CREATE TABLE public.recurring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  -- Schedule fields
  day_of_week INTEGER, -- 0-6 (Sunday-Saturday), NULL for daily
  time_of_day TIME NOT NULL DEFAULT '09:00',
  -- Recurrence type: 'daily', 'weekly', 'monthly'
  recurrence_type TEXT NOT NULL DEFAULT 'weekly',
  day_of_month INTEGER, -- 1-31 for monthly
  notification_email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reminders
CREATE POLICY "Users can view own or shared reminders"
  ON public.reminders FOR SELECT
  USING (user_id = auth.uid() OR is_project_member(auth.uid(), project_id));

CREATE POLICY "Users can create reminders in own or editable projects"
  ON public.reminders FOR INSERT
  WITH CHECK (user_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid())
    OR can_edit_project(auth.uid(), project_id)
  ));

CREATE POLICY "Users can update own or editable reminders"
  ON public.reminders FOR UPDATE
  USING (user_id = auth.uid() OR can_edit_project(auth.uid(), project_id));

CREATE POLICY "Users can delete own or editable reminders"
  ON public.reminders FOR DELETE
  USING (user_id = auth.uid() OR can_edit_project(auth.uid(), project_id));

-- RLS Policies for recurring_tasks
CREATE POLICY "Users can view own or shared recurring tasks"
  ON public.recurring_tasks FOR SELECT
  USING (user_id = auth.uid() OR is_project_member(auth.uid(), project_id));

CREATE POLICY "Users can create recurring tasks in own or editable projects"
  ON public.recurring_tasks FOR INSERT
  WITH CHECK (user_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid())
    OR can_edit_project(auth.uid(), project_id)
  ));

CREATE POLICY "Users can update own or editable recurring tasks"
  ON public.recurring_tasks FOR UPDATE
  USING (user_id = auth.uid() OR can_edit_project(auth.uid(), project_id));

CREATE POLICY "Users can delete own or editable recurring tasks"
  ON public.recurring_tasks FOR DELETE
  USING (user_id = auth.uid() OR can_edit_project(auth.uid(), project_id));

-- Triggers for updated_at
CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_tasks_updated_at
  BEFORE UPDATE ON public.recurring_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();