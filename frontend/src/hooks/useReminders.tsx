import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Reminder {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string | null;
  reminder_date: string;
  reminder_email: string;
  is_sent: boolean;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useReminders(projectId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders' as any)
        .select('*')
        .eq('project_id', projectId!)
        .order('reminder_date', { ascending: true });
      
      if (error) throw error;
      return (data as unknown as Reminder[]) || [];
    },
    enabled: !!user && !!projectId,
  });

  const createReminder = useMutation({
    mutationFn: async (reminder: {
      projectId: string;
      title: string;
      description?: string;
      reminderDate: string;
      reminderEmail: string;
    }) => {
      const { data, error } = await supabase
        .from('reminders' as any)
        .insert({
          project_id: reminder.projectId,
          user_id: user!.id,
          title: reminder.title,
          description: reminder.description || null,
          reminder_date: reminder.reminderDate,
          reminder_email: reminder.reminderEmail,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({ title: 'Напомнянето е създадено' });
    },
    onError: (error) => {
      toast({ title: 'Грешка', description: error.message, variant: 'destructive' });
    },
  });

  const updateReminder = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Reminder> & { id: string }) => {
      const { data, error } = await supabase
        .from('reminders' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
    onError: (error) => {
      toast({ title: 'Грешка', description: error.message, variant: 'destructive' });
    },
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reminders' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({ title: 'Напомнянето е изтрито' });
    },
    onError: (error) => {
      toast({ title: 'Грешка', description: error.message, variant: 'destructive' });
    },
  });

  return {
    reminders,
    isLoading,
    createReminder,
    updateReminder,
    deleteReminder,
  };
}
