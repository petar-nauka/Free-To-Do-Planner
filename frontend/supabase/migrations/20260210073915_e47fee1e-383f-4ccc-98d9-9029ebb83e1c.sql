
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
