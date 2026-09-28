import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Loader2 } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useToast } from '@/hooks/use-toast';

export function FileUploadSettingsCard() {
  const { getSetting, updateSetting, loading } = useAppSettings();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const currentValue = getSetting('max_file_size_mb') || '4';
  const [value, setValue] = useState(currentValue);

  const handleSave = async () => {
    const num = parseInt(value);
    if (isNaN(num) || num < 1 || num > 100) {
      toast({ title: 'Невалидна стойност', description: 'Въведете число между 1 и 100 MB', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await updateSetting('max_file_size_mb', String(num));
      toast({ title: 'Успех', description: `Максималният размер е ${num} MB` });
    } catch {
      toast({ title: 'Грешка', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Максимален размер на файл
        </CardTitle>
        <CardDescription>Задайте лимита за прикачени файлове (в MB)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Label htmlFor="max-file-size" className="sr-only">MB</Label>
          <Input
            id="max-file-size"
            type="number"
            min={1}
            max={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">MB</span>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Запази'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
