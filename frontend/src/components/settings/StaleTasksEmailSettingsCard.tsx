import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MailWarning } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

/**
 * Личният ключ за седмичния имейл „непипани задачи" (profiles.stale_tasks_email).
 * Писмото го праща edge функцията stale-tasks-digest; тя спазва и ключа на всеки проект.
 */
export function StaleTasksEmailSettingsCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['stale-tasks-email', user?.id];

  const { data: enabled, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('stale_tasks_email')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data.stale_tasks_email;
    },
    enabled: !!user,
  });

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase.from('profiles').update({ stale_tasks_email: next }).eq('user_id', user!.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => queryClient.setQueryData(queryKey, next),
    onError: (error: Error) => toast({ title: 'Грешка', description: error.message, variant: 'destructive' }),
  });

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailWarning className="w-5 h-5" />
          Имейл за непипани задачи
        </CardTitle>
        <CardDescription>
          Всеки понеделник сутрин — списък с твоите задачи, които не са променяни повече от 30 дни.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="stale-tasks-email-toggle" className="font-medium">
              Получавай седмичния имейл
            </Label>
            <p className="text-sm text-muted-foreground">
              За отделен проект може да се спре и от редакцията на проекта.
            </p>
          </div>
          <Switch
            id="stale-tasks-email-toggle"
            checked={enabled ?? true}
            disabled={isLoading || toggle.isPending}
            onCheckedChange={(next) => toggle.mutate(next)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
