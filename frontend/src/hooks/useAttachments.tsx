import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { validateFileUpload, sanitizeFilename } from '@/lib/fileValidation';

export interface Attachment {
  id: string;
  user_id: string;
  project_id: string;
  task_id: string | null;
  note_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string | null;
  created_at: string;
}

export function useAttachments(projectId: string, options?: { taskId?: string; noteId?: string; maxFileSizeMb?: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['attachments', projectId, options?.taskId, options?.noteId];

  const { data: attachments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('attachments')
        .select('*')
        .eq('project_id', projectId);

      if (options?.taskId) {
        query = query.eq('task_id', options.taskId);
      }
      if (options?.noteId) {
        query = query.eq('note_id', options.noteId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data as Attachment[];
    },
    enabled: !!user && !!projectId,
  });

  const uploadAttachment = useMutation({
    mutationFn: async ({ file, taskId, noteId }: { file: File; taskId?: string; noteId?: string }) => {
      if (!user) throw new Error('Not authenticated');

      // Security: validate MIME type, size, extension before uploading
      const validation = validateFileUpload(file, { maxSizeMb: options?.maxFileSizeMb });
      if (!validation.valid) {
        throw new Error(validation.error || 'Файлът не е валиден');
      }
      if (validation.warning) {
        toast({ title: 'Внимание', description: validation.warning });
      }

      const safeName = sanitizeFilename(file.name);
      const filePath = `${user.id}/${projectId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, {
          contentType: file.type || 'application/octet-stream',
          // Disable any caching that could leak file across users
          cacheControl: 'private, max-age=0, no-store',
        });

      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('attachments')
        .insert({
          user_id: user.id,
          project_id: projectId,
          task_id: taskId || null,
          note_id: noteId || null,
          file_name: safeName,
          file_path: filePath,
          file_size: file.size,
          content_type: file.type || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
    },
    onError: (error) => {
      toast({ title: 'Грешка при качване', description: error.message, variant: 'destructive' });
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: async (attachment: Attachment) => {
      const { error: storageError } = await supabase.storage
        .from('attachments')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      const { error } = await supabase
        .from('attachments')
        .delete()
        .eq('id', attachment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
    },
    onError: (error) => {
      toast({ title: 'Грешка при изтриване', description: error.message, variant: 'destructive' });
    },
  });

  const getDownloadUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from('attachments')
      .createSignedUrl(filePath, 3600);
    return data?.signedUrl;
  };

  return {
    attachments,
    isLoading,
    uploadAttachment,
    deleteAttachment,
    getDownloadUrl,
  };
}
