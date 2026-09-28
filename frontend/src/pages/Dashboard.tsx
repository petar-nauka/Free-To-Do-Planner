import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderKanban, SearchX } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { MobileNav } from '@/components/layout/MobileNav';
import { ProjectView, ProjectMenuActions } from '@/components/projects/ProjectView';
import { PendingInvitationsCard } from '@/components/projects/PendingInvitationsCard';
import { TaskCalendar } from '@/components/dashboard/TaskCalendar';
import { TaskStatsCard } from '@/components/dashboard/TaskStatsCard';
import { PriorityTasksCard } from '@/components/dashboard/PriorityTasksCard';
import { GlobalPriorityTasksCard } from '@/components/dashboard/GlobalPriorityTasksCard';
import { PostponedTasksCard } from '@/components/dashboard/PostponedTasksCard';
import { QuickNoteCard } from '@/components/dashboard/QuickNoteCard';
import { ProjectProgressChart } from '@/components/dashboard/ProjectProgressChart';
import { Project, useProjects } from '@/hooks/useProjects';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  entitySegment,
  isProjectTab,
  legacyPathToNew,
  notePath,
  parseEntityId,
  projectPath,
  projectTabPath,
  type ProjectTab,
} from '@/lib/deepLinks';

function getGreeting(t: (key: string) => string) {
  const h = new Date().getHours();
  if (h < 12) return t('dashboard.goodMorning');
  if (h < 18) return t('dashboard.goodAfternoon');
  return t('dashboard.goodEvening');
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { projectSegment, '*': rest } = useParams();
  const [tab, itemSegment] = (rest ?? '').split('/');
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { projects, isLoading: projectsLoading } = useProjects();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'projects' | 'notes' | 'tasks' | 'search' | 'settings'>('projects');
  const [projectMenuActions, setProjectMenuActions] = useState<ProjectMenuActions | null>(null);

  // Адресът е източникът на истината: /p/<проект>/<таб>/<елемент>.
  // Всичко по-долу се изчислява от него — няма състояние, което да се разминава с URL-а.
  const projectId = parseEntityId(projectSegment);
  const selectedProject = projectId ? projects.find(p => p.id === projectId) ?? null : null;
  const activeTab: ProjectTab = isProjectTab(tab) ? tab : 'tasks';
  const openItemId = parseEntityId(itemSegment);
  const awaitingProject = !!projectSegment && !selectedProject && projectsLoading;
  const projectMissing = !!projectSegment && !selectedProject && !projectsLoading;

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  // Старият формат `/?project=X&task=Y` → новите адреси.
  // Пази вече изпратените имейл напомняния и всеки линк, запазен преди промяната.
  useEffect(() => {
    const legacyProjectId = searchParams.get('project');
    if (!legacyProjectId) return;

    // Изчакваме проектите; ако такъв няма, оставяме адреса както е.
    const target = projects.find(p => p.id === legacyProjectId);
    if (!target) return;

    const path = legacyPathToNew(searchParams, target);
    if (path) navigate(path, { replace: true });
  }, [searchParams, projects, navigate]);

  const goToProject = useCallback(
    (project: Project | null) => navigate(project ? projectPath(project) : '/'),
    [navigate],
  );

  const handleMenuActionsReady = useCallback((actions: ProjectMenuActions) => {
    setProjectMenuActions(actions);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center animate-bounce-subtle">
            <FolderKanban className="w-8 h-8 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userEmail = user.email?.split('@')[0] || '';

  return (
    <div className="min-h-screen flex bg-background">
      {!isMobile && (
        <AppSidebar
          selectedProjectId={selectedProject?.id || null}
          onSelectProject={goToProject}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {isMobile && (
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="p-0 w-72">
            <AppSidebar
              selectedProjectId={selectedProject?.id || null}
              onSelectProject={(project) => {
                goToProject(project);
                setMobileSidebarOpen(false);
              }}
              isCollapsed={false}
              onToggleCollapse={() => {}}
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 flex flex-col min-h-screen">
        <AppHeader 
          onMenuClick={() => setMobileSidebarOpen(true)}
          showMenuButton={isMobile}
          projectName={selectedProject?.name}
          onGoHome={() => navigate('/')}
          projectMenu={selectedProject && projectMenuActions ? {
            onTeamClick: projectMenuActions.onTeamClick,
            onEditClick: projectMenuActions.onEditClick,
            onExportClick: projectMenuActions.onExportClick,
            onArchiveClick: projectMenuActions.onArchiveClick,
            onDeleteClick: projectMenuActions.onDeleteClick,
            onMergeClick: projectMenuActions.onMergeClick,
            isOwner: projectMenuActions.isOwner,
            isExporting: projectMenuActions.isExporting,
            isArchiving: projectMenuActions.isArchiving,
          } : undefined}
        />

        <main className="flex-1 overflow-hidden">
          {awaitingProject ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-muted-foreground">{t('common.loading')}</p>
            </div>
          ) : projectMissing ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                <SearchX className="w-12 h-12 text-muted-foreground opacity-40" />
                <div>
                  <p className="font-semibold">Не е намерено</p>
                  <p className="text-sm text-muted-foreground">
                    Този линк сочи към проект, който вече не съществува или не е споделен с теб.
                  </p>
                </div>
                <Button onClick={() => navigate('/')} className="rounded-xl">
                  Към таблото
                </Button>
              </div>
            </div>
          ) : selectedProject ? (
            <ProjectView
              project={selectedProject}
              activeTab={activeTab}
              openItemId={openItemId}
              onTabChange={(nextTab) => navigate(projectTabPath(selectedProject, nextTab))}
              onOpenItem={(nextTab, item) => {
                const tabPath = projectTabPath(selectedProject, nextTab);
                if (!item) {
                  // Затваряне: заместваме записа в историята, за да не отваря
                  // „назад" веднага пак това, което току-що затворихме.
                  navigate(tabPath, { replace: true });
                  return;
                }
                navigate(`${tabPath}/${entitySegment(item.title ?? item.name, item.id)}`);
              }}
              onProjectDeleted={() => navigate('/')}
              onMenuActionsReady={handleMenuActionsReady}
            />
          ) : (
            <div className="h-full overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
              <div className="max-w-6xl mx-auto space-y-5">
                <PendingInvitationsCard />
                
                {/* Compact personalized greeting */}
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold">
                    {getGreeting(t)}, <span className="gradient-text">{userEmail}</span> 👋
                  </h2>
                </div>

                {/* ⚡ Quick Note (Google Keep-style) — always at the top for fast capture */}
                <QuickNoteCard
                  onOpenFullNote={(noteProjectId, noteId) => {
                    const target = projects.find((p) => p.id === noteProjectId);
                    if (target) navigate(notePath(target, { id: noteId }));
                  }}
                />

                {/* Stats cards - compact 6-column grid */}
                <TaskStatsCard />
                
                {/* Priority Tasks */}
                <PriorityTasksCard />

                {/* Global Priority Tasks - across all projects, sortable by date */}
                <GlobalPriorityTasksCard />

                {/* Отложени задачи — без движение 30+ дни, топ 10, филтър по проект */}
                <PostponedTasksCard />

                {/* Charts in tabs */}
                <ProjectProgressChart />
                
                {/* Calendar view */}
                <TaskCalendar />
              </div>
            </div>
          )}
        </main>

        {isMobile && (
          <MobileNav 
            activeTab={mobileTab}
            onTabChange={(tab) => {
              setMobileTab(tab);
              if (tab === 'projects') {
                setMobileSidebarOpen(true);
              } else if (tab === 'notes' && selectedProject) {
                navigate(projectTabPath(selectedProject, 'notes'));
              } else if (tab === 'tasks' && selectedProject) {
                navigate(projectTabPath(selectedProject, 'tasks'));
              } else if (tab === 'search') {
                window.dispatchEvent(new CustomEvent('open-global-search'));
              } else if (tab === 'settings') {
                navigate('/settings');
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
