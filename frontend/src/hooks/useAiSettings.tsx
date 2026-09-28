import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AiSettings = {
  stt_provider: string;
  stt_model: string;
  stt_language: string;
  stt_translate_to: string | null;
  ai_provider: string;
  ai_base_url: string | null;
  ai_model: string;
};

export type SecretStatus = { provider: string; is_set: boolean; last4: string };

const DEFAULTS: AiSettings = {
  stt_provider: 'soniox',
  stt_model: 'stt-rt-v5',
  stt_language: 'bg',
  stt_translate_to: null,
  ai_provider: 'ollama',
  ai_base_url: null,
  ai_model: 'deepseek-v4-flash',
};

export function useAiSettings() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [secretStatus, setSecretStatus] = useState<SecretStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetchSecretStatus = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_ai_secret_status');
    if (error) {
      console.error('Failed to fetch secret status', error);
    } else {
      setSecretStatus((data as SecretStatus[]) ?? []);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (userId) {
          const { data } = await supabase
            .from('user_ai_settings')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
          if (active) setSettings({ ...DEFAULTS, ...(data ?? {}) });
        }
        await refetchSecretStatus();
      } catch (e) {
        console.error('useAiSettings load failed', e);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [refetchSecretStatus]);

  const saveSettings = useCallback(async (patch: Partial<AiSettings>) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error('not authenticated');
    const next = { ...DEFAULTS, ...(settings ?? {}), ...patch };
    const { error } = await supabase
      .from('user_ai_settings')
      .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() });
    if (error) throw error;
    setSettings(next);
  }, [settings]);

  const saveSecret = useCallback(async (provider: string, key: string) => {
    const { error } = await supabase.rpc('set_ai_secret', { p_provider: provider, p_key: key });
    if (error) throw error;
    await refetchSecretStatus();
  }, [refetchSecretStatus]);

  return { settings, secretStatus, isLoading, saveSettings, saveSecret, refetchSecretStatus };
}
