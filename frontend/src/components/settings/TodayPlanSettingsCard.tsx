import { useTranslation } from 'react-i18next';
import { Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTodayPlanSettings } from '@/hooks/useTodayPlanSettings';

export function TodayPlanSettingsCard() {
  const { t } = useTranslation();
  const { isEnabled, toggleEnabled } = useTodayPlanSettings();

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          {t('todayPlan.settings')}
        </CardTitle>
        <CardDescription>{t('todayPlan.settingsDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <Label htmlFor="today-plan-toggle" className="font-medium">
              {t('todayPlan.enableFeature')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('todayPlan.enableDescription')}
            </p>
          </div>
          <Switch 
            id="today-plan-toggle" 
            checked={isEnabled} 
            onCheckedChange={toggleEnabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
