import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StickyNote, Settings2, ExternalLink, Save, Loader2, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { LazyRichTextEditor as RichTextEditor } from '@/components/editor/LazyRichTextEditor';
import { useToast } from '@/hooks/use-toast';
import debounce from 'lodash.debounce';
import { cn } from '@/lib/utils';

const STORAGE_KEY_PROJECT = 'quick_note_project_id';
const STORAGE_KEY_NOTE = 'quick_note_id';

interface QuickNoteData {
  id: string;
  title: string;
  content: string | null;
  project_id: string;
  project_name?: string;
}

interface QuickNoteCardProps {
  onOpenFullNote?: (projectId: string, noteId: string) => void;
}

export function QuickNoteCard({ onOpenFullNote }: QuickNoteCardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { projects } = useProjects();

  // Persisted selection (per-device via localStorage)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY_PROJECT) || ''
  );
  const [selectedNoteId, setSelectedNoteId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY_NOTE) || ''
  );

  // Local editor state (uncontrolled for the debounced save)
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Fetch notes of selected project (for the picker).
  // Tolerant to missing `deleted_at` column (added in later migration).
  const { data: projectNotes = [] } = useQuery({
    queryKey: ['quick-note-picker', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      // Try the strict query first (excludes trashed notes).
      let { data, error } = await supabase
        .from('notes')
        .select('id, title')
        .eq('project_id', selectedProjectId)
        .is('archived_at', null)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(100);

      // Fallback if `deleted_at` column doesn't exist yet (older schemas)
      if (error) {
        console.warn('Quick note picker: falling back without deleted_at filter:', error.message);
        const fallback = await supabase
          .from('notes')
          .select('id, title')
          .eq('project_id', selectedProjectId)
          .is('archived_at', null)
          .order('updated_at', { ascending: false })
          .limit(100);
        data = fallback.data;
      }

      return (data as { id: string; title: string }[]) || [];
    },
    enabled: !!user && !!selectedProjectId,
  });

  // Fetch the actual quick note (tolerant to missing columns)
  const { data: quickNote, isLoading, error } = useQuery<QuickNoteData | null>({
    queryKey: ['quick-note', selectedNoteId],
    queryFn: async () => {
      if (!selectedNoteId) return null;
      const { data, error } = await supabase
        .from('notes')
        .select('id, title, content, project_id, projects(name)')
        .eq('id', selectedNoteId)
        .maybeSingle();
      if (error) {
        console.warn('Quick note fetch error:', error.message);
        throw error;
      }
      if (!data) return null;
      return {
        id: (data as any).id,
        title: (data as any).title,
        content: (data as any).content,
        project_id: (data as any).project_id,
        project_name: ((data as any).projects as any)?.name,
      };
    },
    enabled: !!user && !!selectedNoteId,
    retry: false,
  });

  // Load into local state when note changes
  useEffect(() => {
    if (quickNote) {
      setLocalTitle(quickNote.title || '');
      setLocalContent(quickNote.content || '');
      setIsDirty(false);
    }
  }, [quickNote?.id, quickNote?.title, quickNote?.content]);

  // If selected note no longer exists (deleted), clear selection
  useEffect(() => {
    if (selectedNoteId && !isLoading && quickNote === null && !error) {
      setSelectedNoteId('');
      localStorage.removeItem(STORAGE_KEY_NOTE);
    }
  }, [selectedNoteId, isLoading, quickNote, error]);

  // Debounced save (mirrors NotesSection pattern)
  const debouncedSave = useMemo(
    () =>
      debounce(async (id: string, title: string, content: string) => {
        setIsSaving(true);
        try {
          const { error } = await supabase
            .from('notes')
            .update({ title, content })
            .eq('id', id);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['quick-note'] });
          queryClient.invalidateQueries({ queryKey: ['notes'] });
          setIsDirty(false);
        } catch (e: any) {
          toast({ title: 'Грешка при запис', description: e.message, variant: 'destructive' });
        } finally {
          setIsSaving(false);
        }
      }, 800),
    [queryClient, toast]
  );

  useEffect(() => () => { debouncedSave.cancel(); }, [debouncedSave]);

  const handleTitleChange = (v: string) => {
    setLocalTitle(v);
    setIsDirty(true);
    if (selectedNoteId) debouncedSave(selectedNoteId, v, localContent);
  };

  const handleContentChange = (v: string) => {
    setLocalContent(v);
    setIsDirty(true);
    if (selectedNoteId) debouncedSave(selectedNoteId, localTitle, v);
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedNoteId('');
    localStorage.setItem(STORAGE_KEY_PROJECT, projectId);
    localStorage.removeItem(STORAGE_KEY_NOTE);
  };

  const handleNoteSelect = (noteId: string) => {
    setSelectedNoteId(noteId);
    localStorage.setItem(STORAGE_KEY_NOTE, noteId);
    setSettingsOpen(false);
  };

  const createAndSelectNewNote = useMutation({
    mutationFn: async () => {
      if (!user || !selectedProjectId) throw new Error('Изберете проект първо');
      const { data, error } = await supabase
        .from('notes')
        .insert({
          project_id: selectedProjectId,
          user_id: user.id,
          title: '⚡ Бърза бележка',
          content: '',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (note) => {
      handleNoteSelect(note.id);
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['quick-note-picker'] });
      toast({ title: '✅ Създадена нова бърза бележка' });
    },
    onError: (e: any) => {
      toast({ title: 'Грешка', description: e.message, variant: 'destructive' });
    },
  });

  const handleOpenFull = () => {
    if (quickNote && onOpenFullNote) {
      onOpenFullNote(quickNote.project_id, quickNote.id);
    }
  };

  return (
    <Card
      className="rounded-2xl border-yellow-300/40 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-amber-950/20 dark:to-yellow-950/10"
      data-testid="quick-note-card"
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <StickyNote className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200 truncate">
                {t('quickNote.title', 'Бърза бележка')}
              </h2>
              {quickNote?.project_name && (
                <p className="text-[10px] text-muted-foreground truncate">
                  от {quickNote.project_name}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            {!isSaving && isDirty && <Save className="w-3 h-3 text-amber-500" />}
            {!isSaving && !isDirty && selectedNoteId && (
              <span className="text-[10px] text-emerald-500">✓</span>
            )}

            {quickNote && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleOpenFull}
                title={t('quickNote.openFull', 'Отвори в пълен изглед')}
                data-testid="quick-note-open-full"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}

            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title={t('quickNote.settings', 'Настройки на бърза бележка')}
                  data-testid="quick-note-settings-btn"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 rounded-xl" align="end">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium mb-1">{t('nav.projects', 'Проект')}</p>
                    <Select value={selectedProjectId} onValueChange={handleProjectSelect}>
                      <SelectTrigger className="h-8 text-xs" data-testid="quick-note-project-select">
                        <SelectValue placeholder="Изберете проект..." />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedProjectId && (
                    <div>
                      <p className="text-xs font-medium mb-1">{t('quickNote.pickNote', 'Бележка')}</p>
                      {projectNotes.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic px-2 py-3 border border-dashed border-border rounded-lg text-center">
                          Няма активни бележки в този проект.<br/>
                          Създайте нова с бутона отдолу ⤵
                        </p>
                      ) : (
                        <Select value={selectedNoteId} onValueChange={handleNoteSelect}>
                          <SelectTrigger className="h-8 text-xs" data-testid="quick-note-note-select">
                            <SelectValue placeholder={`Изберете от ${projectNotes.length} бележки...`} />
                          </SelectTrigger>
                          <SelectContent>
                            {projectNotes.map((n) => (
                              <SelectItem key={n.id} value={n.id}>{n.title || '(без заглавие)'}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 h-7 text-xs rounded-lg"
                        onClick={() => createAndSelectNewNote.mutate()}
                        disabled={createAndSelectNewNote.isPending}
                        data-testid="quick-note-create-new"
                      >
                        {createAndSelectNewNote.isPending ? (
                          <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Създаване...</>
                        ) : (
                          <>+ {t('quickNote.createNew', 'Създай нова бърза бележка')}</>
                        )}
                      </Button>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground">
                    💡 Изборът се запазва локално в браузъра.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Body */}
        {!selectedNoteId ? (
          <EmptyState
            onOpenSettings={() => setSettingsOpen(true)}
            hasProjects={projects.length > 0}
          />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-xs">Зареждане...</span>
          </div>
        ) : quickNote ? (
          <div className="space-y-2">
            <Input
              value={localTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              className={cn(
                "text-base font-semibold border-0 p-1 h-auto bg-transparent",
                "focus-visible:ring-1 focus-visible:ring-amber-400"
              )}
              placeholder="Заглавие..."
              data-testid="quick-note-title"
            />
            <div className="bg-white/50 dark:bg-black/20 rounded-xl border border-amber-200/50 dark:border-amber-900/30 max-h-[280px] overflow-y-auto">
              <RichTextEditor
                content={localContent}
                onChange={handleContentChange}
                placeholder="Напишете нещо бързо..."
                enableAudio
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EmptyState({
  onOpenSettings,
  hasProjects,
}: {
  onOpenSettings: () => void;
  hasProjects: boolean;
}) {
  return (
    <div className="py-6 text-center" data-testid="quick-note-empty">
      <StickyNote className="w-8 h-8 mx-auto text-amber-400/50 mb-2" />
      <p className="text-sm font-medium mb-1">Бърз запис на мисли</p>
      <p className="text-xs text-muted-foreground mb-3">
        {hasProjects
          ? 'Изберете съществуваща бележка или създайте нова, за да я имате винаги под ръка.'
          : 'Първо създайте проект, за да имате бърза бележка.'}
      </p>
      {hasProjects && (
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenSettings}
          className="rounded-xl"
          data-testid="quick-note-choose-btn"
        >
          <Settings2 className="w-3 h-3 mr-1" />
          Избери бележка
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      )}
    </div>
  );
}
