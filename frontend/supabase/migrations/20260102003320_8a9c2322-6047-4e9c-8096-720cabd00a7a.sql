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