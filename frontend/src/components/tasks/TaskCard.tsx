import { useState, useEffect } from 'react';
import { Calendar, Tag, MoreVertical, Trash2, Edit, Archive, FileText, Table2, FolderInput, MessageSquare, Play, Square, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Task, useTasks } from '@/hooks/useTasks';
import { useArchivedTasks } from '@/hooks/useArchivedTasks';
import { useTaskComments } from '@/hooks/useTaskComments';
import { useTimeTracking, useTaskTotalTime, formatDuration } from '@/hooks/useTimeTracking';
import { EditTaskDialog } from '@/components/tasks/EditTaskDialog';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { LinkifiedText } from '@/components/common/LinkifiedText';
import { MoveTaskDialog } from '@/components/tasks/MoveTaskDialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

const priorityColors = {
  low: 'bg-priority-low',
  medium: 'bg-priority-medium',
  high: 'bg-priority-high',
};

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  /** Отворен ли е детайлният диалог — решава го адресът, не картата. */
  isDetailOpen?: boolean;
  onDetailOpenChange?: (open: boolean) => void;
  onOpenNote?: (noteId: string) => void;
  onOpenSpreadsheet?: (spreadsheetId: string) => void;
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const base = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    setElapsed(base);
    const id = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <span className="tabular-nums">{formatDuration(elapsed)}</span>;
}

export function TaskCard({ task, isDragging, isDetailOpen = false, onDetailOpenChange, onOpenNote, onOpenSpreadsheet }: TaskCardProps) {
  const { t } = useTranslation();
  const { deleteTask } = useTasks(task.project_id);
  const { archiveTask } = useArchivedTasks(task.project_id);
  const { comments } = useTaskComments(task.id);
  const { activeTimer, startTimer, stopTimer } = useTimeTracking();
  const { data: totalSeconds = 0 } = useTaskTotalTime(task.id);
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  // Детайлният диалог няма собствено състояние: отворен е тогава и само тогава,
  // когато адресът сочи към тази задача. Затова отпада и ефектът за „отвори при
  // пристигане по линк" — при пристигане просто рендерираме отворен диалог.

  const hasLinkedNote = !!task.note_id;
  const hasLinkedSpreadsheet = !!task.spreadsheet_id;
  const isActive = activeTimer?.task_id === task.id;

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    if (hasLinkedNote && onOpenNote) onOpenNote(task.note_id!);
    else if (hasLinkedSpreadsheet && onOpenSpreadsheet) onOpenSpreadsheet(task.spreadsheet_id!);
  };

  const handleTimerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActive) stopTimer.mutate();
    else startTimer.mutate(task.id);
  };

  return (
    <>
      <Card
        className={cn(
          'p-3 rounded-xl border border-border bg-card transition-all cursor-grab active:cursor-grabbing',
          isDragging && 'shadow-playful rotate-2 scale-105',
          (hasLinkedNote || hasLinkedSpreadsheet) && 'border-primary/30 bg-primary/5 cursor-pointer',
          isActive && 'border-emerald-400/60 ring-1 ring-emerald-400/40'
        )}
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
                    className={cn(
                      'w-3 h-3 rounded-full mt-1.5 flex-shrink-0 cursor-pointer hover:scale-150 transition-transform',
                      priorityColors[task.priority]
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  {t('common.edit')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="flex-1 min-w-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDetailOpenChange?.(true); }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-left w-full group/title focus:outline-none"
                data-testid={`task-title-${task.id}`}
                title={t('tasks.openDetails', 'Виж детайли')}
              >
                <div className="flex items-center gap-1.5">
                  {hasLinkedNote && <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                  {hasLinkedSpreadsheet && <Table2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                  <p className="font-medium text-sm leading-tight group-hover/title:text-primary group-hover/title:underline transition-colors break-words">
                    {task.title}
                  </p>
                </div>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">
                    <LinkifiedText text={task.description.replace(/<[^>]*>/g, '')} />
                  </p>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Timer button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-6 w-6 rounded-lg flex-shrink-0',
                      isActive && 'text-emerald-500 hover:text-emerald-600'
                    )}
                    onClick={handleTimerClick}
                    disabled={startTimer.isPending || stopTimer.isPending}
                  >
                    {isActive
                      ? <Square className="w-3 h-3 fill-current" />
                      : <Play className="w-3 h-3" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isActive ? t('timeTracking.stop', 'Спри таймера') : t('timeTracking.start', 'Стартирай таймер')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg flex-shrink-0">
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => setEditOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />{t('common.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => archiveTask.mutate(task.id)}>
                  <Archive className="mr-2 h-4 w-4" />{t('tasks.archiveTask')}
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => setMoveOpen(true)}>
                  <FolderInput className="mr-2 h-4 w-4" />Прехвърли
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => deleteTask.mutate(task.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {task.due_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {format(new Date(task.due_date), 'MMM d')}
            </div>
          )}

          {/* Active timer display */}
          {isActive && activeTimer && (
            <div className="flex items-center gap-1 text-xs text-emerald-500 font-semibold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <ElapsedTimer startedAt={activeTimer.started_at} />
            </div>
          )}

          {/* Total time (if any and not active) */}
          {!isActive && totalSeconds > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatDuration(totalSeconds)}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {t('timeTracking.totalTime', 'Общо изхарчено време')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {comments.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" />
                    {comments.length}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  <p className="font-medium mb-1">{t('tasks.comments', 'Коментари')}:</p>
                  {comments.slice(-2).map(c => (
                    <p key={c.id} className="truncate text-muted-foreground">
                      {c.user_display_name || 'User'}: {c.content}
                    </p>
                  ))}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {task.task_tags && task.task_tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {task.task_tags.slice(0, 3).map(tag => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className={cn('text-xs px-1.5 py-0 h-5 rounded-md', `bg-project-${tag.color}/20 text-project-${tag.color}`)}
                >
                  {tag.name}
                </Badge>
              ))}
              {task.task_tags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{task.task_tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </Card>

      <EditTaskDialog task={task} open={editOpen} onOpenChange={setEditOpen} />
      <MoveTaskDialog task={task} open={moveOpen} onOpenChange={setMoveOpen} />
      <TaskDetailDialog
        task={task}
        open={isDetailOpen}
        onOpenChange={(open) => onDetailOpenChange?.(open)}
        onOpenNote={onOpenNote}
        onOpenSpreadsheet={onOpenSpreadsheet}
      />
    </>
  );
}
