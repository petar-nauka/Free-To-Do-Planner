-- Add spreadsheet_id column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN spreadsheet_id UUID REFERENCES public.spreadsheets(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_tasks_spreadsheet_id ON public.tasks(spreadsheet_id);