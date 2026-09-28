INSERT INTO public.app_settings (key, value)
VALUES ('max_file_size_mb', '4')
ON CONFLICT DO NOTHING;