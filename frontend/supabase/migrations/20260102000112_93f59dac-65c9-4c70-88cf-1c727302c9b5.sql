-- Create app_settings table for storing application configuration
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write app settings
CREATE POLICY "Admins can view app settings"
ON public.app_settings
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert app settings"
ON public.app_settings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update app settings"
ON public.app_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete app settings"
ON public.app_settings
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default email settings
INSERT INTO public.app_settings (key, value) VALUES
  ('EMAIL_GATEWAY_URL', ''),
  ('EMAIL_GATEWAY_API_KEY', ''),
  ('email_from_name', ''),
  ('email_from_address', ''),
  ('email_reply_to', ''),
  ('email_notifications_enabled', 'false');