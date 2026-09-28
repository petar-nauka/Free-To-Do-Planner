-- Allow authenticated users to find other profiles by email (for invitation purposes)
CREATE POLICY "Users can find profiles by email for invitations" 
ON public.profiles 
FOR SELECT 
USING (auth.role() = 'authenticated');