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
