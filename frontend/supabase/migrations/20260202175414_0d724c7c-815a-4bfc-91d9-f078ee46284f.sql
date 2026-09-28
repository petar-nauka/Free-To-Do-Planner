-- Add archived_at and is_pinned columns to notes table
ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_notes_archived_at ON public.notes(archived_at);
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON public.notes(is_pinned);