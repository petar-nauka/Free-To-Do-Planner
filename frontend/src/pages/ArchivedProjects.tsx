import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  Archive, 
  RotateCcw, 
  Trash2,
  Folder,
  Star,
  Heart,
  Zap,
  Rocket,
  Target,
  Briefcase,
  Code,
  Book,
  Music,
  Camera,
  Home,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useArchivedProjects, ArchivedProject } from '@/hooks/useArchivedProjects';
import { useProjects } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const iconMap: Record<string, React.ElementType> = {
  folder: Folder,
  star: Star,
  heart: Heart,
  zap: Zap,
  rocket: Rocket,
  target: Target,
  briefcase: Briefcase,
  code: Code,
  book: Book,
  music: Music,
  camera: Camera,
  home: Home,
};

const colorMap: Record<string, string> = {
  red: 'bg-project-red',
  orange: 'bg-project-orange',
  amber: 'bg-project-amber',
  yellow: 'bg-project-yellow',
  lime: 'bg-project-lime',
  green: 'bg-project-green',
  teal: 'bg-project-teal',
  cyan: 'bg-project-cyan',
  blue: 'bg-project-blue',
  indigo: 'bg-project-indigo',
  purple: 'bg-project-purple',
  pink: 'bg-project-pink',
};

export default function ArchivedProjects() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { archivedProjects, isLoading, unarchiveProject } = useArchivedProjects();
  const { deleteProject } = useProjects();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ArchivedProject | null>(null);

  const handleUnarchive = async (projectId: string) => {
    await unarchiveProject.mutateAsync(projectId);
  };

  const handleDeleteClick = (project: ArchivedProject) => {
    setProjectToDelete(project);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (projectToDelete) {
      await deleteProject.mutateAsync(projectToDelete.id);
      setDeleteOpen(false);
      setProjectToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 bg-card border-b border-border px-4 flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/settings')}
          className="rounded-xl"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Archive className="w-5 h-5" />
          <h1 className="text-xl font-bold">Архивирани проекти</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : archivedProjects.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="py-12 text-center">
              <Archive className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Няма архивирани проекти</h3>
              <p className="text-muted-foreground">
                Когато архивирате проект, той ще се появи тук.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {archivedProjects.map((project) => {
              const Icon = iconMap[project.icon] || Folder;
              const colorClass = colorMap[project.color] || 'bg-project-purple';

              return (
                <Card key={project.id} className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-primary-foreground",
                        colorClass
                      )}>
                        <Icon className="w-6 h-6" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{project.name}</h3>
                        {project.description && (
                          <p className="text-sm text-muted-foreground truncate">{project.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Архивиран на {format(new Date(project.archived_at), 'dd.MM.yyyy')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnarchive(project.id)}
                          disabled={unarchiveProject.isPending}
                          className="rounded-xl"
                        >
                          {unarchiveProject.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Възстанови
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(project)}
                          className="rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Изтриване на проект</AlertDialogTitle>
            <AlertDialogDescription>
              Сигурни ли сте, че искате да изтриете "{projectToDelete?.name}"? 
              Това действие е необратимо и всички данни в проекта ще бъдат загубени.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
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
