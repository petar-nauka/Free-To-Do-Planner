import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { processNotifications } from '@/lib/notifications';

export interface Note {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
  is_pinned: boolean;
}

export interface NoteVersion {
  id: string;
  note_id: string;
  user_id: string;
  title: string;
  content: string | null;
  created_at: string;
}

// Auto-purge from trash after this many days
const TRASH_RETENTION_DAYS = 30;

export function useNotes(projectId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Active notes (not archived, not deleted)
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes', projectId, 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('project_id', projectId!)
        .is('archived_at', null)
        .is('deleted_at', null)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Note[];
    },
    enabled: !!user && !!projectId,
  });

  // Archived notes (archived_at IS NOT NULL, not deleted)
  const { data: archivedNotes = [], isLoading: isLoadingArchived } = useQuery({
    queryKey: ['notes', projectId, 'archived'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('project_id', projectId!)
        .not('archived_at', 'is', null)
        .is('deleted_at', null)
        .order('archived_at', { ascending: false });

      if (error) throw error;
      return data as Note[];
    },
    enabled: !!user && !!projectId,
  });

  // Trashed notes (deleted_at IS NOT NULL)
  const { data: trashedNotes = [], isLoading: isLoadingTrashed } = useQuery({
    queryKey: ['notes', projectId, 'trashed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('project_id', projectId!)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      return data as Note[];
    },
    enabled: !!user && !!projectId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notes'] });
  };

  const createNote = useMutation({
    mutationFn: async ({ projectId, title }: { projectId: string; title?: string }) => {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          project_id: projectId,
          user_id: user!.id,
          title: title || 'Untitled Note',
          content: '',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      processNotifications();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update + automatically snapshot version (best-effort, ignores failure)
  const updateNote = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Note> & { id: string }) => {
      // Fetch previous content for versioning
      const isContentUpdate = 'title' in updates || 'content' in updates;
      let previousNote: Note | null = null;
      if (isContentUpdate) {
        const { data } = await supabase.from('notes').select('*').eq('id', id).maybeSingle();
        previousNote = data as Note | null;
      }

      const { data, error } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Save version snapshot of previous state (best-effort).
      // Skip if no meaningful change (same title + content).
      if (previousNote && isContentUpdate && user) {
        const titleChanged = updates.title !== undefined && updates.title !== previousNote.title;
        const contentChanged = updates.content !== undefined && updates.content !== previousNote.content;
        if (titleChanged || contentChanged) {
          // Don't await - fire-and-forget. If RLS / table missing, ignore silently.
          (supabase as any)
            .from('note_versions')
            .insert({
              note_id: id,
              user_id: user.id,
              title: previousNote.title,
              content: previousNote.content,
            })
            .then(() => queryClient.invalidateQueries({ queryKey: ['note-versions', id] }));
        }
      }

      return data;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Soft delete -> move to Trash
  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Note moved to Trash' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Restore from Trash
  const restoreFromTrash = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notes')
        .update({ deleted_at: null })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Note restored from Trash' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Permanent delete (purge)
  const permanentDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Note permanently deleted' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Empty whole trash for this project
  const emptyTrash = useMutation({
    mutationFn: async () => {
      if (!projectId) return;
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('project_id', projectId)
        .not('deleted_at', 'is', null);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Trash emptied' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const archiveNote = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('notes')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Note archived' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const unarchiveNote = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('notes')
        .update({ archived_at: null })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Note restored' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const togglePinNote = useMutation({
    mutationFn: async ({ id, isPinned }: { id: string; isPinned: boolean }) => {
      const { data, error } = await supabase
        .from('notes')
        .update({ is_pinned: isPinned })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    notes,
    archivedNotes,
    trashedNotes,
    isLoading,
    isLoadingArchived,
    isLoadingTrashed,
    createNote,
    updateNote,
    deleteNote, // soft delete
    restoreFromTrash,
    permanentDelete,
    emptyTrash,
    archiveNote,
    unarchiveNote,
    togglePinNote,
    TRASH_RETENTION_DAYS,
  };
}

// ---------- Versions hook ----------
export function useNoteVersions(noteId: string | null) {
  const { user } = useAuth();

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['note-versions', noteId],
    queryFn: async (): Promise<NoteVersion[]> => {
      if (!noteId) return [];
      const { data, error } = await (supabase as any)
        .from('note_versions')
        .select('*')
        .eq('note_id', noteId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        // Table may not exist yet (migration not run). Return empty list silently.
        console.warn('note_versions query failed:', error.message);
        return [];
      }
      return (data || []) as NoteVersion[];
    },
    enabled: !!user && !!noteId,
  });

  return { versions, isLoading };
}
