import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { processNotifications } from '@/lib/notifications';

export type TaskStatus = 'new' | 'in_progress' | 'future';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskTag {
  id: string;
  task_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  note_id?: string | null;
  spreadsheet_id?: string | null;
  /** Кога е архивирана (= завършена). Колоната винаги е била в базата; типът я пропускаше. */
  archived_at?: string | null;
  task_tags?: TaskTag[];
}

export function useTasks(projectId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_tags(*)')
        .eq('project_id', projectId!)
        .order('position', { ascending: true });
      
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user && !!projectId,
  });

  const createTask = useMutation({
    mutationFn: async ({ 
      projectId, 
      title, 
      status = 'new', 
      priority = 'medium', 
      noteId,
      spreadsheetId,
      description,
      due_date,
      tags
    }: { 
      projectId: string; 
      title: string; 
      status?: TaskStatus;
      priority?: TaskPriority;
      noteId?: string;
      spreadsheetId?: string;
      description?: string;
      due_date?: string;
      tags?: { name: string; color: string }[];
    }) => {
      const maxPosition = tasks
        .filter(t => t.status === status)
        .reduce((max, t) => Math.max(max, t.position), -1);

      const { data, error } = await supabase
        .from('tasks')
        .insert({ 
          project_id: projectId, 
          user_id: user!.id,
          title,
          description: description || null,
          status,
          priority,
          position: maxPosition + 1,
          note_id: noteId || null,
          spreadsheet_id: spreadsheetId || null,
          due_date: due_date || null
        })
        .select('*, task_tags(*)')
        .single();
      
      if (error) throw error;

      // Add tags if provided
      if (tags && tags.length > 0 && data) {
        for (const tag of tags) {
          await supabase
            .from('task_tags')
            .insert({ task_id: data.id, name: tag.name, color: tag.color });
        }
        // Refetch with tags
        const { data: taskWithTags } = await supabase
          .from('tasks')
          .select('*, task_tags(*)')
          .eq('id', data.id)
          .single();
        return taskWithTags;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      processNotifications();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select('*, task_tags(*)')
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Task deleted' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const addTag = useMutation({
    mutationFn: async ({ taskId, name, color }: { taskId: string; name: string; color: string }) => {
      const { data, error } = await supabase
        .from('task_tags')
        .insert({ task_id: taskId, name, color })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeTag = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from('task_tags')
        .delete()
        .eq('id', tagId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const reorderTasks = useMutation({
    mutationFn: async (updates: { id: string; status: TaskStatus; position: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from('tasks')
          .update({ status: update.status, position: update.position })
          .eq('id', update.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    tasks,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    addTag,
    removeTag,
    reorderTasks,
  };
}
