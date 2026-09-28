-- Free To-Do Planner - full database schema (29 migrations in order).
-- Generated from frontend/supabase/migrations + sql_migrations. Do not edit by hand.
-- Run ONCE on an EMPTY Supabase project: Dashboard -> SQL Editor -> paste -> Run.

-- ===== frontend/supabase/migrations/20251231153656_81eedea8-89cb-4e9b-9289-f458b03f62c3.sql =====
-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT 'purple',
  icon TEXT NOT NULL DEFAULT 'folder',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notes table
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create task status enum
CREATE TYPE public.task_status AS ENUM ('new', 'in_progress', 'future');

-- Create priority enum
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'new',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create task tags table
CREATE TABLE public.task_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Projects policies
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- Notes policies
CREATE POLICY "Users can view own notes" ON public.notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notes" ON public.notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON public.notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON public.notes
  FOR DELETE USING (auth.uid() = user_id);

-- Tasks policies
CREATE POLICY "Users can view own tasks" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Task tags policies (through task ownership)
CREATE POLICY "Users can view own task tags" ON public.task_tags
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_tags.task_id AND tasks.user_id = auth.uid())
  );

CREATE POLICY "Users can create own task tags" ON public.task_tags
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_tags.task_id AND tasks.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own task tags" ON public.task_tags
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_tags.task_id AND tasks.user_id = auth.uid())
  );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_notes_project_id ON public.notes(project_id);
CREATE INDEX idx_notes_user_id ON public.notes(user_id);
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_task_tags_task_id ON public.task_tags(task_id);

-- Full text search indexes
CREATE INDEX idx_notes_content_search ON public.notes USING gin(to_tsvector('english', title || ' ' || COALESCE(content, '')));
CREATE INDEX idx_tasks_title_search ON public.tasks USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- ===== frontend/supabase/migrations/20251231161042_9e91ab3b-003f-48f4-874a-ac8cf184960c.sql =====
-- Add UPDATE policy for task_tags table
CREATE POLICY "Users can update own task tags" 
ON public.task_tags 
FOR UPDATE 
USING (EXISTS ( SELECT 1
   FROM tasks
  WHERE ((tasks.id = task_tags.task_id) AND (tasks.user_id = auth.uid()))));

-- ===== frontend/supabase/migrations/20260101184447_257e2cfc-4751-487f-ace4-452a52b2778c.sql =====
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger to assign default user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Allow admins to view all profiles (for user management)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- ===== frontend/supabase/migrations/20260101193919_17cba9cd-eb43-4b28-957e-a891d5e4ac29.sql =====
-- Create enum for project member roles
CREATE TYPE public.project_role AS ENUM ('owner', 'editor', 'viewer');

-- Create enum for invitation status
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'declined');

-- Create project_members table
CREATE TABLE public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    role project_role NOT NULL DEFAULT 'viewer',
    invited_by UUID NOT NULL,
    invited_email TEXT NOT NULL,
    status invitation_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(project_id, invited_email)
);

-- Enable RLS
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Function to check if user is project member or owner
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        -- User is owner of project
        SELECT 1 FROM public.projects WHERE id = _project_id AND user_id = _user_id
        UNION
        -- User is accepted member
        SELECT 1 FROM public.project_members 
        WHERE project_id = _project_id 
        AND user_id = _user_id 
        AND status = 'accepted'
    )
$$;

-- Function to check if user can edit project
CREATE OR REPLACE FUNCTION public.can_edit_project(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        -- User is owner of project
        SELECT 1 FROM public.projects WHERE id = _project_id AND user_id = _user_id
        UNION
        -- User is editor member
        SELECT 1 FROM public.project_members 
        WHERE project_id = _project_id 
        AND user_id = _user_id 
        AND status = 'accepted'
        AND role IN ('owner', 'editor')
    )
$$;

-- RLS Policies for project_members

-- Project owners can view all members of their projects
CREATE POLICY "Project owners can view members"
ON public.project_members FOR SELECT
USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
    OR user_id = auth.uid()
);

