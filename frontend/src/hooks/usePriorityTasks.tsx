import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface PriorityTask {
  id: string;
  user_id: string;
  task_id: string;
  position: number;
  is_completed: boolean;
  created_at: string;
}

export function usePriorityTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: priorityTasks = [], isLoading } = useQuery({
    queryKey: ['priority-tasks', user?.id],
    queryFn: async (): Promise<PriorityTask[]> => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('priority_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const addPriorityTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Check if we already have 10 priority tasks
      if (priorityTasks.length >= 10) {
        throw new Error('Maximum 10 priority tasks allowed');
      }

      // Check if task is already in priority list
      if (priorityTasks.some(pt => pt.task_id === taskId)) {
        throw new Error('Task already in priority list');
      }

      const maxPosition = priorityTasks.reduce((max, pt) => Math.max(max, pt.position), -1);

      const { data, error } = await (supabase as any)
        .from('priority_tasks')
        .insert({
          user_id: user.id,
          task_id: taskId,
          position: maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priority-tasks'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removePriorityTask = useMutation({
    mutationFn: async (priorityTaskId: string) => {
      const { error } = await (supabase as any)
        .from('priority_tasks')
        .delete()
        .eq('id', priorityTaskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priority-tasks'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleCompleted = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const { data, error } = await (supabase as any)
        .from('priority_tasks')
        .update({ is_completed: isCompleted })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priority-tasks'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const reorderPriorityTasks = useMutation({
    mutationFn: async (updates: { id: string; position: number }[]) => {
      for (const update of updates) {
        const { error } = await (supabase as any)
          .from('priority_tasks')
          .update({ position: update.position })
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priority-tasks'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    priorityTasks,
    isLoading,
    addPriorityTask,
    removePriorityTask,
    toggleCompleted,
    reorderPriorityTasks,
  };
}
