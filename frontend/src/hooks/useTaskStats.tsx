import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TaskStats {
  pendingTasks: number;
  completedTasks: number;
  overdueTasks: number;
  tasksForToday: number;
  projectsWithTasks: number;
  totalProjects: number;
  tasksByDate: { date: string; pending: number; completed: number }[];
  sparklines: {
    pending: number[];
    completed: number[];
    overdue: number[];
  };
}

export function useTaskStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['task-stats', user?.id],
    queryFn: async (): Promise<TaskStats> => {
      if (!user) throw new Error('Not authenticated');

      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .is('archived_at', null);

      if (projectsError) throw projectsError;

      const projectIds = projects?.map(p => p.id) || [];
      
      if (projectIds.length === 0) {
        return {
          pendingTasks: 0, completedTasks: 0, overdueTasks: 0, tasksForToday: 0,
          projectsWithTasks: 0, totalProjects: 0, tasksByDate: [],
          sparklines: { pending: [], completed: [], overdue: [] },
        };
      }

      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, status, project_id, archived_at, due_date, created_at, updated_at')
        .in('project_id', projectIds);

      if (tasksError) throw tasksError;

      const allTasks = tasks || [];
      const todayStr = new Date().toISOString().split('T')[0];
      
      const pendingTasks = allTasks.filter(t => !t.archived_at).length;
      const completedTasks = allTasks.filter(t => t.archived_at).length;
      const overdueTasks = allTasks.filter(t => !t.archived_at && t.due_date && t.due_date.split('T')[0] < todayStr).length;
      const tasksForToday = allTasks.filter(t => !t.archived_at && t.due_date && t.due_date.split('T')[0] === todayStr).length;
      
      const projectsWithPendingTasks = new Set(
        allTasks.filter(t => !t.archived_at).map(t => t.project_id)
      ).size;

      // Sparklines - last 7 days
      const sparkPending: number[] = [];
      const sparkCompleted: number[] = [];
      const sparkOverdue: number[] = [];
      
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        
        sparkPending.push(allTasks.filter(t => !t.archived_at && t.created_at.split('T')[0] <= ds && (!t.archived_at || t.archived_at.split('T')[0] > ds)).length);
        sparkCompleted.push(allTasks.filter(t => t.archived_at && t.archived_at.split('T')[0] === ds).length);
        sparkOverdue.push(allTasks.filter(t => !t.archived_at && t.due_date && t.due_date.split('T')[0] < ds).length);
      }

      // Tasks by date for calendar
      const today = new Date();
      const tasksByDate: { date: string; pending: number; completed: number }[] = [];
      
      for (let i = -30; i <= 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        const pendingOnDate = allTasks.filter(t => !t.archived_at && t.due_date && t.due_date.split('T')[0] === dateStr).length;
        const completedOnDate = allTasks.filter(t => t.archived_at && t.archived_at.split('T')[0] === dateStr).length;
        
        if (pendingOnDate > 0 || completedOnDate > 0) {
          tasksByDate.push({ date: dateStr, pending: pendingOnDate, completed: completedOnDate });
        }
      }

      return {
        pendingTasks, completedTasks, overdueTasks, tasksForToday,
        projectsWithTasks: projectsWithPendingTasks,
        totalProjects: projectIds.length,
        tasksByDate,
        sparklines: { pending: sparkPending, completed: sparkCompleted, overdue: sparkOverdue },
      };
    },
    enabled: !!user,
  });
}
