import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useTaskStats } from '@/hooks/useTaskStats';
import { useIsMobile } from '@/hooks/use-mobile';
import { DayTasksDialog } from './DayTasksDialog';
import i18n from '@/i18n';

type ViewMode = 'week' | 'month';

export function TaskCalendar() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'week' : 'week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const { data: stats, isLoading } = useTaskStats();

  // Force week view on mobile
  const effectiveViewMode: ViewMode = isMobile ? 'week' : viewMode;

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    setDayDialogOpen(true);
  };

  const locale = i18n.language === 'bg' ? bg : enUS;

  const days = useMemo(() => {
    if (effectiveViewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const monthDays = eachDayOfInterval({ start, end });
      
      // Add days from previous month to fill the first week
      const firstDayOfMonth = start.getDay();
      const daysFromPrevMonth = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
      const prevMonthDays: Date[] = [];
      for (let i = daysFromPrevMonth; i > 0; i--) {
        const d = new Date(start);
        d.setDate(d.getDate() - i);
        prevMonthDays.push(d);
      }
      
      // Add days from next month to fill the last week
      const lastDayOfMonth = end.getDay();
      const daysFromNextMonth = lastDayOfMonth === 0 ? 0 : 7 - lastDayOfMonth;
      const nextMonthDays: Date[] = [];
      for (let i = 1; i <= daysFromNextMonth; i++) {
        const d = new Date(end);
        d.setDate(d.getDate() + i);
        nextMonthDays.push(d);
      }
      
      return [...prevMonthDays, ...monthDays, ...nextMonthDays];
    }
  }, [effectiveViewMode, currentDate]);

  const getTasksForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayData = stats?.tasksByDate.find(d => d.date === dateStr);
    return dayData || { pending: 0, completed: 0 };
  };

  const navigatePrev = () => {
    const newDate = new Date(currentDate);
    if (effectiveViewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (effectiveViewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const weekDays = [
    t('recurring.monday'),
    t('recurring.tuesday'),
    t('recurring.wednesday'),
    t('recurring.thursday'),
    t('recurring.friday'),
    t('recurring.saturday'),
    t('recurring.sunday'),
  ];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            {t('dashboard.calendar')}
          </CardTitle>
          <div className="flex items-center gap-2">
            {!isMobile && (
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <TabsList className="rounded-xl">
                  <TabsTrigger value="week" className="rounded-lg text-sm">
                    {t('dashboard.week')}
                  </TabsTrigger>
                  <TabsTrigger value="month" className="rounded-lg text-sm">
                    {t('dashboard.month')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navigatePrev} className="rounded-xl h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={navigateNext} className="rounded-xl h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday} className="rounded-xl">
              {t('dashboard.today')}
            </Button>
          </div>
          <span className="font-medium text-sm sm:text-base truncate">
            {format(currentDate, 'MMMM yyyy', { locale })}
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="px-2 sm:px-6">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-2">
          {weekDays.map((day, index) => (
            <div key={index} className="text-center text-[10px] sm:text-xs font-medium text-muted-foreground py-1 sm:py-2">
              {day.slice(0, isMobile ? 1 : 3)}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className={cn(
          "grid grid-cols-7 gap-0.5 sm:gap-1",
          effectiveViewMode === 'month' && "auto-rows-fr"
        )}>
          {days.map((day, index) => {
            const tasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isDayToday = isToday(day);
            
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleDayClick(day)}
                data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                className={cn(
                  "min-h-[48px] sm:min-h-[60px] p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-border/50 transition-all text-left cursor-pointer active:scale-95",
                  !isCurrentMonth && effectiveViewMode === 'month' && "opacity-40",
                  isDayToday && "bg-primary/10 border-primary/50",
                  "hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                )}
              >
                <div className={cn(
                  "text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 text-center sm:text-left",
                  isDayToday && "text-primary"
                )}>
                  {format(day, 'd')}
                </div>
                
                {(tasks.pending > 0 || tasks.completed > 0) && (
                  <>
                    {/* Mobile: compact dots only */}
                    <div className="flex justify-center gap-0.5 sm:hidden">
                      {tasks.pending > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title={`${tasks.pending} pending`} />
                      )}
                      {tasks.completed > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={`${tasks.completed} completed`} />
                      )}
                    </div>
                    {/* Desktop: icon + count */}
                    <div className="hidden sm:block space-y-0.5">
                      {tasks.pending > 0 && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <Clock className="w-3 h-3" />
                          <span>{tasks.pending}</span>
                        </div>
                      )}
                      {tasks.completed > 0 && (
                        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="w-3 h-3" />
                          <span>{tasks.completed}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>{t('dashboard.pendingTasks')}</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>{t('dashboard.completedTasks')}</span>
          </div>
        </div>
      </CardContent>

      <DayTasksDialog
        open={dayDialogOpen}
        onOpenChange={setDayDialogOpen}
        date={selectedDay}
      />
    </Card>
  );
}