-- Project owners can invite members
CREATE POLICY "Project owners can invite members"
ON public.project_members FOR INSERT
WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
    AND invited_by = auth.uid()
);

-- Project owners can update members (change role, etc)
CREATE POLICY "Project owners can update members"
ON public.project_members FOR UPDATE
USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
    OR (user_id = auth.uid() AND status = 'pending')
);

-- Project owners can remove members
CREATE POLICY "Project owners can delete members"
ON public.project_members FOR DELETE
USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
    OR user_id = auth.uid()
);

-- Update projects RLS to allow members to view shared projects
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own or shared projects"
ON public.projects FOR SELECT
USING (
    user_id = auth.uid() 
    OR is_project_member(auth.uid(), id)
);

-- Update notes RLS to allow project members to access
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
CREATE POLICY "Users can view own or shared notes"
ON public.notes FOR SELECT
USING (
    user_id = auth.uid() 
    OR is_project_member(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Users can create own notes" ON public.notes;
CREATE POLICY "Users can create notes in own or editable projects"
ON public.notes FOR INSERT
WITH CHECK (
    user_id = auth.uid() 
    AND (
        EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
        OR can_edit_project(auth.uid(), project_id)
    )
);

DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
CREATE POLICY "Users can update own or editable notes"
ON public.notes FOR UPDATE
USING (
    user_id = auth.uid() 
    OR can_edit_project(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;
CREATE POLICY "Users can delete own or editable notes"
ON public.notes FOR DELETE
USING (
    user_id = auth.uid() 
    OR can_edit_project(auth.uid(), project_id)
);

-- Update tasks RLS to allow project members to access
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
CREATE POLICY "Users can view own or shared tasks"
ON public.tasks FOR SELECT
USING (
    user_id = auth.uid() 
    OR is_project_member(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Users can create own tasks" ON public.tasks;
CREATE POLICY "Users can create tasks in own or editable projects"
ON public.tasks FOR INSERT
WITH CHECK (
    user_id = auth.uid() 
    AND (
        EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
        OR can_edit_project(auth.uid(), project_id)
    )
);

DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
CREATE POLICY "Users can update own or editable tasks"
ON public.tasks FOR UPDATE
USING (
    user_id = auth.uid() 
    OR can_edit_project(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can delete own or editable tasks"
ON public.tasks FOR DELETE
USING (
    user_id = auth.uid() 
    OR can_edit_project(auth.uid(), project_id)
);

-- Trigger for updated_at
CREATE TRIGGER update_project_members_updated_at
BEFORE UPDATE ON public.project_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ===== frontend/supabase/migrations/20260101194720_8f43d20b-0916-4b6c-a9f2-5ab06ef0fea2.sql =====
-- Add archived_at column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for faster archive queries
CREATE INDEX idx_tasks_archived_at ON public.tasks(archived_at) WHERE archived_at IS NOT NULL;

-- ===== frontend/supabase/migrations/20260101201809_c5e8287a-e3aa-4d03-b75a-521d08e1694d.sql =====
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

-- ===== frontend/supabase/migrations/20260101202133_1385a042-abf6-4155-a509-21d4aad6a172.sql =====
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

-- ===== frontend/supabase/migrations/20260101202732_55be2dfb-04be-4014-b363-af1a04c18e27.sql =====
-- Add note_id column to tasks to link tasks to notes
ALTER TABLE public.tasks 
ADD COLUMN note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL;

-- ===== frontend/supabase/migrations/20260101225351_21162ea7-d2a0-4d2b-aa68-a49405feb3f8.sql =====
-- Drop the existing SELECT policy on reminders
DROP POLICY IF EXISTS "Users can view own or shared reminders" ON public.reminders;

-- Create new SELECT policy with explicit authentication check
CREATE POLICY "Users can view own or shared reminders" 
ON public.reminders 
FOR SELECT 
USING (
  auth.role() = 'authenticated' 
  AND (
    (user_id = auth.uid()) 
    OR is_project_member(auth.uid(), project_id)
  )
);

-- ===== frontend/supabase/migrations/20260101230131_53b927c6-43d2-4629-9733-df8558079cb6.sql =====
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

-- ===== frontend/supabase/migrations/20260101231410_62b39b49-5d1c-4399-b93c-42155b681713.sql =====
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

-- ===== frontend/supabase/migrations/20260102000112_93f59dac-65c9-4c70-88cf-1c727302c9b5.sql =====
-- Create app_settings table for storing application configuration
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write app settings
CREATE POLICY "Admins can view app settings"
ON public.app_settings
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert app settings"
ON public.app_settings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update app settings"
ON public.app_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete app settings"
ON public.app_settings
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default email settings
INSERT INTO public.app_settings (key, value) VALUES
  ('EMAIL_GATEWAY_URL', ''),
  ('EMAIL_GATEWAY_API_KEY', ''),
  ('email_from_name', ''),
  ('email_from_address', ''),
  ('email_reply_to', ''),
  ('email_notifications_enabled', 'false');

-- ===== frontend/supabase/migrations/20260102002926_50ea4fc5-99a2-438b-b120-a89784f0e4f2.sql =====
-- Allow authenticated users to find other profiles by email (for invitation purposes)
CREATE POLICY "Users can find profiles by email for invitations" 
ON public.profiles 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- ===== frontend/supabase/migrations/20260102003131_d4902841-825f-4d02-8089-c0a9c6db5309.sql =====
-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Project owners can update members" ON public.project_members;

-- Create new UPDATE policy that allows:
-- 1. Project owners to update any member
-- 2. Invited users (by email) to accept their pending invitation
CREATE POLICY "Project owners and invited users can update members" 
ON public.project_members 
FOR UPDATE 
USING (
  (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_members.project_id AND projects.user_id = auth.uid()))
  OR 
  (invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND status = 'pending')
);

-- Also update SELECT policy to allow invited users to see their pending invitations
DROP POLICY IF EXISTS "Project owners can view members" ON public.project_members;

CREATE POLICY "Project owners and invited users can view members" 
ON public.project_members 
FOR SELECT 
USING (
  (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_members.project_id AND projects.user_id = auth.uid()))
  OR (user_id = auth.uid())
  OR (invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- ===== frontend/supabase/migrations/20260102003320_8a9c2322-6047-4e9c-8096-720cabd00a7a.sql =====
-- Create a security definer function to get user email
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = _user_id
$$;

-- Drop and recreate UPDATE policy using the function
DROP POLICY IF EXISTS "Project owners and invited users can update members" ON public.project_members;

CREATE POLICY "Project owners and invited users can update members" 
ON public.project_members 
FOR UPDATE 
USING (
  (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_members.project_id AND projects.user_id = auth.uid()))
  OR 
  (invited_email = get_user_email(auth.uid()) AND status = 'pending')
);

-- Drop and recreate SELECT policy using the function
DROP POLICY IF EXISTS "Project owners and invited users can view members" ON public.project_members;

CREATE POLICY "Project owners and invited users can view members" 
ON public.project_members 
FOR SELECT 
USING (
  (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_members.project_id AND projects.user_id = auth.uid()))
  OR (user_id = auth.uid())
  OR (invited_email = get_user_email(auth.uid()))
);

-- ===== frontend/supabase/migrations/20260102003851_33974f7e-6cf3-4cda-96fc-7951337e265f.sql =====
-- Safer invitation acceptance/decline via security definer functions (avoids broad UPDATE/DELETE rights)

-- 1) Accept invitation function
CREATE OR REPLACE FUNCTION public.accept_project_invitation(p_member_id uuid)
RETURNS public.project_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.project_members;
BEGIN
  UPDATE public.project_members pm
  SET status = 'accepted',
      user_id = auth.uid(),
      updated_at = now()
  WHERE pm.id = p_member_id
    AND pm.status = 'pending'
    AND pm.invited_email = public.get_user_email(auth.uid())
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or not allowed';
  END IF;

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_project_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_project_invitation(uuid) TO authenticated;

-- 2) Decline invitation function
CREATE OR REPLACE FUNCTION public.decline_project_invitation(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.project_members pm
  WHERE pm.id = p_member_id
    AND pm.status = 'pending'
    AND pm.invited_email = public.get_user_email(auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or not allowed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.decline_project_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_project_invitation(uuid) TO authenticated;

-- 3) Tighten UPDATE policy back to owners only (invited users accept via function)
DROP POLICY IF EXISTS "Project owners and invited users can update members" ON public.project_members;

CREATE POLICY "Project owners can update members" 
ON public.project_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_members.project_id
      AND p.user_id = auth.uid()
  )
);

-- ===== frontend/supabase/migrations/20260102004455_ea38c3bd-4884-460e-86fe-7de4b8068d56.sql =====
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

-- ===== frontend/supabase/migrations/20260201201929_0c36e727-ed78-4e9d-b802-e5f7c99e0847.sql =====
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

-- ===== frontend/supabase/migrations/20260202175414_0d724c7c-815a-4bfc-91d9-f078ee46284f.sql =====
-- Add archived_at and is_pinned columns to notes table
ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_notes_archived_at ON public.notes(archived_at);
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON public.notes(is_pinned);

-- ===== frontend/supabase/migrations/20260210073915_e47fee1e-383f-4ccc-98d9-9029ebb83e1c.sql =====

-- Create spreadsheets table to store Google Sheets-like data per project
CREATE TABLE public.spreadsheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled',
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  column_definitions JSONB NOT NULL DEFAULT '[{"name": "A", "width": 120}, {"name": "B", "width": 120}, {"name": "C", "width": 120}, {"name": "D", "width": 120}, {"name": "E", "width": 120}]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.spreadsheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own or shared spreadsheets"
ON public.spreadsheets FOR SELECT
USING ((user_id = auth.uid()) OR is_project_member(auth.uid(), project_id));

CREATE POLICY "Users can create spreadsheets in own or editable projects"
ON public.spreadsheets FOR INSERT
WITH CHECK ((user_id = auth.uid()) AND ((EXISTS (SELECT 1 FROM projects WHERE projects.id = spreadsheets.project_id AND projects.user_id = auth.uid())) OR can_edit_project(auth.uid(), project_id)));

CREATE POLICY "Users can update own or editable spreadsheets"
ON public.spreadsheets FOR UPDATE
USING ((user_id = auth.uid()) OR can_edit_project(auth.uid(), project_id));

CREATE POLICY "Users can delete own or editable spreadsheets"
ON public.spreadsheets FOR DELETE
USING ((user_id = auth.uid()) OR can_edit_project(auth.uid(), project_id));

CREATE TRIGGER update_spreadsheets_updated_at
BEFORE UPDATE ON public.spreadsheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_spreadsheets_project_id ON public.spreadsheets(project_id);
CREATE INDEX idx_spreadsheets_user_id ON public.spreadsheets(user_id);

-- ===== frontend/supabase/migrations/20260210075457_77f3fdde-2b8c-4900-99e5-4fb52c2f24cd.sql =====
-- Add spreadsheet_id column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN spreadsheet_id UUID REFERENCES public.spreadsheets(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_tasks_spreadsheet_id ON public.tasks(spreadsheet_id);

-- ===== frontend/supabase/migrations/20260210080255_de68aeb0-7f6a-4124-85fd-d141c07aeb1e.sql =====
-- Add archived_at column to spreadsheets table
ALTER TABLE public.spreadsheets 
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- ===== frontend/supabase/migrations/20260210175813_48fc9d48-a012-4da2-b0e2-f6329390d7f6.sql =====

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);

-- Create attachments table
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  note_id UUID REFERENCES public.notes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  content_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for attachments
CREATE POLICY "Users can view attachments of their projects"
ON public.attachments FOR SELECT
USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Users can upload attachments to editable projects"
ON public.attachments FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.can_edit_project(auth.uid(), project_id));

CREATE POLICY "Users can delete own attachments"
ON public.attachments FOR DELETE
USING (auth.uid() = user_id);

-- Storage policies
CREATE POLICY "Users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments');

CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ===== frontend/supabase/migrations/20260210180811_e0c8bf3b-030f-407f-9f2f-a3f0f679cc63.sql =====
INSERT INTO public.app_settings (key, value)
VALUES ('max_file_size_mb', '4')
ON CONFLICT DO NOTHING;

-- ===== frontend/supabase/migrations/20260211090457_85c1a013-3c6c-43ac-a4eb-da139b105e2e.sql =====

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

-- ===== sql_migrations/2026_02_note_versions_and_trash.sql =====
-- ============================================
-- Notes Version History & Trash Bin (Soft Delete)
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- 1) Soft-delete column on notes (Trash bin)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);

