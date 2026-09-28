-- Add note_id column to tasks to link tasks to notes
ALTER TABLE public.tasks 
ADD COLUMN note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL;