import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  stopped_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0м';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

/** Returns the active time entry for the current user (only one at a time) */
export function useActiveTimer() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['active-timer', user?.id],
    queryFn: async (): Promise<TimeEntry | null> => {
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('stopped_at', null)
        .maybeSingle();
      if (error) { console.error('useActiveTimer error:', error); return null; }
      return data as TimeEntry | null;
    },
    enabled: !!user,
    refetchInterval: 10000, // poll every 10s to sync across tabs
  });
}

/** Returns total tracked seconds for a specific task */
export function useTaskTotalTime(taskId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['task-total-time', taskId],
    queryFn: async (): Promise<number> => {
      if (!user || !taskId) return 0;
      const { data, error } = await (supabase as any)
        .from('tasks')
        .select('total_time_seconds')
        .eq('id', taskId)
        .maybeSingle();
      if (error) return 0;
      return (data as any)?.total_time_seconds ?? 0;
    },
    enabled: !!user && !!taskId,
  });
}

/** Returns time entries history for a specific task */
export function useTaskTimeHistory(taskId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['task-time-history', taskId],
    queryFn: async (): Promise<TimeEntry[]> => {
      if (!user || !taskId) return [];
      const { data, error } = await (supabase as any)
        .from('time_entries')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .not('stopped_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(10);
      if (error) return [];
      return (data as TimeEntry[]) || [];
    },
    enabled: !!user && !!taskId,
  });
}

/** Returns total time tracked THIS week (Mon-Sun) */
export function useWeeklyTrackedTime() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['weekly-tracked-time', user?.id],
    queryFn: async (): Promise<number> => {
      if (!user) return 0;
      // Start of current week (Monday)
      const now = new Date();
      const day = now.getDay(); // 0=Sun
      const diff = (day === 0 ? -6 : 1 - day);
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      monday.setHours(0, 0, 0, 0);

      const { data, error } = await (supabase as any)
        .from('time_entries')
        .select('duration_seconds')
        .eq('user_id', user.id)
        .not('stopped_at', 'is', null)
        .gte('started_at', monday.toISOString());

      if (error) return 0;
      return ((data as any[]) || []).reduce((sum: number, e: any) => sum + (e.duration_seconds || 0), 0);
    },
    enabled: !!user,
  });
}

/** Main hook — start/stop timer actions */
export function useTimeTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: activeTimer } = useActiveTimer();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['active-timer'] });
    queryClient.invalidateQueries({ queryKey: ['task-total-time'] });
    queryClient.invalidateQueries({ queryKey: ['task-time-history'] });
    queryClient.invalidateQueries({ queryKey: ['weekly-tracked-time'] });
    queryClient.invalidateQueries({ queryKey: ['task-stats'] });
  };

  const startTimer = useMutation({
    mutationFn: async (taskId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Stop any existing active timer first
      if (activeTimer) {
        const now = new Date();
        const durationSec = Math.floor(
          (now.getTime() - new Date(activeTimer.started_at).getTime()) / 1000
        );
        await (supabase as any)
          .from('time_entries')
          .update({
            stopped_at: now.toISOString(),
            duration_seconds: durationSec,
          })
          .eq('id', activeTimer.id);

        // Update task total_time_seconds
        const { data: prevTask } = await (supabase as any)
          .from('tasks').select('total_time_seconds').eq('id', activeTimer.task_id).maybeSingle();
        await (supabase as any)
          .from('tasks')
          .update({ total_time_seconds: ((prevTask as any)?.total_time_seconds ?? 0) + durationSec })
          .eq('id', activeTimer.task_id);
      }

      // Start new timer
      const { data, error } = await (supabase as any)
        .from('time_entries')
        .insert({ task_id: taskId, user_id: user.id, started_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: invalidate,
  });

  const stopTimer = useMutation({
    mutationFn: async () => {
      if (!activeTimer) return;
      const now = new Date();
      const durationSec = Math.floor(
        (now.getTime() - new Date(activeTimer.started_at).getTime()) / 1000
      );

      await (supabase as any)
        .from('time_entries')
        .update({ stopped_at: now.toISOString(), duration_seconds: durationSec })
        .eq('id', activeTimer.id);

      // Update task total_time_seconds
      const { data: prevTask } = await (supabase as any)
        .from('tasks').select('total_time_seconds').eq('id', activeTimer.task_id).maybeSingle();
      await (supabase as any)
        .from('tasks')
        .update({ total_time_seconds: ((prevTask as any)?.total_time_seconds ?? 0) + durationSec })
        .eq('id', activeTimer.task_id);
    },
    onSuccess: invalidate,
  });

  return { activeTimer, startTimer, stopTimer };
}
