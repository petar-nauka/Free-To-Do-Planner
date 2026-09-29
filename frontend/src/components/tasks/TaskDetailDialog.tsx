import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  Tag,
  Edit,
  Archive,
  FileText,
  Table2,
  Clock,
  Play,
  Square,
  AlertTriangle,
  CheckSquare,
  Flag,
  ExternalLink,
  Share2,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Task } from '@/hooks/useTasks';
import { useArchivedTasks } from '@/hooks/useArchivedTasks';
import { useTaskComments } from '@/hooks/useTaskComments';
import { useTimeTracking, useTaskTotalTime, formatDuration } from '@/hooks/useTimeTracking';
import { LinkifiedText } from '@/components/common/LinkifiedText';
import { AttachmentsSection } from '@/components/attachments/AttachmentsSection';
import { EditTaskDialog } from '@/components/tasks/EditTaskDialog';
import { SafeHtml } from '@/components/common/SafeHtml';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';
import i18n from '@/i18n';

interface TaskDetailDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenNote?: (noteId: string) => void;
  onOpenSpreadsheet?: (spreadsheetId: string) => void;
}

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'Висок', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30' },
  medium: { label: 'Среден', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30' },
  low: { label: 'Нисък', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: 'Нова', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  in_progress: { label: 'В процес', color: 'bg-purple-500/10 text-purple-500 border-purple-500/30' },
  future: { label: 'На изчакване', color: 'bg-slate-500/10 text-slate-500 border-slate-500/30' },
};

// Detect if description looks like HTML
function isHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onOpenNote,
  onOpenSpreadsheet,
}: TaskDetailDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const dateLocale = i18n.language === 'bg' ? bg : enUS;
  const { archiveTask } = useArchivedTasks(task.project_id);
  const { comments } = useTaskComments(task.id);
  const { activeTimer, startTimer, stopTimer } = useTimeTracking();
  const { data: totalSeconds = 0 } = useTaskTotalTime(task.id);
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isActive = activeTimer?.task_id === task.id;
  const hasLinkedNote = !!task.note_id;
  const hasLinkedSpreadsheet = !!task.spreadsheet_id;

  const priorityInfo = priorityConfig[task.priority] || priorityConfig.medium;
  const statusInfo = statusConfig[task.status] || statusConfig.new;

  const dueDateInfo = (() => {
    if (!task.due_date) return null;
    const d = parseISO(task.due_date);
    const overdue = isPast(d) && !isToday(d);
    return {
      label: format(d, 'EEEE, d MMMM yyyy', { locale: dateLocale }),
      overdue,
      today: isToday(d),
    };
  })();

  const handleTimerClick = () => {
    if (isActive) stopTimer.mutate();
    else startTimer.mutate(task.id);
  };

  const handleArchive = () => {
    archiveTask.mutate(task.id);
    onOpenChange(false);
  };

  // Без onOpenChange(false): затварянето на задачата също е навигация (към таба
  // „Задачи") и би изтрило току-що отворения адрес на бележката/таблицата.
  // Диалогът се затваря сам, защото адресът вече не сочи към задачата.
  const handleOpenLinkedNote = () => {
    if (task.note_id && onOpenNote) onOpenNote(task.note_id);
  };

  const handleOpenLinkedSpreadsheet = () => {
    if (task.spreadsheet_id && onOpenSpreadsheet) onOpenSpreadsheet(task.spreadsheet_id);
  };

  const handleShareLink = async () => {
    // Адресната лента вече сочи точно към тази задача (`/p/<проект>/tasks/<задача>`),
    // затова копираме нея — така копираното никога не се разминава с видяното.
    const url = window.location.href;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure contexts
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast({
        title: t('tasks.linkCopied', 'Линкът е копиран'),
        description: t('tasks.linkCopiedDesc', 'Можете да го споделите с колеги.'),
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: t('common.error', 'Грешка'),
        description: t('tasks.linkCopyFailed', 'Не успях да копирам линка. Опитайте ръчно: ') + url,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl rounded-2xl p-0 gap-0 flex flex-col max-h-[90dvh]"
          data-testid="task-detail-dialog"
        >
          {/* Header */}
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border">
            <div className="flex items-start gap-2 flex-wrap mb-2">
              <Badge variant="outline" className={cn('text-xs h-6 px-2 rounded-lg', priorityInfo.bg, priorityInfo.color)}>
                <Flag className="w-3 h-3 mr-1" />
                {priorityInfo.label}
              </Badge>
              <Badge variant="outline" className={cn('text-xs h-6 px-2 rounded-lg', statusInfo.color)}>
                {statusInfo.label}
              </Badge>
              {dueDateInfo?.overdue && (
                <Badge variant="destructive" className="text-xs h-6 px-2 rounded-lg">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {t('dashboard.overdue', 'Просрочена')}
                </Badge>
              )}
              {dueDateInfo?.today && !dueDateInfo.overdue && (
                <Badge className="text-xs h-6 px-2 rounded-lg bg-amber-500 hover:bg-amber-600">
                  {t('dashboard.today', 'Днес')}
                </Badge>
              )}
            </div>
            <DialogTitle
              className="text-xl sm:text-2xl font-bold leading-tight break-words pr-8"
              data-testid="task-detail-title"
            >
              {task.title}
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable body */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 sm:p-6 space-y-5">
              {/* Description */}
              {task.description && task.description.trim() && (
                <section data-testid="task-detail-description">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    {t('tasks.description', 'Описание')}
                  </h3>
                  {isHtml(task.description) ? (
                    <SafeHtml html={task.description} />
                  ) : (
                    <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      <LinkifiedText text={task.description} />
                    </div>
                  )}
                </section>
              )}

              {/* Meta info grid */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dueDateInfo && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border">
                    <Calendar className={cn(
                      'w-4 h-4 mt-0.5 flex-shrink-0',
                      dueDateInfo.overdue ? 'text-red-500' : 'text-muted-foreground'
                    )} />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t('tasks.dueDate', 'Краен срок')}</p>
                      <p className={cn(
                        'text-sm font-medium break-words',
                        dueDateInfo.overdue && 'text-red-500'
                      )}>
                        {dueDateInfo.label}
                      </p>
                    </div>
                  </div>
                )}

                {(isActive || totalSeconds > 0) && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border">
                    <Clock className={cn(
                      'w-4 h-4 mt-0.5 flex-shrink-0',
                      isActive ? 'text-emerald-500' : 'text-muted-foreground'
                    )} />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {t('timeTracking.totalTime', 'Общо изхарчено време')}
                      </p>
                      <p className={cn('text-sm font-medium tabular-nums', isActive && 'text-emerald-500')}>
                        {formatDuration(totalSeconds)}
                        {isActive && (
                          <span className="ml-2 text-xs animate-pulse">● {t('timeTracking.active', 'активен')}</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* Tags */}
              {task.task_tags && task.task_tags.length > 0 && (
                <section data-testid="task-detail-tags">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {t('tasks.tags', 'Тагове')}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {task.task_tags.map(tag => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-md',
                          `bg-project-${tag.color}/20 text-project-${tag.color}`
                        )}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {/* Linked items */}
              {(hasLinkedNote || hasLinkedSpreadsheet) && (
                <section>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    {t('tasks.linked', 'Свързано')}
                  </h3>
                  <div className="space-y-2">
                    {hasLinkedNote && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenLinkedNote}
                        className="w-full justify-start rounded-xl"
                        data-testid="task-detail-open-note"
                      >
                        <FileText className="w-4 h-4 mr-2 text-primary" />
                        {t('tasks.openLinkedNote', 'Отвори свързаната бележка')}
                        <ExternalLink className="w-3 h-3 ml-auto" />
                      </Button>
                    )}
                    {hasLinkedSpreadsheet && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenLinkedSpreadsheet}
                        className="w-full justify-start rounded-xl"
                        data-testid="task-detail-open-spreadsheet"
                      >
                        <Table2 className="w-4 h-4 mr-2 text-primary" />
                        {t('tasks.openLinkedSpreadsheet', 'Отвори свързаната таблица')}
                        <ExternalLink className="w-3 h-3 ml-auto" />
                      </Button>
                    )}
                  </div>
                </section>
              )}

              {/* Attachments */}
              <section data-testid="task-detail-attachments">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  {t('attachments.title', 'Прикачени файлове')}
                </h3>
                <AttachmentsSection projectId={task.project_id} taskId={task.id} />
              </section>

              {/* Comments preview */}
              {comments.length > 0 && (
                <section data-testid="task-detail-comments">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    {t('tasks.comments', 'Коментари')} ({comments.length})
                  </h3>
                  <div className="space-y-2">
                    {comments.slice(-5).map(c => (
                      <div key={c.id} className="p-2.5 rounded-xl bg-muted/40 border border-border">
                        <p className="text-xs font-medium mb-0.5">{c.user_display_name || 'User'}</p>
                        <p className="text-sm break-words whitespace-pre-wrap">{c.content}</p>
                      </div>
                    ))}
                    {comments.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">
                        {t('tasks.moreComments', '+{{count}} още коментара (отворете "Редактирай" за всички)', { count: comments.length - 5 })}
                      </p>
                    )}
                  </div>
                </section>
              )}
            </div>
          </ScrollArea>

          {/* Footer with actions */}
          <DialogFooter className="p-3 sm:p-4 border-t border-border flex-row gap-2 flex-wrap sm:flex-nowrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareLink}
              className={cn('rounded-xl flex-1 sm:flex-none', copied && 'border-emerald-400 text-emerald-500')}
              data-testid="task-detail-share-btn"
            >
              {copied ? (
                <><Check className="w-4 h-4 mr-1" />{t('tasks.copied', 'Копирано')}</>
              ) : (
                <><Share2 className="w-4 h-4 mr-1" />{t('tasks.shareLink', 'Сподели')}</>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTimerClick}
              disabled={startTimer.isPending || stopTimer.isPending}
              className={cn('rounded-xl flex-1 sm:flex-none', isActive && 'border-emerald-400 text-emerald-500')}
              data-testid="task-detail-timer-btn"
            >
              {isActive ? (
                <><Square className="w-4 h-4 mr-1 fill-current" />{t('timeTracking.stop', 'Спри')}</>
              ) : (
                <><Play className="w-4 h-4 mr-1" />{t('timeTracking.start', 'Старт')}</>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleArchive}
              disabled={archiveTask.isPending}
              className="rounded-xl flex-1 sm:flex-none"
              data-testid="task-detail-archive-btn"
            >
              <Archive className="w-4 h-4 mr-1" />
              {t('tasks.archiveTask', 'Архивирай')}
            </Button>
            <Button
              size="sm"
              onClick={() => setEditOpen(true)}
              className="rounded-xl flex-1 sm:flex-none"
              data-testid="task-detail-edit-btn"
            >
              <Edit className="w-4 h-4 mr-1" />
              {t('common.edit', 'Редактирай')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditTaskDialog task={task} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
