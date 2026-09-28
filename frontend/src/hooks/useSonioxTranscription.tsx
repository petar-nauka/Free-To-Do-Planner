import { useCallback, useEffect, useRef, useState } from 'react';
import { SonioxClient } from '@soniox/speech-to-text-web';
import { supabase } from '@/integrations/supabase/client';

type SonioxToken = { text: string; is_final?: boolean; translation_status?: string };

type Params = {
  onFinalText: (text: string) => void;
  language?: string;
  model?: string;
  /** Ако е зададен (напр. 'en'), Soniox превежда в реално време към този език (one-way). */
  translateTo?: string;
};

export function useSonioxTranscription({
  onFinalText,
  language = 'bg',
  model = 'stt-rt-v5',
  translateTo,
}: Params) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<InstanceType<typeof SonioxClient> | null>(null);

  const start = useCallback(async () => {
    setError(null);
    const client = new SonioxClient({
      // Async функция → временен ключ; дългият ключ не влиза в браузъра.
      apiKey: async () => {
        const { data, error } = await supabase.functions.invoke('ai-soniox-token');
        if (error || !data?.apiKey) throw new Error('Неуспешно взимане на Soniox токен');
        return data.apiKey as string;
      },
      onStarted: () => setIsRecording(true),
      onFinished: () => setIsRecording(false),
      onError: (status: string, message: string, errorCode?: number) => {
        console.error('[soniox] error', { status, message, errorCode });
        setError(`${status}: ${message}${errorCode ? ` (${errorCode})` : ''}`);
        setIsRecording(false);
      },
      onPartialResult: (result: { tokens: SonioxToken[] }) => {
        // При превод Soniox връща и оригиналните, и преведените токени в един поток,
        // маркирани с translation_status ('original' | 'translation'). Вмъкваме само
        // преведените когато има превод; иначе — оригиналните (status 'none'/'original'/undefined).
        const finalText = result.tokens
          .filter((t) => t.is_final)
          .filter((t) => (translateTo ? t.translation_status === 'translation' : t.translation_status !== 'translation'))
          .map((t) => t.text)
          .join('');
        if (finalText) onFinalText(finalText);
      },
    });
    clientRef.current = client;
    const startOpts: Parameters<typeof client.start>[0] = {
      model,
      languageHints: [language],
      ...(translateTo ? { translation: { type: 'one_way' as const, target_language: translateTo } } : {}),
    };
    void Promise.resolve(client.start(startOpts)).catch((e) => {
      console.error('[soniox] start() rejected', e);
      setError(String(e));
      setIsRecording(false);
    });
  }, [onFinalText, language, model, translateTo]);

  const stop = useCallback(async () => {
    await clientRef.current?.stop();
    clientRef.current = null;
    setIsRecording(false);
  }, []);

  // Ако компонентът се размонтира (напр. смяна на бележка → RichTextEditor се
  // ремонтира заради key={selectedNoteId}) докато диктовката тече, микрофонът
  // и Soniox WebSocket-ът иначе остават активни (утечка на поверителност + billing).
  // cancel() прекратява веднага, за разлика от stop() (изчаква финализиране).
  useEffect(() => () => { clientRef.current?.cancel?.(); clientRef.current = null; }, []);

  return { isRecording, error, start, stop };
}
