import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { fromStoredScene, type StoredScene } from '@/lib/whiteboardScene';
import type { Json } from '@/integrations/supabase/types';

/** Ред от списъка — без `data`, за да не теглим всички рисунки само за да покажем имената им. */
export interface Whiteboard {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

const LIST_COLUMNS = 'id, project_id, user_id, name, created_at, updated_at';

export function useWhiteboards(projectId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['whiteboards', projectId] });
  const onError = (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' });

  const { data: whiteboards = [], isLoading } = useQuery({
    queryKey: ['whiteboards', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whiteboards')
        .select(LIST_COLUMNS)
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Whiteboard[];
    },
    enabled: !!user && !!projectId,
  });

  const createWhiteboard = useMutation({
    mutationFn: async ({ name }: { name?: string }) => {
      const { data, error } = await supabase
        .from('whiteboards')
        .insert({ project_id: projectId!, user_id: user!.id, name: name || 'Нова дъска' })
        .select(LIST_COLUMNS)
        .single();

      if (error) throw error;
      return data as Whiteboard;
    },
    onSuccess: invalidate,
    onError,
  });

  const renameWhiteboard = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('whiteboards').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError,
  });

  const deleteWhiteboard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whiteboards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError,
  });

  return { whiteboards, isLoading, createWhiteboard, renameWhiteboard, deleteWhiteboard };
}

/** Съдържанието на една дъска + запис. Записът обновява и кеша, за да не отвориш после стара версия. */
export function useWhiteboardScene(id: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: scene, isLoading } = useQuery({
    queryKey: ['whiteboard', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('whiteboards').select('data').eq('id', id).single();
      if (error) throw error;
      return fromStoredScene(data.data);
    },
  });

  const saveScene = useMutation({
    mutationFn: async (next: StoredScene) => {
      const { error } = await supabase
        .from('whiteboards')
        .update({ data: next as unknown as Json })
        .eq('id', id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => queryClient.setQueryData(['whiteboard', id], next),
    onError: (error: Error) =>
      toast({ title: 'Дъската не е записана', description: error.message, variant: 'destructive' }),
  });

  return { scene, isLoading, saveScene };
}

/**
 * Може ли текущият потребител да редактира проекта (собственик или редактор).
 * `undefined`, докато не знаем; при грешка — `false` (по-безопасно е само да гледа).
 */
export function useCanEditProject(projectId: string): boolean | undefined {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['can-edit-project', projectId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_edit_project', { _project_id: projectId, _user_id: user!.id });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
  return isLoading ? undefined : data === true;
}
