import { useState } from 'react';
import { Archive, RotateCcw, Trash2, ChevronDown, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { useArchivedTasks, ArchivedTask } from '@/hooks/useArchivedTasks';
import { useTasks } from '@/hooks/useTasks';
import { format, parseISO } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface ArchiveDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityColors = {
  low: 'bg-priority-low',
  medium: 'bg-priority-medium',
  high: 'bg-priority-high',
};

export function ArchiveDialog({ projectId, open, onOpenChange }: ArchiveDialogProps) {
  const { t, i18n } = useTranslation();
  const { groupedByMonth, isLoading, unarchiveTask } = useArchivedTasks(projectId);
  const { deleteTask } = useTasks(projectId);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const [deletingTask, setDeletingTask] = useState<ArchivedTask | null>(null);

  const dateLocale = i18n.language === 'bg' ? bg : enUS;
  const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev =>
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
    );
  };

  const formatMonthHeader = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, 'MMMM yyyy', { locale: dateLocale });
  };

  const handleDelete = async () => {
    if (deletingTask) {
      await deleteTask.mutateAsync(deletingTask.id);
      setDeletingTask(null);
    }
  };

  const totalArchived = Object.values(groupedByMonth).reduce((sum, tasks) => sum + tasks.length, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              {t('tasks.taskArchive')}
            </DialogTitle>
            <DialogDescription>
              {t('tasks.archivedTasksCount', { count: totalArchived })}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh] pr-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sortedMonths.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('tasks.noArchivedTasks')}</p>
                <p className="text-sm mt-1">{t('tasks.completedTasksAppear')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedMonths.map(monthKey => {
                  const tasks = groupedByMonth[monthKey];
                  const isExpanded = expandedMonths.includes(monthKey);
                  
                  return (
                    <Collapsible key={monthKey} open={isExpanded} onOpenChange={() => toggleMonth(monthKey)}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between p-3 h-auto rounded-xl hover:bg-muted"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{formatMonthHeader(monthKey)}</span>
                          </div>
                          <Badge variant="secondary" className="rounded-lg">
                            {tasks.length}
                          </Badge>
                        </Button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="space-y-2 pl-6 pt-2">
                        {tasks.map(task => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-xl"
                          >
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <div className={cn(
                                "w-2 h-2 rounded-full flex-shrink-0 mt-1.5",
                                priorityColors[task.priority]
                              )} />
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <p className="font-medium text-sm break-words line-clamp-2">{task.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {t('tasks.archived')} {format(parseISO(task.archived_at), 'MMM d, yyyy', { locale: dateLocale })}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                onClick={() => unarchiveTask.mutate(task.id)}
                                disabled={unarchiveTask.isPending}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeletingTask(task)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingTask} onOpenChange={() => setDeletingTask(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tasks.deleteTaskPermanently')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('tasks.deleteTaskWarning', { title: deletingTask?.title })}
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
    </>
  );
}