-- 2) Versions table - one row per saved version
CREATE TABLE IF NOT EXISTS note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_versions_note_id_created_at
  ON note_versions(note_id, created_at DESC);

-- 3) RLS for note_versions
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Users can view versions of accessible notes" ON note_versions;
DROP POLICY IF EXISTS "Users can insert versions for accessible notes" ON note_versions;
DROP POLICY IF EXISTS "Users can delete their own versions" ON note_versions;

-- SELECT: viewable if the user has access to the parent note
CREATE POLICY "Users can view versions of accessible notes" ON note_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_versions.note_id
        AND (
          n.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = n.project_id AND pm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = n.project_id AND p.user_id = auth.uid()
          )
        )
    )
  );

-- INSERT: only insert versions for notes the user can access
CREATE POLICY "Users can insert versions for accessible notes" ON note_versions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_versions.note_id
        AND (
          n.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = n.project_id AND pm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = n.project_id AND p.user_id = auth.uid()
          )
        )
    )
  );

-- DELETE: users can delete their own versions
CREATE POLICY "Users can delete their own versions" ON note_versions
  FOR DELETE USING (auth.uid() = user_id);

-- 4) Optional: cleanup helper to auto-purge versions older than 90 days
-- (Not run automatically; run via cron if desired.)
-- DELETE FROM note_versions WHERE created_at < NOW() - INTERVAL '90 days';

