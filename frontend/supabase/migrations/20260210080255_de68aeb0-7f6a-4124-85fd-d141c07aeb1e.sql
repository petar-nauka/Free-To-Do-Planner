-- Add archived_at column to spreadsheets table
ALTER TABLE public.spreadsheets 
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;