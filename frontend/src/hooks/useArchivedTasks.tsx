import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { Task } from './useTasks';

export interface ArchivedTask extends Task {
  archived_at: string;
}

export function useArchivedTasks(projectId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: archivedTasks = [], isLoading } = useQuery({
    queryKey: ['archived-tasks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_tags(*)')
        .eq('project_id', projectId!)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });
      
      if (error) throw error;
      return data as ArchivedTask[];
    },
    enabled: !!user && !!projectId,
  });

  const archiveTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['archived-tasks', projectId] });
      toast({ title: 'Task archived!', description: 'You can find it in the archive.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const unarchiveTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({ archived_at: null })
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['archived-tasks', projectId] });
      toast({ title: 'Task restored!' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Group tasks by month/year
  const groupedByMonth = archivedTasks.reduce((acc, task) => {
    const date = new Date(task.archived_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(task);
    return acc;
  }, {} as Record<string, ArchivedTask[]>);

  return {
    archivedTasks,
    groupedByMonth,
    isLoading,
    archiveTask,
    unarchiveTask,
  };
}