-- ===== sql_migrations/2026_07_06_fix_attachments_storage_select.sql =====
-- Fix (Security Wave 1): storage SELECT политиката за bucket 'attachments'
-- нямаше ownership check (USING (bucket_id='attachments')) -> всеки логнат
-- потребител можеше да чете чужди файлове. Огледално на INSERT/DELETE политиките
-- (миграция 20260210175813) и на таблицата public.attachments (is_project_member).
--
-- ПРИЛАГАНЕ: изпълни този файл в Supabase SQL Editor (self-hosted).
-- Пътят на файловете е {user_id}/{project_id}/... => foldername[1] = собственика.

-- ВАЖНО: на живо политиката се казва "Users can view files in attachments"
-- (потвърдено на сървъра: qual = bucket_id='attachments' AND auth.role()='authenticated').
-- Дропваме всички възможни имена, иначе старата (свръх-позволителна) политика остава
-- успоредно на новата и RLS ги ИЛИ-ва → дупката НЕ се затваря.
DROP POLICY IF EXISTS "Users can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files in attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own or project attachments" ON storage.objects;

CREATE POLICY "Users can view own or project attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'attachments' AND (
    -- собственик (пътят започва с неговия user_id)
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- член на проекта, към който принадлежи файлът
    EXISTS (
      SELECT 1 FROM public.attachments a
      WHERE a.file_path = storage.objects.name
        AND public.is_project_member(auth.uid(), a.project_id)
    )
  )
);

