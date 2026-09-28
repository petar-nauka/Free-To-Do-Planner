import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AppSetting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('app_settings' as any)
      .select('*')
      .order('key');

    if (error) {
      console.error('Error fetching app settings:', error);
    } else {
      setSettings((data as unknown as AppSetting[]) || []);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from('app_settings' as any)
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);

    if (error) {
      console.error('Error updating setting:', error);
      throw error;
    }

    await fetchSettings();
  };

  const getSetting = (key: string): string | null => {
    const setting = settings.find(s => s.key === key);
    return setting?.value ?? null;
  };

  return { 
    settings, 
    loading, 
    updateSetting, 
    getSetting,
    refetch: fetchSettings 
  };
}
