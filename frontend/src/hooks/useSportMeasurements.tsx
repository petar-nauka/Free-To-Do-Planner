import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sportDb } from '@/lib/sportDb';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import type { SportMeasurement } from '@/lib/sportTypes';

/**
 * Мерките (тегло, обиколки) — по един ред на дата.
 *
 * Колоната в базата се казва `metrics`, а не `values`: `values` е резервирана дума в SQL.
 */
export function useSportMeasurements() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ['sport-measurements', user?.id],
    queryFn: async (): Promise<SportMeasurement[]> => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await sportDb
        .from('sport_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('measured_on', { ascending: false });

      if (error) throw error;
      return ((data as SportMeasurement[]) || []).map((m) => ({
        ...m,
        metrics: m.metrics && typeof m.metrics === 'object' ? m.metrics : {},
      }));
    },
    enabled: !!user,
  });

  const findMeasurement = (measuredOn: string) =>
    measurements.find((m) => m.measured_on === measuredOn) || null;

  const setMetric = useMutation({
    mutationFn: async ({
      measuredOn,
      key,
      value,
    }: {
      measuredOn: string;
      key: string;
      value: number | null;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const existing = findMeasurement(measuredOn);
      const metrics = { ...(existing?.metrics ?? {}) };
      if (value === null) delete metrics[key];
      else metrics[key] = value;

      const { error } = await sportDb.from('sport_measurements').upsert(
        {
          user_id: user.id,
          measured_on: measuredOn,
          // `weight` е и отделна колона, за да може да се сортира и филтрира в SQL.
          weight: metrics.weight ?? null,
          metrics,
        },
        { onConflict: 'user_id,measured_on' },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sport-measurements'] });
    },
    onError: (e: Error) => {
      toast({ title: 'Мерките не се записаха', description: e.message, variant: 'destructive' });
    },
  });

  return {
    measurements,
    isLoading,
    findMeasurement,
    setMetric: setMetric.mutate,
  };
}
