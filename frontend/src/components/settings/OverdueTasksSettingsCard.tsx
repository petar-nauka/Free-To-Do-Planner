import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useToast } from '@/hooks/use-toast';

export function OverdueTasksSettingsCard() {
  const { t } = useTranslation();
  const { settings, loading, updateSetting } = useAppSettings();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(true);
  const [days, setDays] = useState('7');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!loading && settings.length > 0) {
      const getVal = (key: string, fallback: string) =>
        settings.find(s => s.key === key)?.value ?? fallback;

      const enabledVal = getVal('overdue_notifications_enabled', 'true');
      const daysVal = getVal('overdue_task_days', '7');

      setEnabled(enabledVal === 'true');
      setDays(daysVal);
    }
  }, [loading, settings]);

  const handleSave = async () => {
    const parsedDays = parseInt(days, 10);
    if (isNaN(parsedDays) || parsedDays < 1) {
      toast({
        title: t('common.error'),
        description: t('overdueSettings.daysError'),
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateSetting('overdue_notifications_enabled', enabled ? 'true' : 'false');
      await updateSetting('overdue_task_days', String(parsedDays));
      setIsDirty(false);
      toast({
        title: t('common.success'),
        description: t('overdueSettings.saved'),
      });
    } catch {
      toast({
        title: t('common.error'),
        description: t('overdueSettings.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t('overdueSettings.title')}
        </CardTitle>
        <CardDescription>{t('overdueSettings.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="overdue-toggle" className="font-medium">
              {t('overdueSettings.enable')}
            </Label>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('overdueSettings.enableDesc')}
            </p>
          </div>
          <Switch
            id="overdue-toggle"
            checked={enabled}
            onCheckedChange={(v) => { setEnabled(v); setIsDirty(true); }}
          />
        </div>

        {/* Days input */}
        {enabled && (
          <div className="space-y-2">
            <Label htmlFor="overdue-days" className="font-medium">
              {t('overdueSettings.daysLabel')}
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="overdue-days"
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => { setDays(e.target.value); setIsDirty(true); }}
                className="rounded-xl w-28"
              />
              <span className="text-sm text-muted-foreground">
                {t('overdueSettings.daysAfterDue')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('overdueSettings.hint', { days })}
            </p>
          </div>
        )}

        {/* Save */}
        <Button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="w-full rounded-xl"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {t('common.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
