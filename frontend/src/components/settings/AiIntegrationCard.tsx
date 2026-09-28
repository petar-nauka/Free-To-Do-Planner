import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAiSettings } from '@/hooks/useAiSettings';

// Извлича четимо съобщение от Supabase/JS грешка (иначе String(obj) дава "[object Object]").
function errMsg(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const x = e as Record<string, unknown>;
    return (
      (x.message as string) ||
      (x.error_description as string) ||
      (x.hint as string) ||
      (x.details as string) ||
      JSON.stringify(e)
    );
  }
  return String(e);
}

export default function AiIntegrationCard() {
  const { settings, secretStatus, isLoading, saveSettings, saveSecret } = useAiSettings();
  const { toast } = useToast();

  const [sonioxKey, setSonioxKey] = useState('');
  const [ollamaKey, setOllamaKey] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [sttModel, setSttModel] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (settings) {
      setAiBaseUrl(settings.ai_base_url ?? '');
      setAiModel(settings.ai_model);
      setSttModel(settings.stt_model);
    }
  }, [settings]);

  const sonioxStatus = secretStatus.find((s) => s.provider === 'soniox');
  const ollamaStatus = secretStatus.find((s) => s.provider === 'ollama');

  if (isLoading) return null;

  const onSaveSonioxKey = async () => {
    if (!sonioxKey) return;
    try {
      await saveSecret('soniox', sonioxKey);
      setSonioxKey('');
      toast({ title: 'Soniox ключ запазен' });
    } catch (e) {
      console.error('AI settings save failed', e);
      toast({ title: 'Грешка при запис', description: errMsg(e), variant: 'destructive' });
    }
  };

  const onSaveOllamaKey = async () => {
    if (!ollamaKey) return;
    try {
      await saveSecret('ollama', ollamaKey);
      setOllamaKey('');
      toast({ title: 'Ollama ключ запазен' });
    } catch (e) {
      console.error('AI settings save failed', e);
      toast({ title: 'Грешка при запис', description: errMsg(e), variant: 'destructive' });
    }
  };

  const onSaveConfig = async () => {
    try {
      await saveSettings({ stt_model: sttModel, ai_base_url: aiBaseUrl || null, ai_model: aiModel });
      toast({ title: 'Настройките са запазени' });
    } catch (e) {
      console.error('AI settings save failed', e);
      toast({ title: 'Грешка при запис', description: errMsg(e), variant: 'destructive' });
    }
  };

  const onTestSoniox = async () => {
    setTesting(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('ai-soniox-token');
      if (error || !data?.apiKey) throw error ?? new Error('няма токен');
      toast({ title: 'Soniox връзката работи' });
    } catch (e) {
      console.error('Soniox test failed', e);
      toast({ title: 'Soniox тест неуспешен', description: errMsg(e), variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>AI и гласови настройки</CardTitle>
        <CardDescription>Всеки потребител задава своите ключове. Ключовете се пазят на сървъра и не се показват обратно.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Гласови бележки (Soniox) */}
        <div className="space-y-3">
          <h3 className="font-medium">Гласови бележки (Soniox)</h3>
          <div className="space-y-2">
            <Label htmlFor="soniox-key">Soniox API ключ</Label>
            {sonioxStatus?.is_set && (
              <p className="text-sm text-muted-foreground">✔ зададен · …{sonioxStatus.last4}</p>
            )}
            <div className="flex gap-2">
              <Input id="soniox-key" type="password" placeholder="Нов Soniox ключ"
                value={sonioxKey} onChange={(e) => setSonioxKey(e.target.value)} />
              <Button onClick={onSaveSonioxKey} disabled={!sonioxKey}>Запази</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stt-model">STT модел</Label>
            <Input id="stt-model" value={sttModel} onChange={(e) => setSttModel(e.target.value)} />
          </div>
          <Button variant="outline" onClick={onTestSoniox} disabled={testing || !sonioxStatus?.is_set}>
            Провери връзката
          </Button>
        </div>

        {/* AI модел (Ollama) */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-medium">AI модел (Ollama)</h3>
          <p className="text-sm text-muted-foreground">Ползва се за AI функции (обобщение/помощ) — идват в следваща фаза.</p>
          <div className="space-y-2">
            <Label htmlFor="ai-base-url">Base URL</Label>
            <Input id="ai-base-url" placeholder="http://..." value={aiBaseUrl} onChange={(e) => setAiBaseUrl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-model">Модел</Label>
            <Input id="ai-model" value={aiModel} onChange={(e) => setAiModel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ollama-key">Ollama API ключ (по избор)</Label>
            {ollamaStatus?.is_set && (
              <p className="text-sm text-muted-foreground">✔ зададен · …{ollamaStatus.last4}</p>
            )}
            <div className="flex gap-2">
              <Input id="ollama-key" type="password" placeholder="Нов Ollama ключ"
                value={ollamaKey} onChange={(e) => setOllamaKey(e.target.value)} />
              <Button onClick={onSaveOllamaKey} disabled={!ollamaKey}>Запази</Button>
            </div>
          </div>
        </div>

        <Button onClick={onSaveConfig}>Запази настройките</Button>
      </CardContent>
    </Card>
  );
}
