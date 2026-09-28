import { useNavigate } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSportProgram } from '@/hooks/useSportProgram';

/**
 * Превключвателят за спортния дневник.
 *
 * Състоянието НЕ е отделен флаг — идва от `sport_programs.is_active`, затова се
 * синхронизира между устройства (за разлика от „План за днес", чийто флаг е в localStorage).
 * Изключването не трие нищо: сесиите и мерките остават.
 */
export function SportSettingsCard() {
  const navigate = useNavigate();
  const { isEnabled, isLoading, enableSport, disableSport, isToggling } = useSportProgram();

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dumbbell className="w-5 h-5" />
          Спорт
        </CardTitle>
        <CardDescription>Дневник за тренировки, отделно от задачите</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="sport-toggle" className="font-medium">
              Включи спорта
            </Label>
            <p className="text-sm text-muted-foreground">
              Появява се раздел „Спорт" с готова 4-седмична програма, която после си
              редактираш. Изключването не трие записаните тренировки.
            </p>
          </div>
          <Switch
            id="sport-toggle"
            checked={isEnabled}
            disabled={isLoading || isToggling}
            onCheckedChange={(next) => (next ? enableSport() : disableSport())}
          />
        </div>

        {isEnabled && (
          <Button variant="outline" className="rounded-xl" onClick={() => navigate('/sport')}>
            Отвори дневника
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
