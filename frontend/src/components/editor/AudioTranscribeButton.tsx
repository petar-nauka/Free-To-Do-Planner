import { useEffect, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSonioxTranscription } from '@/hooks/useSonioxTranscription';
import { useAiSettings } from '@/hooks/useAiSettings';

type Mode = 'bg' | 'bg2en' | 'en';

// Режими на диктовка: език на говора + (по избор) език на превода.
const MODES: Record<Mode, { label: string; language: string; translateTo?: string }> = {
  bg: { label: 'БГ → БГ', language: 'bg' },
  bg2en: { label: 'БГ → EN', language: 'bg', translateTo: 'en' },
  en: { label: 'EN → EN', language: 'en' },
};

const STORAGE_KEY = 'audio_transcribe_mode';

export function AudioTranscribeButton({ editor }: { editor: Editor }) {
  const { settings, secretStatus } = useAiSettings();
  const { toast } = useToast();
  const hasKey = secretStatus.some((s) => s.provider === 'soniox' && s.is_set);

  const [mode, setMode] = useState<Mode>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return saved && saved in MODES ? (saved as Mode) : 'bg';
  });
  const cfg = MODES[mode];

  const { isRecording, error, start, stop } = useSonioxTranscription({
    language: cfg.language,
    translateTo: cfg.translateTo,
    model: settings?.stt_model ?? 'stt-rt-v5',
    onFinalText: (text) => { editor.chain().focus().insertContent(text).run(); },
  });

  // Покажи грешка от Soniox (иначе диктовката „спира" без обяснение).
  useEffect(() => {
    if (error) toast({ title: 'Диктовката спря', description: error, variant: 'destructive' });
  }, [error, toast]);

  const onModeChange = (v: string) => {
    setMode(v as Mode);
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant={isRecording ? 'destructive' : 'ghost'}
        size="sm"
        disabled={!hasKey}
        title={hasKey ? (isRecording ? 'Спри записа' : `Диктувай (${cfg.label})`) : 'Задай Soniox ключ в Настройки'}
        className="rounded-lg h-8 w-8 p-0"
        onClick={() => (isRecording ? stop() : start())}
      >
        {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </Button>

      <Select value={mode} onValueChange={onModeChange} disabled={isRecording || !hasKey}>
        <SelectTrigger className="h-8 w-[86px] text-xs rounded-lg px-2" title="Език на диктовката / превод">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(MODES) as Mode[]).map((k) => (
            <SelectItem key={k} value={k} className="text-xs">{MODES[k].label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
