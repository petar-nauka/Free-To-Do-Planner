import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderKanban, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { useProjects, Project } from '@/hooks/useProjects';
import { useSportProgram } from '@/hooks/useSportProgram';
import { ProjectItem } from '@/components/projects/ProjectItem';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AppSidebarProps {
  selectedProjectId: string | null;
  onSelectProject: (project: Project | null) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function AppSidebar({ 
  selectedProjectId, 
  onSelectProject,
  isCollapsed,
  onToggleCollapse
}: AppSidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projects, isLoading, reorderProjects } = useProjects();
  const { isEnabled: sportEnabled } = useSportProgram();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const moveProject = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= projects.length) return;

    const reorderedProjects = Array.from(projects);
    const [movedProject] = reorderedProjects.splice(index, 1);
    reorderedProjects.splice(newIndex, 0, movedProject);

    const updates = reorderedProjects.map((project, idx) => ({
      id: project.id,
      position: idx,
    }));

    reorderProjects.mutate(updates);
  };

  return (
    <aside 
      className={cn(
        "h-full bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className={cn(
        "p-4 border-b border-sidebar-border flex items-center",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <FolderKanban className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg gradient-text">{t('auth.appDescription')}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="rounded-xl hover:bg-sidebar-accent"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* New Project Button */}
      <div className="p-3">
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className={cn(
            "w-full rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity",
            isCollapsed && "px-0"
          )}
        >
          <Plus className="w-4 h-4" />
          {!isCollapsed && <span className="ml-2">{t('projects.newProject')}</span>}
        </Button>
      </div>

      {/* Projects List */}
      <ScrollArea className="flex-1 px-3">
        <div className="pb-4 space-y-1">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            !isCollapsed && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('projects.noProjects')}
              </p>
            )
          ) : (
            projects.map((project, index) => (
              <div key={project.id} className="flex items-center gap-1 group">
                <div className="flex-1">
                  <ProjectItem
                    project={project}
                    isSelected={project.id === selectedProjectId}
                    isCollapsed={isCollapsed}
                    onClick={() => onSelectProject(project)}
                  />
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded hover:bg-sidebar-accent"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveProject(index, 'up');
                      }}
                      disabled={index === 0}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded hover:bg-sidebar-accent"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveProject(index, 'down');
                      }}
                      disabled={index === projects.length - 1}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/*
        Спорт — НЕ е проект, затова стои извън ScrollArea.
        ScrollArea е flex-1, така че бутонът се закотвя на дъното на sidebar-а
        и остава видим независимо колко проекта има в списъка.
        Показва се само ако спортът е включен от Настройки.
      */}
      {sportEnabled && (
        <div className="px-3 pb-3 pt-2 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className={cn(
              'w-full rounded-xl hover:bg-sidebar-accent',
              isCollapsed ? 'justify-center px-0' : 'justify-start gap-3',
            )}
            onClick={() => navigate('/sport')}
            title="Спорт"
          >
            <Dumbbell className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Спорт</span>}
          </Button>
        </div>
      )}

      <CreateProjectDialog
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        onCreated={(project) => {
          onSelectProject(project);
          setCreateDialogOpen(false);
        }}
      />
    </aside>
  );
}
