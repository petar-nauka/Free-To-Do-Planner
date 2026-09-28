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