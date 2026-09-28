import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Task, TaskTag } from './useTasks';

export interface TaskWithProject extends Task {
  project_name: string;
  project_color: string;
}

export function useAllTasks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['all-tasks', user?.id],
    queryFn: async (): Promise<TaskWithProject[]> => {
      if (!user) throw new Error('Not authenticated');

      // Fetch all projects the user has access to
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, color')
        .is('archived_at', null);

      if (projectsError) throw projectsError;

      const projectIds = projects?.map(p => p.id) || [];
      
      if (projectIds.length === 0) {
        return [];
      }

      // Fetch all active tasks from those projects
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*, task_tags(*)')
        .in('project_id', projectIds)
        .is('archived_at', null)
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Map projects for quick lookup
      const projectMap = new Map(projects?.map(p => [p.id, p]) || []);

      return (tasks || []).map(task => ({
        ...task,
        project_name: projectMap.get(task.project_id)?.name || '',
        project_color: projectMap.get(task.project_id)?.color || 'purple',
      })) as TaskWithProject[];
    },
    enabled: !!user,
  });
}
