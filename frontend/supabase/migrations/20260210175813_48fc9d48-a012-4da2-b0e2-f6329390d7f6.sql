
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
