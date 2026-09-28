import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, ArrowUpDown, Calendar, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAllTasks } from '@/hooks/useAllTasks';
import { cn } from '@/lib/utils';
import { format, isPast, isToday, parseISO } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';
import i18n from '@/i18n';

type SortBy = 'priority' | 'dueDateAsc' | 'dueDateDesc' | 'createdDesc';
type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

const priorityColors: Record<string, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

const priorityWeight: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function GlobalPriorityTasksCard() {
  const { t } = useTranslation();
  const dateLocale = i18n.language === 'bg' ? bg : enUS;
  const [sortBy, setSortBy] = useState<SortBy>('dueDateAsc');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('high');
  const { data: allTasks = [], isLoading } = useAllTasks();

  const filteredAndSorted = useMemo(() => {
    // useAllTasks вече връща само неархивирани (= незавършени) задачи.
    let list = allTasks;

    if (priorityFilter !== 'all') {
      list = list.filter(t => t.priority === priorityFilter);
    }

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        case 'dueDateAsc': {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        }
        case 'dueDateDesc': {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return b.due_date.localeCompare(a.due_date);
        }
        case 'createdDesc':
          return (b.created_at || '').localeCompare(a.created_at || '');
        default:
          return 0;
      }
    });

    return list.slice(0, 30);
  }, [allTasks, sortBy, priorityFilter]);

  const renderDueDate = (dueDate?: string | null) => {
    if (!dueDate) return null;
    const date = parseISO(dueDate);
    const overdue = isPast(date) && !isToday(date);
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-xs',
          overdue ? 'text-red-500 font-medium' : isToday(date) ? 'text-amber-500 font-medium' : 'text-muted-foreground'
        )}
      >
        <Calendar className="w-3 h-3" />
        {format(date, 'd MMM', { locale: dateLocale })}
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
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl" data-testid="global-priority-tasks-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            {t('dashboard.globalPriorityTasks', 'Глобални приоритетни задачи')}
            {filteredAndSorted.length > 0 && (
              <Badge variant="secondary">{filteredAndSorted.length}</Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}>
              <SelectTrigger data-testid="global-priority-filter" className="h-8 text-xs flex-1 sm:w-[140px] sm:flex-none rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('dashboard.allPriorities', 'Всички приоритети')}</SelectItem>
                <SelectItem value="high">🔴 {t('dashboard.priorityHigh', 'Висок')}</SelectItem>
                <SelectItem value="medium">🟡 {t('dashboard.priorityMedium', 'Среден')}</SelectItem>
                <SelectItem value="low">🔵 {t('dashboard.priorityLow', 'Нисък')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger data-testid="global-priority-sort" className="h-8 text-xs flex-1 sm:w-[170px] sm:flex-none rounded-xl">
                <ArrowUpDown className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dueDateAsc">{t('dashboard.sortDueAsc', 'Срок (възх.)')}</SelectItem>
                <SelectItem value="dueDateDesc">{t('dashboard.sortDueDesc', 'Срок (низх.)')}</SelectItem>
                <SelectItem value="priority">{t('dashboard.sortPriority', 'По приоритет')}</SelectItem>
                <SelectItem value="createdDesc">{t('dashboard.sortCreatedDesc', 'Най-нови')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredAndSorted.length === 0 ? (
          <div className="text-center py-8">
            <Flame className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              {t('dashboard.noGlobalPriorityTasks', 'Няма активни задачи с този филтър')}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[360px] pr-2">
            <div className="space-y-2">
              {filteredAndSorted.map(task => (
                <div
                  key={task.id}
                  data-testid={`global-priority-task-${task.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors"
                >
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', priorityColors[task.priority])} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm break-words line-clamp-1">{task.title}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{task.project_name}</span>
                      {renderDueDate(task.due_date)}
                      {task.status && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {task.status === 'new' && 'Нова'}
                          {task.status === 'in_progress' && 'В процес'}
                          {task.status === 'future' && 'На изчакване'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
