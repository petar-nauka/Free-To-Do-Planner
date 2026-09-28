import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_display_name?: string;
}

export function useTaskComments(taskId: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user profiles for display names
      const userIds = [...new Set((data || []).map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      return (data || []).map(comment => ({
        ...comment,
        user_email: profileMap.get(comment.user_id)?.email || '',
        user_display_name: profileMap.get(comment.user_id)?.display_name || '',
      })) as TaskComment[];
    },
    enabled: !!taskId,
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase
        .from('task_comments')
        .insert({ task_id: taskId, user_id: user!.id, content })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return { comments, isLoading, addComment, deleteComment };
}
