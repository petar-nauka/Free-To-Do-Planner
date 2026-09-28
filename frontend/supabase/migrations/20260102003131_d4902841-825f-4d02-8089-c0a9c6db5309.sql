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