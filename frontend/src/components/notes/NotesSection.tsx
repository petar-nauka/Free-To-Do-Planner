import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Search, FileText, Trash2, CheckSquare, Save, Pin, PinOff, Archive, ArchiveRestore, Paperclip, Download, FileDown, LayoutTemplate, History, RotateCcw, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useNotes, Note, NoteVersion } from '@/hooks/useNotes';
import { useTasks } from '@/hooks/useTasks';
import { useIsMobile } from '@/hooks/use-mobile';
import { LazyRichTextEditor as RichTextEditor } from '@/components/editor/LazyRichTextEditor';
import { NoteVersionsDialog } from '@/components/notes/NoteVersionsDialog';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';
import debounce from 'lodash.debounce';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { AttachmentsSection } from '@/components/attachments/AttachmentsSection';
import { CopyLinkButton } from '@/components/common/CopyLinkButton';
import { NOTE_TEMPLATES } from '@/lib/noteTemplates';
import { exportNoteAsPDF, exportNoteAsMarkdown } from '@/lib/noteExport';

interface NotesSectionProps {
  projectId: string;
  /** Id на бележката, която адресът сочи, или null. */
  openNoteId?: string | null;
  /** Отваря/затваря бележка чрез навигация; null се връща към списъка. */
  onOpenNote?: (note: { id: string; title?: string | null } | null) => void;
}

