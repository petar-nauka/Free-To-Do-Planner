import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO, isToday, isPast } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';
import { Calendar, CheckCircle, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAllTasks } from '@/hooks/useAllTasks';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

interface DayTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
}

const priorityColors: Record<string, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  new: 'Нова',
  in_progress: 'В процес',
  future: 'На изчакване',
};

export function DayTasksDialog({ open, onOpenChange, date }: DayTasksDialogProps) {
  const { t } = useTranslation();
  const dateLocale = i18n.language === 'bg' ? bg : enUS;
  const { data: allTasks = [] } = useAllTasks();

  const { pending, completed } = useMemo(() => {
    if (!date) return { pending: [], completed: [] };
    const dateStr = format(date, 'yyyy-MM-dd');
    const pending = allTasks.filter(
      t => !t.archived_at && t.due_date && t.due_date.split('T')[0] === dateStr
    );
    const completed = allTasks.filter(
      t => t.archived_at && t.archived_at.split('T')[0] === dateStr
    );
    return { pending, completed };
  }, [allTasks, date]);

  if (!date) return null;

  const total = pending.length + completed.length;
  const isOverdueDay = isPast(date) && !isToday(date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl" data-testid="day-tasks-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {format(date, 'EEEE, d MMMM yyyy', { locale: dateLocale })}
            {isToday(date) && (
              <Badge variant="default" className="ml-2">{t('dashboard.today', 'Днес')}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {total === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto opacity-30 mb-3" />
            <p className="text-sm">{t('dashboard.noTasksThisDay', 'Няма задачи за този ден')}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[480px] pr-2">
            {pending.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" />
                  {isOverdueDay
                    ? t('dashboard.overdueTasks', 'Просрочени задачи')
                    : t('dashboard.pendingTasks', 'Очакващи задачи')}
                  <Badge variant="secondary" className="ml-1">{pending.length}</Badge>
                </h3>
                <div className="space-y-2">
                  {pending.map(task => (
                    <div
                      key={task.id}
                      data-testid={`day-task-pending-${task.id}`}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-xl border transition-colors',
                        isOverdueDay
                          ? 'bg-red-500/5 border-red-500/20'
                          : 'bg-muted/40 border-border'
                      )}
                    >
                      <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', priorityColors[task.priority])} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm break-words">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">{task.project_name}</span>
                          {task.status && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                              {statusLabels[task.status] || task.status}
                            </Badge>
                          )}
                          {isOverdueDay && (
                            <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                              {t('dashboard.overdue', 'Просрочена')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {completed.length > 0 && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                  {t('dashboard.completedTasks', 'Завършени задачи')}
                  <Badge variant="secondary" className="ml-1">{completed.length}</Badge>
                </h3>
                <div className="space-y-2">
                  {completed.map(task => (
                    <div
                      key={task.id}
                      data-testid={`day-task-completed-${task.id}`}
                      className="flex items-start gap-3 p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20 opacity-80"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-through break-words">{task.title}</p>
                        <span className="text-xs text-muted-foreground">{task.project_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