-- ===== sql_migrations/2026_07_23_user_ai_settings.sql =====
-- 2026-07-23: Per-user AI/STT настройки + сигурно съхранение на ключове (Вариант A).
-- Прилага се РЪЧНО в Supabase SQL Editor. Идемпотентна (safe re-run).

-- 1) Несекретна конфигурация (браузърът чете/пише своя ред) --------------------
create table if not exists public.user_ai_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  stt_provider     text not null default 'soniox',
  stt_model        text not null default 'stt-rt-v5',
  stt_language     text not null default 'bg',
  stt_translate_to text,
  ai_provider      text not null default 'ollama',
  ai_base_url      text,
  ai_model         text not null default 'deepseek-v4-flash',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.user_ai_settings enable row level security;

drop policy if exists "own ai settings select" on public.user_ai_settings;
create policy "own ai settings select" on public.user_ai_settings
  for select using (auth.uid() = user_id);
drop policy if exists "own ai settings insert" on public.user_ai_settings;
create policy "own ai settings insert" on public.user_ai_settings
  for insert with check (auth.uid() = user_id);
drop policy if exists "own ai settings update" on public.user_ai_settings;
create policy "own ai settings update" on public.user_ai_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own ai settings delete" on public.user_ai_settings;
create policy "own ai settings delete" on public.user_ai_settings
  for delete using (auth.uid() = user_id);