export function NotesSection({ projectId, openNoteId, onOpenNote }: NotesSectionProps) {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const {
    notes,
    archivedNotes,
    trashedNotes,
    isLoading,
    createNote,
    updateNote,
    deleteNote,
    restoreFromTrash,
    permanentDelete,
    emptyTrash,
    archiveNote,
    unarchiveNote,
    togglePinNote,
    TRASH_RETENTION_DAYS,
  } = useNotes(projectId);
  const { createTask } = useTasks(projectId);
  const { toast } = useToast();
  const selectedNoteId = openNoteId ?? null;
  const [searchQuery, setSearchQuery] = useState('');
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archived' | 'trash'>('active');
  const [versionsOpen, setVersionsOpen] = useState(false);
  const isInitializing = useRef(false);
  const updateNoteRef = useRef(updateNote);

  const dateLocale = i18n.language === 'bg' ? bg : enUS;

  // Keep ref updated
  useEffect(() => {
    updateNoteRef.current = updateNote;
  }, [updateNote]);

  const loadNoteToEditor = useCallback((note: Note | null) => {
    isInitializing.current = true;
    setLocalTitle(note?.title ?? '');
    setLocalContent(note?.content ?? '');
    setHasUnsavedChanges(false);

    requestAnimationFrame(() => {
      isInitializing.current = false;
    });
  }, []);

  // Отваряне на бележка по адрес (`/p/<проект>/notes/<бележка>`).
  //
  // ВАЖНО: зареждаме в редактора само когато id-то СЕ Е ПРОМЕНИЛО — пази го
  // `loadedNoteIdRef`. Масивът `notes` получава нова идентичност след всяко
  // презареждане от сървъра, тоест след всеки автозапис; без този пазач ефектът
  // би презаписал редактора със запазената версия и би изтрил това, което
  // пишеш в момента.
  const loadedNoteIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedNoteId === loadedNoteIdRef.current) return;

    if (!selectedNoteId) {
      loadedNoteIdRef.current = null;
      loadNoteToEditor(null);
      return;
    }

    const noteToOpen = notes.find(n => n.id === selectedNoteId);
    if (!noteToOpen) return; // списъкът още се зарежда

    loadedNoteIdRef.current = selectedNoteId;
    loadNoteToEditor(noteToOpen);
  }, [selectedNoteId, notes, loadNoteToEditor]);
  // Create stable debounced function using useCallback with ref
  const debouncedUpdate = useCallback(
    debounce((id: string, title: string, content: string) => {
      updateNoteRef.current.mutate({ id, title, content }, {
        onSuccess: () => setHasUnsavedChanges(false),
      });
    }, 1000),
    [] // Empty deps - uses ref internally
  );

  // При размонтиране ИЗПЪЛНЯВАМЕ чакащия запис вместо да го отменяме.
  // Досега компонентът не се размонтираше при смяна на бележка; вече го прави
  // (навигация), а `cancel()` тук би изтрил последната секунда писане.
  useEffect(() => {
    return () => {
      debouncedUpdate.flush();
    };
  }, [debouncedUpdate]);

  // Manual save function
  const handleSave = () => {
    if (!selectedNoteId) return;
    debouncedUpdate.cancel();

    updateNote.mutate(
      { id: selectedNoteId, title: localTitle, content: localContent },
      {
        onSuccess: () => {
          setHasUnsavedChanges(false);
          toast({
            title: t('notes.noteSaved'),
            description: t('notes.noteSavedDesc'),
          });
        },
      }
    );
  };

  const handleTitleChange = (title: string) => {
    setLocalTitle(title);

    if (selectedNoteId && !isInitializing.current) {
      setHasUnsavedChanges(true);
      debouncedUpdate(selectedNoteId, title, localContent);
    }
  };

  const handleContentChange = (content: string) => {
    // Skip if we're initializing (loading a new note)
    if (isInitializing.current) return;

    setLocalContent(content);

    if (selectedNoteId) {
      setHasUnsavedChanges(true);
      debouncedUpdate(selectedNoteId, localTitle, content);
    }
  };

  /**
   * Изпълнява чакащия автозапис ВЕДНАГА. Вика се преди всяко напускане на
   * бележка — иначе секундата закъснение на `debounce` изяжда последното
   * написано, когато компонентът се размонтира при навигация.
   */
  const flushPendingSave = () => {
    if (selectedNoteId && hasUnsavedChanges) {
      debouncedUpdate.cancel();
      updateNote.mutate({ id: selectedNoteId, title: localTitle, content: localContent });
    }
  };

  const handleSelectNote = (note: Note) => {
    flushPendingSave();
    onOpenNote?.(note);
  };

  const handleCreateNote = async (templateId?: string) => {
    debouncedUpdate.cancel();
    const template = templateId ? NOTE_TEMPLATES.find(t => t.id === templateId) : undefined;
    const isBg = i18n.language === 'bg';
    const title = template ? (isBg ? template.title : template.titleEn) : undefined;
    const result = (await createNote.mutateAsync({ projectId })) as Note;

    if (template) {
      await updateNote.mutateAsync({ id: result.id, title: title || result.title, content: template.content });
      result.title = title || result.title;
      result.content = template.content;
    }

    onOpenNote?.({ id: result.id, title: title || result.title });
  };

  const handleExportPDF = () => {
    if (!selectedNoteId) return;
    const note = notes.find(n => n.id === selectedNoteId);
    if (!note) return;
    try {
      exportNoteAsPDF({ ...note, title: localTitle, content: localContent });
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' });
    }
  };

  const handleExportMarkdown = () => {
    if (!selectedNoteId) return;
    const note = notes.find(n => n.id === selectedNoteId);
    if (!note) return;
    exportNoteAsMarkdown({ ...note, title: localTitle, content: localContent });
    toast({ title: t('notes.exportedMarkdown', 'Експортирано като Markdown') });
  };

  const handleArchiveNote = async () => {
    if (!selectedNoteId) return;
    debouncedUpdate.cancel();
    await archiveNote.mutateAsync(selectedNoteId);
    onOpenNote?.(null);
  };

  const handleUnarchiveNote = async (noteId: string) => {
    await unarchiveNote.mutateAsync(noteId);
  };

  const handleRestoreFromTrash = async (noteId: string) => {
    await restoreFromTrash.mutateAsync(noteId);
  };

  const handlePermanentDelete = async (noteId: string) => {
    await permanentDelete.mutateAsync(noteId);
    if (selectedNoteId === noteId) {
      onOpenNote?.(null);
    }
  };

  const handleEmptyTrash = async () => {
    await emptyTrash.mutateAsync();
  };

  const handleRestoreVersion = (version: NoteVersion) => {
    if (!selectedNoteId) return;
    debouncedUpdate.cancel();
    setLocalTitle(version.title);
    setLocalContent(version.content || '');
    setHasUnsavedChanges(false);
    updateNote.mutate(
      { id: selectedNoteId, title: version.title, content: version.content || '' },
      {
        onSuccess: () => {
          toast({
            title: t('notes.versionRestored', 'Версията е възстановена'),
            description: t('notes.versionRestoredDesc', 'Бележката е върната към избраната версия.'),
          });
        },
      }
    );
  };

  const handleTogglePin = async () => {
    if (!selectedNoteId) return;
    const currentNote = notes.find(n => n.id === selectedNoteId);
    if (currentNote) {
      await togglePinNote.mutateAsync({ id: selectedNoteId, isPinned: !currentNote.is_pinned });
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedNoteId) return;
    debouncedUpdate.cancel();
    await deleteNote.mutateAsync(selectedNoteId);

    onOpenNote?.(null);
  };

  const handleConvertToTask = async () => {
    if (!selectedNoteId) return;

    await createTask.mutateAsync({
      projectId,
      title: localTitle || t('notes.untitled'),
      noteId: selectedNoteId,
    });

    toast({
      title: t('notes.noteConvertedToTask'),
      description: t('notes.noteConvertedDesc'),
    });
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (note.content?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredArchivedNotes = archivedNotes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (note.content?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredTrashedNotes = trashedNotes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (note.content?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  // On mobile: show editor when note is selected, hide the list
  const showListOnMobile = isMobile && !selectedNoteId;
  const showEditorOnMobile = isMobile && selectedNoteId;

  return (
    <div className="h-full flex gap-2 sm:gap-4">
      {/* Notes List */}
      <div className={cn(
        "flex-shrink-0 flex flex-col bg-card rounded-2xl border border-border overflow-hidden",
        isMobile
          ? showListOnMobile ? "w-full" : "hidden"
          : "w-64"
      )}>
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex gap-1">
            <Button 
              onClick={() => handleCreateNote()} 
              className="flex-1 rounded-xl bg-gradient-to-r from-primary to-secondary"
              disabled={createNote.isPending}
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('notes.newNote')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl flex-shrink-0">
                  <LayoutTemplate className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t('notes.templates', 'Шаблони')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {NOTE_TEMPLATES.map(tmpl => (
                  <DropdownMenuItem key={tmpl.id} onClick={() => handleCreateNote(tmpl.id)}>
                    <span className="mr-2">{tmpl.icon}</span>
                    {i18n.language === 'bg' ? tmpl.name : tmpl.nameEn}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('notes.searchNotes')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl bg-muted/50 border-0"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'archived' | 'trash')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-2 mt-2 grid grid-cols-3 rounded-xl">
            <TabsTrigger value="active" className="rounded-lg text-xs" data-testid="notes-tab-active">
              {t('notes.active', 'Активни')}
            </TabsTrigger>
            <TabsTrigger value="archived" className="rounded-lg text-xs" data-testid="notes-tab-archived">
              <Archive className="w-3 h-3 mr-1" />
              {t('notes.archived', 'Архив')}
            </TabsTrigger>
            <TabsTrigger value="trash" className="rounded-lg text-xs" data-testid="notes-tab-trash">
              <Trash2 className="w-3 h-3 mr-1" />
              {t('notes.trash', 'Кошче')}
              {trashedNotes.length > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({trashedNotes.length})</span>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {isLoading ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : filteredNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {searchQuery ? t('notes.noNotesFound') : t('notes.noNotes')}
                  </p>
                ) : (
                  filteredNotes.map(note => (
                    <button
                      key={note.id}
                      onClick={() => handleSelectNote(note)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl transition-all",
                        selectedNoteId === note.id 
                          ? "bg-primary/10 border border-primary/20" 
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {note.is_pinned && <Pin className="w-3 h-3 mt-1 text-primary flex-shrink-0" />}
                        <FileText className={cn("w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0", note.is_pinned && "hidden")} />
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="font-medium text-sm break-words line-clamp-2">{note.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: dateLocale })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="archived" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {filteredArchivedNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {t('notes.noArchivedNotes', 'Няма архивирани бележки')}
                  </p>
                ) : (
                  filteredArchivedNotes.map(note => (
                    <div
                      key={note.id}
                      className="w-full text-left p-3 rounded-xl hover:bg-muted transition-all flex items-start gap-2"
                    >
                      <FileText className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="font-medium text-sm break-words line-clamp-2">{note.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {note.archived_at && formatDistanceToNow(new Date(note.archived_at), { addSuffix: true, locale: dateLocale })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0"
                        onClick={() => handleUnarchiveNote(note.id)}
                      >
                        <ArchiveRestore className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="trash" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {trashedNotes.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl text-xs mb-2 text-destructive hover:text-destructive"
                        data-testid="empty-trash-btn"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        {t('notes.emptyTrash', 'Изпразни кошчето')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('notes.emptyTrash', 'Изпразни кошчето')}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('notes.emptyTrashConfirm', 'Това ще изтрие постоянно всички бележки в кошчето. Действието е необратимо.')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">{t('common.cancel', 'Отказ')}</AlertDialogCancel>
                        <AlertDialogAction
                          className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={handleEmptyTrash}
                          data-testid="confirm-empty-trash"
                        >
                          {t('notes.emptyTrash', 'Изпразни кошчето')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {filteredTrashedNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {t('notes.noTrashedNotes', 'Кошчето е празно')}
                  </p>
                ) : (
                  filteredTrashedNotes.map(note => {
                    const daysInTrash = note.deleted_at
                      ? differenceInDays(new Date(), new Date(note.deleted_at))
                      : 0;
                    const daysLeft = Math.max(0, TRASH_RETENTION_DAYS - daysInTrash);

                    return (
                      <div
                        key={note.id}
                        data-testid={`trash-note-${note.id}`}
                        className="w-full text-left p-3 rounded-xl hover:bg-muted transition-all flex items-start gap-2"
                      >
                        <Trash2 className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="font-medium text-sm break-words line-clamp-2">{note.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {note.deleted_at && formatDistanceToNow(new Date(note.deleted_at), { addSuffix: true, locale: dateLocale })}
                          </p>
                          <p className={cn(
                            "text-[10px] mt-0.5 flex items-center gap-1",
                            daysLeft <= 7 ? 'text-destructive' : 'text-muted-foreground/70'
                          )}>
                            {daysLeft <= 7 && <AlertTriangle className="w-2.5 h-2.5" />}
                            {t('notes.daysLeft', { days: daysLeft, defaultValue: `Изтриване след {{days}} дни` })}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleRestoreFromTrash(note.id)}
                            title={t('notes.restore', 'Възстанови')}
                            data-testid={`trash-restore-${note.id}`}
                          >
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => handlePermanentDelete(note.id)}
                            title={t('notes.deletePermanently', 'Изтрий постоянно')}
                            data-testid={`trash-delete-${note.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Note Editor */}
      <div className={cn(
        "flex-1 bg-card rounded-2xl border border-border overflow-hidden flex flex-col",
        isMobile && !showEditorOnMobile && "hidden"
      )}>
        {selectedNoteId ? (
          <>
            <div className="p-2 sm:p-4 border-b border-border flex items-center justify-between gap-2 flex-wrap">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { flushPendingSave(); onOpenNote?.(null); }}
                  className="rounded-xl flex-shrink-0"
                  data-testid="notes-back-btn"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <Input
                value={localTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="text-base sm:text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent min-w-0 flex-1"
                placeholder={t('notes.noteTitle')}
              />
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                {hasUnsavedChanges && !isMobile && (
                  <span className="text-xs text-muted-foreground">{t('common.unsavedChanges')}</span>
                )}
                <CopyLinkButton title={t('notes.copyLink', 'Копирай линк към бележката')} />
                <Button
                  variant={hasUnsavedChanges ? "default" : "outline"}
                  size="sm"
                  onClick={handleSave}
                  disabled={updateNote.isPending || !hasUnsavedChanges}
                  className="rounded-xl"
                >
                  <Save className="w-4 h-4 mr-1" />
                  {t('common.save')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTogglePin}
                  className="rounded-xl"
                  disabled={togglePinNote.isPending}
                >
                  {selectedNote?.is_pinned ? (
                    <><PinOff className="w-4 h-4 mr-1" />{t('notes.unpin', 'Откачи')}</>
                  ) : (
                    <><Pin className="w-4 h-4 mr-1" />{t('notes.pin', 'Закачи')}</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConvertToTask}
                  disabled={createTask.isPending}
                  className="rounded-xl"
                >
                  <CheckSquare className="w-4 h-4 mr-1" />
                  {t('notes.convertToTask')}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-xl">
                      <Download className="w-4 h-4 mr-1" />
                      {t('common.export')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportPDF}>
                      <FileDown className="w-4 h-4 mr-2" />
                      {t('notes.exportPdf', 'Експорт като PDF')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportMarkdown}>
                      <FileText className="w-4 h-4 mr-2" />
                      {t('notes.exportMarkdown', 'Експорт като Markdown')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVersionsOpen(true)}
                  className="rounded-xl"
                  data-testid="note-versions-btn"
                >
                  <History className="w-4 h-4 mr-1" />
                  {t('notes.history', 'История')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchiveNote}
                  disabled={archiveNote.isPending}
                  className="rounded-xl"
                >
                  <Archive className="w-4 h-4 mr-1" />
                  {t('notes.archive', 'Архив')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDeleteNote}
                  className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <RichTextEditor
                key={selectedNoteId}
                content={localContent}
                onChange={handleContentChange}
                enableAudio
              />
              <AttachmentsSection projectId={projectId} noteId={selectedNoteId} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('notes.selectNote')}</p>
            </div>
          </div>
        )}
      </div>

      <NoteVersionsDialog
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        noteId={selectedNoteId}
        onRestore={handleRestoreVersion}
      />
    </div>
  );
}
