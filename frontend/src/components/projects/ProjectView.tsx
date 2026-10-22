import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, CheckSquare, Bell, RefreshCw, Table2, PenTool } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Project, useProjects } from '@/hooks/useProjects';
import type { ProjectTab } from '@/lib/deepLinks';
import { useArchivedProjects } from '@/hooks/useArchivedProjects';
import { useNotes } from '@/hooks/useNotes';
import { useTasks } from '@/hooks/useTasks';
import { NotesSection } from '@/components/notes/NotesSection';
import { TasksSection } from '@/components/tasks/TasksSection';
import { RemindersSection } from '@/components/reminders/RemindersSection';
import { RecurringSection } from '@/components/recurring/RecurringSection';
import { SpreadsheetsSection } from '@/components/spreadsheets/SpreadsheetsSection';
import { WhiteboardsSection } from '@/components/whiteboards/WhiteboardsSection';
import { TodayPlanSection } from '@/components/todayplan/TodayPlanSection';
import { EditProjectDialog } from '@/components/projects/EditProjectDialog';
import { InviteMemberDialog } from '@/components/projects/InviteMemberDialog';
import { MergeProjectDialog } from '@/components/projects/MergeProjectDialog';
import { TeamMembersDialog } from '@/components/projects/TeamMembersDialog';
import { generateProjectPDF } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTodayPlanSettings } from '@/hooks/useTodayPlanSettings';

export interface ProjectMenuActions {
  onTeamClick: () => void;
  onEditClick: () => void;
  onExportClick: () => void;
  onArchiveClick: () => void;
  onDeleteClick: () => void;
  onMergeClick: () => void;
  isOwner: boolean;
  isExporting: boolean;
  isArchiving: boolean;
}

interface ProjectViewProps {
  project: Project;
  /** Активният таб — идва от адреса, не от локално състояние. */
  activeTab: ProjectTab;
  /** Id на отворения елемент в този таб (задача / бележка / таблица), или null. */
  openItemId: string | null;
  onTabChange: (tab: ProjectTab) => void;
  /**
   * Отваря (или затваря, при `null`) елемент в даден таб чрез навигация.
   * Името е по желание — то е само украса в адреса; id-то е това, което се чете.
   */
  onOpenItem: (tab: ProjectTab, item: { id: string; title?: string | null; name?: string | null } | null) => void;
  onProjectDeleted: () => void;
  onMenuActionsReady?: (actions: ProjectMenuActions) => void;
}