-- 2) Секрети (браузърът НЕ чете; само service_role) ----------------------------
create table if not exists public.user_ai_secrets (
  user_id    uuid not null references auth.users(id) on delete cascade,
  provider   text not null,
  api_key    text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.user_ai_secrets enable row level security;
-- Нарочно БЕЗ политики за роля authenticated → браузърът няма достъп.
-- service_role (edge функции) заобикаля RLS и чете суровия ключ.

-- Belt-and-suspenders: изричен revoke, дори RLS вече да го покрива.
-- service_role заобикаля RLS/GRANT-овете и запазва достъп.
revoke all on public.user_ai_secrets from anon, authenticated;

-- 3) Запис на секрет — SECURITY DEFINER, ограничен до текущия потребител --------
create or replace function public.set_ai_secret(p_provider text, p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_provider is null or length(p_provider) = 0 then
    raise exception 'provider required';
  end if;
  if p_key is null or length(p_key) = 0 then
    raise exception 'key required';
  end if;
  insert into public.user_ai_secrets (user_id, provider, api_key, updated_at)
  values (auth.uid(), p_provider, p_key, now())
  on conflict (user_id, provider)
  do update set api_key = excluded.api_key, updated_at = now();
end;
$$;

revoke all on function public.set_ai_secret(text, text) from public;
grant execute on function public.set_ai_secret(text, text) to authenticated;

-- 4) Статус на секрет (без да връща ключа) — само зададен ли е + последни 4 ------
create or replace function public.get_ai_secret_status()
returns table(provider text, is_set boolean, last4 text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  return query
    select s.provider, true as is_set, right(s.api_key, 4) as last4
    from public.user_ai_secrets s
    where s.user_id = auth.uid();
end;
$$;

revoke all on function public.get_ai_secret_status() from public;
grant execute on function public.get_ai_secret_status() to authenticated;

-- ===== sql_migrations/2026_08_01_sport_tracker.sql =====
-- 2026-08-01: Спорт — дневник за тренировки (страница /sport).
-- Прилага се РЪЧНО в Supabase SQL Editor. Идемпотентна (safe re-run).
--
-- Три таблици, всички строго per-user (user_id + RLS). НЯМА механизъм за споделяне —
-- за разлика от projects/tasks тук няма роля, покана или колона, през която друг
-- потребител да види чужди тренировки.
--
-- Включването на функцията НЕ е отделен флаг: чете се от sport_programs.is_active.
--   няма ред        → никога не е включвано (по подразбиране изключено)
--   is_active=false → изключено, данните остават
--   is_active=true  → включено

-- 1) Програмата (шаблонът) -----------------------------------------------------
create table if not exists public.sport_programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Моят първи месец',
  start_date  date not null default current_date,
  cycle_days  smallint not null default 28 check (cycle_days between 1 and 366),
  -- цялото дърво на програмата: blocks, week_pattern, weeks, rules, measures
  content     jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Най-много една АКТИВНА програма на потребител (неактивните са без ограничение).
