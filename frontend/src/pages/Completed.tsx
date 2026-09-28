import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, FileText, FolderKanban, ChevronLeft, ChevronRight, Calendar, RotateCcw, Trash2, Archive as ArchiveIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';
import i18n from '@/i18n';

const PAGE_SIZE = 10;

type Tab = 'tasks' | 'notes' | 'projects';

interface CompletedTask {
  id: string;
  title: string;
  project_id: string;
  priority: string;
  archived_at: string;
  due_date: string | null;
  project_name?: string;
}

interface ArchivedNote {
  id: string;
  title: string;
  project_id: string;
  archived_at: string;
  project_name?: string;
}

interface ArchivedProject {
  id: string;
  name: string;
  archived_at: string;
  description: string | null;
}

export default function Completed() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dateLocale = i18n.language === 'bg' ? bg : enUS;
  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search]);

  // Completed tasks (archived_at not null)
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['completed-tasks', user?.id],
    queryFn: async (): Promise<CompletedTask[]> => {
      const { data: projects } = await supabase.from('projects').select('id, name');
      const projectMap = new Map((projects || []).map((p: any) => [p.id, p.name]));
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, project_id, priority, archived_at, due_date')
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map((t: any) => ({ ...t, project_name: projectMap.get(t.project_id) || '' }));
    },
    enabled: !!user,
  });

  // Archived notes
  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: ['completed-notes', user?.id],
    queryFn: async (): Promise<ArchivedNote[]> => {
      const { data: projects } = await supabase.from('projects').select('id, name');
      const projectMap = new Map((projects || []).map((p: any) => [p.id, p.name]));
      const { data, error } = await supabase
        .from('notes')
        .select('id, title, project_id, archived_at')
        .not('archived_at', 'is', null)
        .is('deleted_at', null)
        .order('archived_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map((n: any) => ({ ...n, project_name: projectMap.get(n.project_id) || '' }));
    },
    enabled: !!user,
  });

  // Archived projects
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['completed-projects', user?.id],
    queryFn: async (): Promise<ArchivedProject[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, archived_at, description')
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ArchivedProject[];
    },
    enabled: !!user,
  });

  // Mutations
  const restoreTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').update({ archived_at: null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['completed-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      toast({ title: t('completed.taskRestored', 'Задачата е възстановена') });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['completed-tasks'] });
      toast({ title: t('completed.taskDeleted', 'Задачата е изтрита') });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const restoreNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes').update({ archived_at: null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['completed-notes'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({ title: t('completed.noteRestored', 'Бележката е възстановена') });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const allTasks = tasksData || [];
  const allNotes = notesData || [];
  const allProjects = projectsData || [];

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return allTasks;
    const q = search.toLowerCase();
    return allTasks.filter(t => t.title.toLowerCase().includes(q) || (t.project_name || '').toLowerCase().includes(q));
  }, [allTasks, search]);

  const filteredNotes = useMemo(() => {
    if (!search.trim()) return allNotes;
    const q = search.toLowerCase();
    return allNotes.filter(n => n.title.toLowerCase().includes(q) || (n.project_name || '').toLowerCase().includes(q));
  }, [allNotes, search]);

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return allProjects;
    const q = search.toLowerCase();
    return allProjects.filter(p => p.name.toLowerCase().includes(q));
  }, [allProjects, search]);

  const counts = {
    tasks: filteredTasks.length,
    notes: filteredNotes.length,
    projects: filteredProjects.length,
  };

  const currentList: any[] =
    activeTab === 'tasks' ? filteredTasks
    : activeTab === 'notes' ? filteredNotes
    : filteredProjects;

  const totalPages = Math.max(1, Math.ceil(currentList.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = currentList.slice(pageStart, pageStart + PAGE_SIZE);

  const isLoading = tasksLoading || notesLoading || projectsLoading;

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader onMenuClick={() => {}} showMenuButton={false} onGoHome={() => navigate('/')} />

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                {t('completed.title', 'Завършени')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('completed.subtitle', 'Всички завършени задачи и архивирани елементи на едно място')}
              </p>
            </div>
          </div>

          <Card className="rounded-2xl" data-testid="completed-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)} className="w-full sm:w-auto">
                  <TabsList className="rounded-xl w-full sm:w-auto">
                    <TabsTrigger value="tasks" className="rounded-lg flex-1 sm:flex-none" data-testid="completed-tab-tasks">
                      <CheckCircle2 className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">{t('completed.tasks', 'Задачи')}</span>
                      <Badge variant="secondary" className="ml-1 sm:ml-2">{counts.tasks}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="rounded-lg flex-1 sm:flex-none" data-testid="completed-tab-notes">
                      <FileText className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">{t('completed.notes', 'Бележки')}</span>
                      <Badge variant="secondary" className="ml-1 sm:ml-2">{counts.notes}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="projects" className="rounded-lg flex-1 sm:flex-none" data-testid="completed-tab-projects">
                      <FolderKanban className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">{t('completed.projects', 'Проекти')}</span>
                      <Badge variant="secondary" className="ml-1 sm:ml-2">{counts.projects}</Badge>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Input
                  data-testid="completed-search-input"
                  placeholder={t('completed.searchPlaceholder', 'Търси по име или проект...')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-xl w-full sm:w-64"
                />
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                </div>
              ) : pageItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ArchiveIcon className="w-12 h-12 mx-auto opacity-30 mb-3" />
                  <p>{t('completed.empty', 'Няма елементи в тази секция')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeTab === 'tasks' && (pageItems as CompletedTask[]).map(item => (
                    <div
                      key={item.id}
                      data-testid={`completed-task-${item.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors"
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-through opacity-80 break-words line-clamp-1">{item.title}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>{item.project_name}</span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(item.archived_at), 'd MMM yyyy', { locale: dateLocale })}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl"
                        onClick={() => restoreTask.mutate(item.id)}
                        data-testid={`completed-task-restore-${item.id}`}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        {t('completed.restore', 'Възстанови')}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-xl text-destructive hover:text-destructive"
                        onClick={() => deleteTask.mutate(item.id)}
                        data-testid={`completed-task-delete-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}

                  {activeTab === 'notes' && (pageItems as ArchivedNote[]).map(item => (
                    <div
                      key={item.id}
                      data-testid={`completed-note-${item.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors"
                    >
                      <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm break-words line-clamp-1">{item.title}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>{item.project_name}</span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(item.archived_at), 'd MMM yyyy', { locale: dateLocale })}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl"
                        onClick={() => restoreNote.mutate(item.id)}
                        data-testid={`completed-note-restore-${item.id}`}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        {t('completed.restore', 'Възстанови')}
                      </Button>
                    </div>
                  ))}

                  {activeTab === 'projects' && (pageItems as ArchivedProject[]).map(item => (
                    <div
                      key={item.id}
                      data-testid={`completed-project-${item.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors"
                    >
                      <FolderKanban className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm break-words line-clamp-1">{item.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {item.description && <span className="truncate max-w-md">{item.description}</span>}
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(item.archived_at), 'd MMM yyyy', { locale: dateLocale })}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => navigate('/settings/archived')}
                      >
                        {t('completed.manage', 'Управлявай')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {currentList.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border" data-testid="completed-pagination">
                  <span className="text-xs text-muted-foreground">
                    {t('completed.pageInfo', 'Страница {{page}} от {{total}} · {{count}} елемента', {
                      page,
                      total: totalPages,
                      count: currentList.length,
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      data-testid="completed-page-prev"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      {t('common.previous', 'Назад')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      data-testid="completed-page-next"
                    >
                      {t('common.next', 'Напред')}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
