import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderKanban, CheckCircle, Clock, LayoutList, AlertTriangle, CalendarCheck, Timer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTaskStats } from '@/hooks/useTaskStats';
import { useWeeklyTrackedTime, formatDuration } from '@/hooks/useTimeTracking';
import { Skeleton } from '@/components/ui/skeleton';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const duration = 600;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= value) { setDisplay(value); clearInterval(interval); }
      else setDisplay(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(interval);
  }, [value]);
  return <>{display}</>;
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <div className="h-8 w-20 opacity-60">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#spark-${color})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TaskStatsCard() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useTaskStats();
  const { data: weeklySeconds = 0 } = useWeeklyTrackedTime();

  const statItems = [
    {
      icon: Clock,
      label: t('dashboard.pendingTasks'),
      value: stats?.pendingTasks ?? 0,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      sparkColor: '#d97706',
      sparkData: stats?.sparklines?.pending,
      displayValue: undefined,
    },
    {
      icon: AlertTriangle,
      label: t('dashboard.overdueTasks'),
      value: stats?.overdueTasks ?? 0,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      sparkColor: '#dc2626',
      sparkData: stats?.sparklines?.overdue,
      displayValue: undefined,
    },
    {
      icon: CalendarCheck,
      label: t('dashboard.tasksForToday'),
      value: stats?.tasksForToday ?? 0,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
      sparkColor: '#0891b2',
      sparkData: undefined,
      displayValue: undefined,
    },
    {
      icon: CheckCircle,
      label: t('dashboard.completedTasks'),
      value: stats?.completedTasks ?? 0,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      sparkColor: '#059669',
      sparkData: stats?.sparklines?.completed,
      displayValue: undefined,
    },
    {
      icon: FolderKanban,
      label: t('dashboard.projectsWithTasks'),
      value: stats?.projectsWithTasks ?? 0,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      sparkColor: '#2563eb',
      sparkData: undefined,
      displayValue: undefined,
    },
    {
      icon: LayoutList,
      label: t('dashboard.totalProjects'),
      value: stats?.totalProjects ?? 0,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      sparkColor: '#7c3aed',
      sparkData: undefined,
      displayValue: undefined,
    },
    {
      icon: Timer,
      label: t('timeTracking.thisWeek', 'Изхарчено тази седмица'),
      value: 0,
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-100 dark:bg-teal-900/30',
      sparkColor: '#0d9488',
      sparkData: undefined,
      displayValue: formatDuration(weeklySeconds),
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="rounded-2xl">
            <CardContent className="p-3">
              <Skeleton className="h-8 w-8 rounded-lg mb-2" />
              <Skeleton className="h-6 w-12 mb-1" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
      {statItems.map((item, index) => (
        <Card key={index} className="rounded-2xl hover:shadow-md transition-shadow">
          <CardContent className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className={`w-8 h-8 rounded-lg ${item.bgColor} flex items-center justify-center`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              {item.sparkData && <MiniSparkline data={item.sparkData} color={item.sparkColor} />}
            </div>
            <div className="text-2xl font-bold">
              {item.displayValue ?? <AnimatedNumber value={item.value} />}
            </div>
            <div className="text-xs text-muted-foreground truncate">{item.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
