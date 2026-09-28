import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart2, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useToast } from '@/hooks/use-toast';

const DAYS = [
  { value: '1', label: 'Понеделник' },
  { value: '2', label: 'Вторник' },
  { value: '3', label: 'Сряда' },
  { value: '4', label: 'Четвъртък' },
  { value: '5', label: 'Петък' },
  { value: '6', label: 'Събота' },
  { value: '0', label: 'Неделя' },
];

const HOURS = Array.from({ length: 18 }, (_, i) => {
  const h = i + 6; // 06:00 - 23:00
  return { value: String(h), label: `${String(h).padStart(2, '0')}:00` };
});

export function WeeklyReportSettingsCard() {
  const { t } = useTranslation();
  const { settings, loading, updateSetting } = useAppSettings();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(true);
  const [day, setDay] = useState('1');
  const [hour, setHour] = useState('8');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!loading && settings.length > 0) {
      const get = (key: string, fb: string) => settings.find(s => s.key === key)?.value ?? fb;
      setEnabled(get('weekly_report_enabled', 'true') === 'true');
      setDay(get('weekly_report_day', '1'));
      setHour(get('weekly_report_hour', '8'));
    }
  }, [loading, settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSetting('weekly_report_enabled', enabled ? 'true' : 'false');
      await updateSetting('weekly_report_day', day);
      await updateSetting('weekly_report_hour', hour);
      setIsDirty(false);
      toast({ title: t('common.success'), description: t('weeklyReport.saved', 'Настройките са запазени') });
    } catch {
      toast({ title: t('common.error'), description: t('weeklyReport.saveFailed', 'Неуспешно запазване'), variant: 'destructive' });
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

  const dayLabel = DAYS.find(d => d.value === day)?.label ?? 'Понеделник';
  const hourLabel = HOURS.find(h => h.value === hour)?.label ?? '08:00';

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5" />
          {t('weeklyReport.title', 'Седмичен отчет по имейл')}
        </CardTitle>
        <CardDescription>
          {t('weeklyReport.description', 'Автоматичен имейл с завършени задачи, просрочени и изхарчено време')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="weekly-toggle" className="font-medium">
              {t('weeklyReport.enable', 'Активирай седмичен отчет')}
            </Label>
            <p className="text-sm text-muted-foreground mt-0.5">
              {enabled
                ? t('weeklyReport.enabledDesc', `Изпраща се всеки ${dayLabel} в ${hourLabel} ч.`)
                : t('weeklyReport.disabledDesc', 'Отчетът е изключен')}
            </p>
          </div>
          <Switch
            id="weekly-toggle"
            checked={enabled}
            onCheckedChange={(v) => { setEnabled(v); setIsDirty(true); }}
          />
        </div>

        {enabled && (
          <div className="grid grid-cols-2 gap-4">
            {/* Day */}
            <div className="space-y-2">
              <Label className="font-medium">{t('weeklyReport.day', 'Ден на изпращане')}</Label>
              <Select value={day} onValueChange={(v) => { setDay(v); setIsDirty(true); }}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Hour */}
            <div className="space-y-2">
              <Label className="font-medium">{t('weeklyReport.hour', 'Час')}</Label>
              <Select value={hour} onValueChange={(v) => { setHour(v); setIsDirty(true); }}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map(h => (
                    <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* What's included info */}
        {enabled && (
          <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">{t('weeklyReport.includes', 'Имейлът съдържа:')}</p>
            <p>✅ {t('weeklyReport.completedTasks', 'Завършени задачи през седмицата')}</p>
            <p>⏱️ {t('weeklyReport.trackedTime', 'Общо изхарчено време')}</p>
            <p>⚠️ {t('weeklyReport.overdueTasks', 'Просрочени задачи')}</p>
            <p>📅 {t('weeklyReport.upcomingDeadlines', 'Предстоящи дедлайни (7 дни)')}</p>
          </div>
        )}

        <Button onClick={handleSave} disabled={isSaving || !isDirty} className="w-full rounded-xl">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {t('common.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
