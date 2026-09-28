import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export type RecurrenceType = 'daily' | 'weekly' | 'monthly';

export interface RecurringTask {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string | null;
  day_of_week: number | null;
  time_of_day: string;
  recurrence_type: RecurrenceType;
  day_of_month: number | null;
  notification_email: string;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

const DAYS_OF_WEEK = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'];

export function getDayName(dayOfWeek: number | null): string {
  if (dayOfWeek === null) return 'Всеки ден';
  return DAYS_OF_WEEK[dayOfWeek] || 'Неизвестен';
}

export function getRecurrenceLabel(type: RecurrenceType): string {
  switch (type) {
    case 'daily': return 'Ежедневно';
    case 'weekly': return 'Ежеседмично';
    case 'monthly': return 'Ежемесечно';
    default: return type;
  }
}

export function useRecurringTasks(projectId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: recurringTasks = [], isLoading } = useQuery({
    queryKey: ['recurring_tasks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_tasks' as any)
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data as unknown as RecurringTask[]) || [];
    },
    enabled: !!user && !!projectId,
  });

  const createRecurringTask = useMutation({
    mutationFn: async (task: {
      projectId: string;
      title: string;
      description?: string;
      recurrenceType: RecurrenceType;
      dayOfWeek?: number | null;
      dayOfMonth?: number | null;
      timeOfDay: string;
      notificationEmail: string;
    }) => {
      // Calculate next run time
      const now = new Date();
      const [hours, minutes] = task.timeOfDay.split(':').map(Number);
      let nextRun = new Date();
      nextRun.setHours(hours, minutes, 0, 0);

      if (task.recurrenceType === 'weekly' && task.dayOfWeek !== undefined && task.dayOfWeek !== null) {
        const currentDay = now.getDay();
        let daysUntilNext = task.dayOfWeek - currentDay;
        if (daysUntilNext <= 0) daysUntilNext += 7;
        nextRun.setDate(now.getDate() + daysUntilNext);
      } else if (task.recurrenceType === 'monthly' && task.dayOfMonth) {
        nextRun.setDate(task.dayOfMonth);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
      } else if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      const { data, error } = await supabase
        .from('recurring_tasks' as any)
        .insert({
          project_id: task.projectId,
          user_id: user!.id,
          title: task.title,
          description: task.description || null,
          recurrence_type: task.recurrenceType,
          day_of_week: task.dayOfWeek ?? null,
          day_of_month: task.dayOfMonth ?? null,
          time_of_day: task.timeOfDay,
          notification_email: task.notificationEmail,
          next_run_at: nextRun.toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_tasks'] });
      toast({ title: 'Повтарящата се задача е създадена' });
    },
    onError: (error) => {
      toast({ title: 'Грешка', description: error.message, variant: 'destructive' });
    },
  });

  const updateRecurringTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RecurringTask> & { id: string }) => {
      const { data, error } = await supabase
        .from('recurring_tasks' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_tasks'] });
    },
    onError: (error) => {
      toast({ title: 'Грешка', description: error.message, variant: 'destructive' });
    },
  });

  const deleteRecurringTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_tasks' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_tasks'] });
      toast({ title: 'Повтарящата се задача е изтрита' });
    },
    onError: (error) => {
      toast({ title: 'Грешка', description: error.message, variant: 'destructive' });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('recurring_tasks' as any)
        .update({ is_active: isActive })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_tasks'] });
    },
    onError: (error) => {
      toast({ title: 'Грешка', description: error.message, variant: 'destructive' });
    },
  });

  return {
    recurringTasks,
    isLoading,
    createRecurringTask,
    updateRecurringTask,
    deleteRecurringTask,
    toggleActive,
  };
}
