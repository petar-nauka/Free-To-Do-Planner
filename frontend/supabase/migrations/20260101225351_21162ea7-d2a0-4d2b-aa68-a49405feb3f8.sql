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