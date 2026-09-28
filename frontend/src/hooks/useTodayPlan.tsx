import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export interface TodayPlan {
  id: string;
  user_id: string;
  project_id: string;
  plan_date: string;
  daily_task_limit: number;
  created_at: string;
  updated_at: string;
}

export interface MitTask {
  id: string;
  today_plan_id: string;
  task_id: string;
  position: number;
  is_completed: boolean;
  created_at: string;
}

export function useTodayPlan(projectId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  const today = new Date().toISOString().split('T')[0];

  // Fetch today's plan
  const { data: todayPlan, isLoading: isPlanLoading } = useQuery({
    queryKey: ['today-plan', projectId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('today_plans' as any)
        .select('*')
        .eq('project_id', projectId!)
        .eq('plan_date', today)
        .eq('user_id', user!.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as unknown as TodayPlan | null;
    },
    enabled: !!user && !!projectId,
  });

  // Fetch MIT tasks for today's plan
  const { data: mitTasks = [], isLoading: isMitLoading } = useQuery({
    queryKey: ['mit-tasks', todayPlan?.id],
    queryFn: async () => {
      if (!todayPlan?.id) return [];
      
      const { data, error } = await supabase
        .from('mit_tasks' as any)
        .select('*')
        .eq('today_plan_id', todayPlan.id)
        .order('position', { ascending: true });
      
      if (error) throw error;
      return (data as unknown as MitTask[]) || [];
    },
    enabled: !!todayPlan?.id,
  });

  // Create or update today's plan
  const upsertPlan = useMutation({
    mutationFn: async (dailyTaskLimit: number) => {
      if (!projectId || !user) throw new Error('Missing project or user');
      
      const { data, error } = await supabase
        .from('today_plans' as any)
        .upsert({
          user_id: user.id,
          project_id: projectId,
          plan_date: today,
          daily_task_limit: dailyTaskLimit,
        }, {
          onConflict: 'user_id,project_id,plan_date'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as TodayPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-plan'] });
    },
    onError: (error) => {
      toast({ 
        title: t('common.error'), 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Add MIT task
  const addMitTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!todayPlan?.id) {
        // Create plan first if it doesn't exist
        const planResult = await upsertPlan.mutateAsync(5);
        
        const { data, error } = await supabase
          .from('mit_tasks' as any)
          .insert({
            today_plan_id: planResult.id,
            task_id: taskId,
            position: mitTasks.length,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
      
      const { data, error } = await supabase
        .from('mit_tasks' as any)
        .insert({
          today_plan_id: todayPlan.id,
          task_id: taskId,
          position: mitTasks.length,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mit-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['today-plan'] });
      toast({ title: t('todayPlan.mitAdded') });
    },
    onError: (error) => {
      toast({ 
        title: t('common.error'), 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Remove MIT task
  const removeMitTask = useMutation({
    mutationFn: async (mitTaskId: string) => {
      const { error } = await supabase
        .from('mit_tasks' as any)
        .delete()
        .eq('id', mitTaskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mit-tasks'] });
      toast({ title: t('todayPlan.mitRemoved') });
    },
    onError: (error) => {
      toast({ 
        title: t('common.error'), 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Toggle MIT task completion
  const toggleMitCompletion = useMutation({
    mutationFn: async ({ mitTaskId, isCompleted }: { mitTaskId: string; isCompleted: boolean }) => {
      const { data, error } = await supabase
        .from('mit_tasks' as any)
        .update({ is_completed: isCompleted })
        .eq('id', mitTaskId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mit-tasks'] });
    },
    onError: (error) => {
      toast({ 
        title: t('common.error'), 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Update daily task limit
  const updateTaskLimit = useMutation({
    mutationFn: async (limit: number) => {
      return upsertPlan.mutateAsync(limit);
    },
    onSuccess: () => {
      toast({ title: t('todayPlan.limitUpdated') });
    },
  });

  return {
    todayPlan,
    mitTasks,
    isLoading: isPlanLoading || isMitLoading,
    addMitTask,
    removeMitTask,
    toggleMitCompletion,
    updateTaskLimit,
    upsertPlan,
  };
}