export function ProjectView({ project, activeTab, openItemId, onTabChange, onOpenItem, onProjectDeleted, onMenuActionsReady }: ProjectViewProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { deleteProject } = useProjects();
  const { archiveProject } = useArchivedProjects();
  const { notes } = useNotes(project.id);
  const { tasks } = useTasks(project.id);
  const { toast } = useToast();
  const { isEnabled: todayPlanEnabled } = useTodayPlanSettings();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  // Табът и отвореният елемент идват от адреса (props). Затова тук няма нито
  // локално състояние за тях, нито браузърни събития със setTimeout — адресът
  // пристига наготово още при първия рендер.

  const isOwner = project.user_id === user?.id;

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      generateProjectPDF(project, notes, tasks);
      toast({
        title: t('projects.pdfReady'),
        description: t('projects.pdfReadyDesc'),
      });
    } catch (error: any) {
      toast({
        title: t('projects.exportFailed'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    await deleteProject.mutateAsync(project.id);
    onProjectDeleted();
  };

  const handleArchive = async () => {
    await archiveProject.mutateAsync(project.id);
    onProjectDeleted();
  };

  // Notify parent about menu actions
  useEffect(() => {
    if (onMenuActionsReady) {
      onMenuActionsReady({
        onTeamClick: () => setTeamOpen(true),
        onEditClick: () => setEditOpen(true),
        onExportClick: handleExportPDF,
        onArchiveClick: handleArchive,
        onDeleteClick: () => setDeleteOpen(true),
        onMergeClick: () => setMergeOpen(true),
        isOwner,
        isExporting,
        isArchiving: archiveProject.isPending,
      });
    }
  }, [onMenuActionsReady, isOwner, isExporting, archiveProject.isPending, notes, tasks]);

  return (
    <div className="h-full flex flex-col">
      {/* Description only if exists */}
      {project.description && (
        <div className="px-6 pt-4">
          <p className="text-muted-foreground text-sm">{project.description}</p>
        </div>
      )}

      {/* Today Plan Section */}
      {todayPlanEnabled && (
        <div className="px-6 pt-4">
          <TodayPlanSection projectId={project.id} />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as ProjectTab)} className="flex-1 flex flex-col">
        <div className="px-6 pt-4">
          <TabsList className="bg-muted rounded-xl p-1">
            <TabsTrigger 
              value="tasks"
              className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-soft"
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              {t('nav.tasks')}
            </TabsTrigger>
            <TabsTrigger 
              value="notes" 
              className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-soft"
            >
              <FileText className="w-4 h-4 mr-2" />
              {t('nav.notes')}
            </TabsTrigger>
            <TabsTrigger
              value="sheets"
              className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-soft"
            >
              <Table2 className="w-4 h-4 mr-2" />
              {t('spreadsheets.title', 'Таблици')}
            </TabsTrigger>
            <TabsTrigger
              value="boards"
              className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-soft"
            >
              <PenTool className="w-4 h-4 mr-2" />
              {t('whiteboards.title', 'Дъски')}
            </TabsTrigger>
            <TabsTrigger 
              value="reminders"
              className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-soft"
            >
              <Bell className="w-4 h-4 mr-2" />
              {t('reminders.title')}
            </TabsTrigger>
            <TabsTrigger 
              value="recurring"
              className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-soft"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('recurring.recurringShort')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tasks" className="flex-1 mt-0 p-6 pb-20 md:pb-6 overflow-hidden">
          <TasksSection
            projectId={project.id}
            openTaskId={activeTab === 'tasks' ? openItemId : null}
            onOpenTask={(task) => onOpenItem('tasks', task)}
            onOpenNote={(noteId) => onOpenItem('notes', { id: noteId })}
            onOpenSpreadsheet={(spreadsheetId) => onOpenItem('sheets', { id: spreadsheetId })}
          />
        </TabsContent>

        <TabsContent value="notes" className="flex-1 mt-0 p-6 overflow-hidden">
          <NotesSection
            projectId={project.id}
            openNoteId={activeTab === 'notes' ? openItemId : null}
            onOpenNote={(note) => onOpenItem('notes', note)}
          />
        </TabsContent>

        <TabsContent value="sheets" className="flex-1 mt-0 p-6 pb-20 md:pb-6 overflow-hidden">
          <SpreadsheetsSection
            projectId={project.id}
            openSheetId={activeTab === 'sheets' ? openItemId : null}
            onOpenSheet={(sheet) => onOpenItem('sheets', sheet)}
          />
        </TabsContent>

        <TabsContent value="boards" className="flex-1 mt-0 p-6 pb-20 md:pb-6 overflow-hidden">
          <WhiteboardsSection
            projectId={project.id}
            openBoardId={activeTab === 'boards' ? openItemId : null}
            onOpenBoard={(board) => onOpenItem('boards', board)}
          />
        </TabsContent>

        <TabsContent value="reminders" className="flex-1 mt-0 p-6 pb-20 md:pb-6 overflow-auto">
          <RemindersSection projectId={project.id} />
        </TabsContent>

        <TabsContent value="recurring" className="flex-1 mt-0 p-6 pb-20 md:pb-6 overflow-auto">
          <RecurringSection projectId={project.id} />
        </TabsContent>
      </Tabs>

      <EditProjectDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <InviteMemberDialog
        projectId={project.id}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />

      <TeamMembersDialog
        project={project}
        open={teamOpen}
        onOpenChange={setTeamOpen}
        onInvite={() => {
          setTeamOpen(false);
          setInviteOpen(true);
        }}
      />

      <MergeProjectDialog
        project={project}
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        onMerged={onProjectDeleted}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('projects.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('projects.deleteWarning', { name: project.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="rounded-xl bg-destructive hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
