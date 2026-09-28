import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { Project } from './useProjects';

export interface ArchivedProject extends Project {
  archived_at: string;
}

export function useArchivedProjects() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: archivedProjects = [], isLoading } = useQuery({
    queryKey: ['archived-projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });
      
      if (error) throw error;
      return data as ArchivedProject[];
    },
    enabled: !!user,
  });

  const archiveProject = useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase
        .rpc('archive_project', { p_project_id: projectId });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['archived-projects'] });
      toast({ title: 'Проектът е архивиран', description: 'Можете да го намерите в Архивирани проекти.' });
    },
    onError: (error) => {
      toast({ title: 'Грешка', description: error.message, variant: 'destructive' });
    },
  });

  const unarchiveProject = useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase
        .rpc('unarchive_project', { p_project_id: projectId });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['archived-projects'] });
      toast({ title: 'Проектът е възстановен', description: 'Проектът отново е активен.' });
    },
    onError: (error) => {
      toast({ title: 'Грешка', description: error.message, variant: 'destructive' });
    },
  });

  return {
    archivedProjects,
    isLoading,
    archiveProject,
    unarchiveProject,
  };
}