create unique index if not exists sport_programs_one_active
  on public.sport_programs (user_id) where is_active;

alter table public.sport_programs enable row level security;

drop policy if exists "own sport programs select" on public.sport_programs;
create policy "own sport programs select" on public.sport_programs
  for select using (auth.uid() = user_id);
drop policy if exists "own sport programs insert" on public.sport_programs;
create policy "own sport programs insert" on public.sport_programs
  for insert with check (auth.uid() = user_id);
drop policy if exists "own sport programs update" on public.sport_programs;
create policy "own sport programs update" on public.sport_programs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own sport programs delete" on public.sport_programs;
create policy "own sport programs delete" on public.sport_programs
  for delete using (auth.uid() = user_id);

-- 2) Сесиите (какво реално е направено) ----------------------------------------
create table if not exists public.sport_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  program_id   uuid references public.sport_programs(id) on delete set null,
  session_date date not null,
  -- ключ на блок от content.blocks (morning, A, walk, потребителски…).
  -- Нарочно БЕЗ check-списък: блоковете се създават от потребителя.
  block_key    text not null check (length(btrim(block_key)) > 0),
  completed    boolean not null default false,
  completed_at timestamptz,
  -- реалните числа: [{ name, weight?, reps?, time? }, …]
  entries      jsonb not null default '[]'::jsonb,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, session_date, block_key)
);

create index if not exists sport_sessions_user_date
  on public.sport_sessions (user_id, session_date desc);

alter table public.sport_sessions enable row level security;

drop policy if exists "own sport sessions select" on public.sport_sessions;
create policy "own sport sessions select" on public.sport_sessions
  for select using (auth.uid() = user_id);
drop policy if exists "own sport sessions insert" on public.sport_sessions;
create policy "own sport sessions insert" on public.sport_sessions
  for insert with check (auth.uid() = user_id);
drop policy if exists "own sport sessions update" on public.sport_sessions;
create policy "own sport sessions update" on public.sport_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own sport sessions delete" on public.sport_sessions;
create policy "own sport sessions delete" on public.sport_sessions
  for delete using (auth.uid() = user_id);

-- 3) Мерките -------------------------------------------------------------------
-- Колоната е "metrics", НЕ "values" — values е резервирана дума в SQL.
create table if not exists public.sport_measurements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  weight      numeric(5,2),
  metrics     jsonb not null default '{}'::jsonb,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, measured_on)
);

alter table public.sport_measurements enable row level security;

drop policy if exists "own sport measurements select" on public.sport_measurements;
create policy "own sport measurements select" on public.sport_measurements
  for select using (auth.uid() = user_id);
drop policy if exists "own sport measurements insert" on public.sport_measurements;
create policy "own sport measurements insert" on public.sport_measurements
  for insert with check (auth.uid() = user_id);
drop policy if exists "own sport measurements update" on public.sport_measurements;
create policy "own sport measurements update" on public.sport_measurements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own sport measurements delete" on public.sport_measurements;
create policy "own sport measurements delete" on public.sport_measurements
  for delete using (auth.uid() = user_id);

-- 4) updated_at се вдига автоматично -------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sport_programs_touch on public.sport_programs;
create trigger sport_programs_touch before update on public.sport_programs
  for each row execute function public.touch_updated_at();

drop trigger if exists sport_sessions_touch on public.sport_sessions;
create trigger sport_sessions_touch before update on public.sport_sessions
  for each row execute function public.touch_updated_at();

drop trigger if exists sport_measurements_touch on public.sport_measurements;
create trigger sport_measurements_touch before update on public.sport_measurements
  for each row execute function public.touch_updated_at();
