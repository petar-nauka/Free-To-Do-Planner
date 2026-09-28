import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sportDb } from '@/lib/sportDb';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { freshSeedContent } from '@/lib/sportProgramSeed';
import { todayISO, DEFAULT_CYCLE_DAYS } from '@/lib/sportCycle';
import type { SportContent, SportProgram } from '@/lib/sportTypes';

/**
 * Активната спортна програма на текущия потребител.
 *
 * Тук се чете и дали функцията изобщо е включена — няма отделен флаг:
 *   няма ред        → никога не е включвана (по подразбиране изключено)
 *   is_active=false → изключена, данните остават
 *   is_active=true  → включена
 */
export function useSportProgram() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: program = null, isLoading } = useQuery({
    queryKey: ['sport-program', user?.id],
    queryFn: async (): Promise<SportProgram | null> => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await sportDb
        .from('sport_programs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return (data as SportProgram) || null;
    },
    enabled: !!user,
  });

  const isEnabled = !!program;

  /**
   * Включване: ако има изключена програма — активира я със запазени данни;
   * иначе създава нова от шаблона.
   */
  const enableSport = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data: existing, error: findError } = await sportDb
        .from('sport_programs')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', false)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        const { error } = await sportDb
          .from('sport_programs')
          .update({ is_active: true })
          .eq('id', existing.id);
        if (error) throw error;
        return;
      }

      const { error } = await sportDb.from('sport_programs').insert({
        user_id: user.id,
        name: 'Моят първи месец',
        start_date: todayISO(),
        cycle_days: DEFAULT_CYCLE_DAYS,
        content: freshSeedContent(),
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sport-program'] });
      toast({ title: 'Спортът е включен', description: 'Готова е 4-седмична програма, която можеш да редактираш.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Грешка при включване', description: e.message, variant: 'destructive' });
    },
  });

  /** Изключване: само маркира програмата като неактивна. Нищо не се трие. */
  const disableSport = useMutation({
    mutationFn: async () => {
      if (!program) return;
      const { error } = await sportDb
        .from('sport_programs')
        .update({ is_active: false })
        .eq('id', program.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sport-program'] });
      toast({ title: 'Спортът е изключен', description: 'Записаните тренировки остават запазени.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Грешка при изключване', description: e.message, variant: 'destructive' });
    },
  });

  const updateContent = useMutation({
    mutationFn: async (content: SportContent) => {
      if (!program) throw new Error('Няма активна програма');
      const { error } = await sportDb
        .from('sport_programs')
        .update({ content })
        .eq('id', program.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sport-program'] });
      toast({ title: 'Програмата е записана' });
    },
    onError: (e: Error) => {
      toast({ title: 'Грешка при запис', description: e.message, variant: 'destructive' });
    },
  });

  /** Мести началото на броенето — „Започни нов цикъл от днес". */
  const setStartDate = useMutation({
    mutationFn: async (startDate: string) => {
      if (!program) throw new Error('Няма активна програма');
      const { error } = await sportDb
        .from('sport_programs')
        .update({ start_date: startDate })
        .eq('id', program.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sport-program'] });
      toast({ title: 'Началото на програмата е преместено' });
    },
    onError: (e: Error) => {
      toast({ title: 'Грешка', description: e.message, variant: 'destructive' });
    },
  });

  return {
    program,
    isEnabled,
    isLoading,
    enableSport: enableSport.mutate,
    disableSport: disableSport.mutate,
    isToggling: enableSport.isPending || disableSport.isPending,
    updateContent: updateContent.mutate,
    setStartDate: setStartDate.mutate,
  };
}
