import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sportDb } from '@/lib/sportDb';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import type { SportEntry, SportSession } from '@/lib/sportTypes';

interface UpsertArgs {
  sessionDate: string;
  blockKey: string;
  patch: Partial<Pick<SportSession, 'completed' | 'entries' | 'note'>>;
}

/**
 * Всички сесии на потребителя.
 *
 * Тегли се наведнъж, защото графиките за напредък гледат през всички цикли, а обемът
 * е малък (~3 реда на ден). Сметките се правят в `lib/sportCycle.ts` върху вече
 * кешираните от TanStack Query данни, вместо с отделни заявки.
 */
export function useSportSessions(programId?: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sport-sessions', user?.id],
    queryFn: async (): Promise<SportSession[]> => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await sportDb
        .from('sport_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('session_date', { ascending: true });

      if (error) throw error;
      return ((data as SportSession[]) || []).map((s) => ({
        ...s,
        entries: Array.isArray(s.entries) ? s.entries : [],
      }));
    },
    enabled: !!user,
  });

  const findSession = (sessionDate: string, blockKey: string) =>
    sessions.find((s) => s.session_date === sessionDate && s.block_key === blockKey) || null;

  /**
   * Създава или обновява сесията за (ден, блок). Разчита на
   * `UNIQUE(user_id, session_date, block_key)` — не се налага четене преди запис.
   */
  const upsertSession = useMutation({
    mutationFn: async ({ sessionDate, blockKey, patch }: UpsertArgs) => {
      if (!user) throw new Error('Not authenticated');

      const existing = findSession(sessionDate, blockKey);
      const row = {
        user_id: user.id,
        program_id: programId ?? null,
        session_date: sessionDate,
        block_key: blockKey,
        completed: patch.completed ?? existing?.completed ?? false,
        completed_at:
          (patch.completed ?? existing?.completed) ? new Date().toISOString() : null,
        entries: patch.entries ?? existing?.entries ?? [],
        note: patch.note ?? existing?.note ?? null,
      };

      const { error } = await sportDb
        .from('sport_sessions')
        .upsert(row, { onConflict: 'user_id,session_date,block_key' });

      if (error) throw error;
    },

    // Оптимистично: отметката трябва да реагира веднага, мрежата настига после.
    onMutate: async ({ sessionDate, blockKey, patch }: UpsertArgs) => {
      await queryClient.cancelQueries({ queryKey: ['sport-sessions', user?.id] });
      const previous = queryClient.getQueryData<SportSession[]>(['sport-sessions', user?.id]);

      queryClient.setQueryData<SportSession[]>(['sport-sessions', user?.id], (old = []) => {
        const idx = old.findIndex(
          (s) => s.session_date === sessionDate && s.block_key === blockKey,
        );
        if (idx >= 0) {
          const next = [...old];
          next[idx] = { ...next[idx], ...patch };
          return next;
        }
        return [
          ...old,
          {
            id: `optimistic-${sessionDate}-${blockKey}`,
            user_id: user?.id ?? '',
            program_id: programId ?? null,
            session_date: sessionDate,
            block_key: blockKey,
            completed: patch.completed ?? false,
            completed_at: null,
            entries: patch.entries ?? [],
            note: patch.note ?? null,
          },
        ];
      });

      return { previous };
    },

    onError: (e: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['sport-sessions', user?.id], context.previous);
      }
      toast({ title: 'Записът не мина', description: e.message, variant: 'destructive' });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sport-sessions'] });
    },
  });

  const toggleCompleted = (sessionDate: string, blockKey: string) => {
    const current = findSession(sessionDate, blockKey);
    upsertSession.mutate({
      sessionDate,
      blockKey,
      patch: { completed: !current?.completed },
    });
  };

  /** Записва едно число за упражнение. Празна стойност махва полето. */
  const setEntryValue = (
    sessionDate: string,
    blockKey: string,
    exerciseName: string,
    field: 'weight' | 'reps' | 'time',
    value: number | null,
  ) => {
    const current = findSession(sessionDate, blockKey);
    const entries: SportEntry[] = current?.entries ? [...current.entries] : [];
    const idx = entries.findIndex((e) => e.name === exerciseName);

    if (idx >= 0) {
      const next = { ...entries[idx] };
      if (value === null) delete next[field];
      else next[field] = value;
      // Останало е само името → упражнението няма записани числа, махаме го.
      if (Object.keys(next).length === 1) entries.splice(idx, 1);
      else entries[idx] = next;
    } else if (value !== null) {
      entries.push({ name: exerciseName, [field]: value });
    }

    upsertSession.mutate({ sessionDate, blockKey, patch: { entries } });
  };

  const setNote = (sessionDate: string, blockKey: string, note: string) => {
    upsertSession.mutate({ sessionDate, blockKey, patch: { note } });
  };

  return {
    sessions,
    isLoading,
    findSession,
    toggleCompleted,
    setEntryValue,
    setNote,
  };
}
