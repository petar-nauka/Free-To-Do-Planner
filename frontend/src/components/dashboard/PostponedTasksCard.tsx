import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Hourglass, Calendar, AlertTriangle, FolderKanban, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAllTasks } from '@/hooks/useAllTasks';
import {
  selectPostponedTasks,
  postponedProjectOptions,
  POSTPONED_DAY_OPTIONS,
  DEFAULT_POSTPONED_DAYS,
} from '@/lib/postponedTasks';
import { taskPath } from '@/lib/deepLinks';
import { cn } from '@/lib/utils';
import { format, isPast, isToday, parseISO } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';
import i18n from '@/i18n';

const LIMIT = 10;
const DAYS_STORAGE_KEY = 'postponed_tasks_days';

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

function readStoredDays(): number {
  const stored = Number(localStorage.getItem(DAYS_STORAGE_KEY));
  return POSTPONED_DAY_OPTIONS.includes(stored as (typeof POSTPONED_DAY_OPTIONS)[number])
    ? stored
    : DEFAULT_POSTPONED_DAYS;
}

export function PostponedTasksCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dateLocale = i18n.language === 'bg' ? bg : enUS;
  const { data: allTasks = [], isLoading } = useAllTasks();
  const [days, setDays] = useState<number>(readStoredDays);
  const [projectId, setProjectId] = useState<string>('all');

  // „Сега" се взима вътре в изчислението: разликата от няколко милисекунди между
  // двете не може да промени резултат, който е с точност цели дни.
  const projectOptions = useMemo(
    () => postponedProjectOptions(allTasks, { now: Date.now(), days }),
    [allTasks, days]
  );

  const { items, total } = useMemo(
    () => selectPostponedTasks(allTasks, { now: Date.now(), days, projectId, limit: LIMIT }),
    [allTasks, days, projectId]
  );

  const changeDays = (value: string) => {
    const parsed = Number(value);
    setDays(parsed);
    localStorage.setItem(DAYS_STORAGE_KEY, String(parsed));
  };

  // Избраният проект може да няма вече отложени задачи (смяна на прага) — връщаме
  // филтъра на „всички", за да не гледа потребителят необясним празен списък.
  const projectFilterValue =
    projectId !== 'all' && !projectOptions.some((p) => p.id === projectId) ? 'all' : projectId;

  const renderDueDate = (dueDate?: string | null) => {
    if (!dueDate) return null;
    const date = parseISO(dueDate);
    const overdue = isPast(date) && !isToday(date);
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-xs',
          overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'
        )}
      >
        <Calendar className="w-3 h-3" />
        {format(date, 'd MMM yyyy', { locale: dateLocale })}
        {overdue && <AlertTriangle className="w-3 h-3" />}
      </span>
    );
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl" data-testid="postponed-tasks-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Hourglass className="w-5 h-5 text-project-purple" />
            {t('dashboard.postponedTasks', 'Отложени задачи')}
            {total > 0 && (
              <Badge variant="secondary" data-testid="postponed-tasks-count">
                {/* Динамичен текст — не минава през t(), за да не се загубят числата,
                    ако някога се добави статичен превод под този ключ. */}
                {total > LIMIT ? `Топ ${LIMIT} от ${total}` : String(total)}
              </Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <Select value={String(days)} onValueChange={changeDays}>
              <SelectTrigger
                data-testid="postponed-days-filter"
                className="h-8 text-xs flex-1 sm:w-[150px] sm:flex-none rounded-xl"
              >
                <Clock className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSTPONED_DAY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {`Над ${option} дни`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={projectFilterValue} onValueChange={setProjectId}>
              <SelectTrigger
                data-testid="postponed-project-filter"
                className="h-8 text-xs flex-1 sm:w-[170px] sm:flex-none rounded-xl"
              >
                <FolderKanban className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('dashboard.allProjects', 'Всички проекти')}
                </SelectItem>
                {projectOptions.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8">
            <Hourglass className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              {t('dashboard.noPostponedTasks', 'Няма отложени задачи 🎉')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((task) => (
              <button
                key={task.id}
                type="button"
                data-testid={`postponed-task-${task.id}`}
                onClick={() => navigate(taskPath({ id: task.project_id, name: task.project_name }, task))}
                className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors"
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    priorityColors[task.priority]
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm break-words line-clamp-1">{task.title}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">{task.project_name}</span>
                    <span className="text-xs text-project-purple font-medium">
                      {`стои от ${task.staleDays} дни`}
                    </span>
                    {renderDueDate(task.due_date)}
                    {statusLabels[task.status] && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {statusLabels[task.status]}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
