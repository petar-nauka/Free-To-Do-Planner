import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isAfter } from 'date-fns';
import { bg } from 'date-fns/locale';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
};

export function ProjectProgressChart() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [monthOffset, setMonthOffset] = useState(0);

  const currentMonth = useMemo(() => {
    const now = new Date();
    return monthOffset === 0 ? now : (monthOffset < 0 ? subMonths(now, Math.abs(monthOffset)) : addMonths(now, monthOffset));
  }, [monthOffset]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const isBg = i18n.language === 'bg';
  const monthLabel = format(currentMonth, 'LLLL yyyy', { locale: isBg ? bg : undefined });
  const isCurrentMonth = monthOffset === 0;

  // Fetch ALL tasks (no date filter in query - we filter client-side by month)
  const { data: allData, isLoading } = useQuery({
    queryKey: ['project-progress-all', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, color')
        .is('archived_at', null);

      if (!projects || projects.length === 0) return { projects: [], tasks: [] };

      const projectIds = projects.map(p => p.id);

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, project_id, status, archived_at, created_at')
        .in('project_id', projectIds);

      return { projects, tasks: tasks || [] };
    },
    enabled: !!user,
  });

  // Compute chart data for selected month
  const data = useMemo(() => {
    if (!allData || allData.projects.length === 0) return null;
    const { projects, tasks } = allData;

    // Per-project stats (for the selected month)
    const byProject = projects.map(p => {
      const projectTasks = tasks.filter(t => t.project_id === p.id);
      const createdInMonth = projectTasks.filter(t => {
        const d = new Date(t.created_at);
        return d >= monthStart && d <= monthEnd;
      }).length;
      const completedInMonth = projectTasks.filter(t => {
        if (!t.archived_at) return false;
        const d = new Date(t.archived_at);
        return d >= monthStart && d <= monthEnd;
      }).length;
      return {
        name: p.name.length > 12 ? p.name.substring(0, 12) + '…' : p.name,
        fullName: p.name,
        active: createdInMonth,
        completed: completedInMonth,
        total: createdInMonth + completedInMonth,
      };
    }).filter(p => p.total > 0);

    // Weekly trend within the month
    const byWeek: { week: string; created: number; completed: number }[] = [];
    const weekStart = new Date(monthStart);
    while (weekStart <= monthEnd) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const label = `${weekStart.getDate().toString().padStart(2, '0')}.${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`;

      const created = tasks.filter(t => {
        const d = new Date(t.created_at);
        return d >= weekStart && d < weekEnd && d >= monthStart && d <= monthEnd;
      }).length;
      const completed = tasks.filter(t => {
        if (!t.archived_at) return false;
        const d = new Date(t.archived_at);
        return d >= weekStart && d < weekEnd && d >= monthStart && d <= monthEnd;
      }).length;

      byWeek.push({ week: label, created, completed });
      weekStart.setDate(weekStart.getDate() + 7);
    }

    // Productivity - completed per day in the month
    const productivity: { day: string; completed: number }[] = [];
    const dayIter = new Date(monthStart);
    while (dayIter <= monthEnd) {
      const ds = dayIter.toISOString().split('T')[0];
      const dayLabel = `${dayIter.getDate()}`;
      const count = tasks.filter(t => t.archived_at && t.archived_at.split('T')[0] === ds).length;
      productivity.push({ day: dayLabel, completed: count });
      dayIter.setDate(dayIter.getDate() + 1);
    }

    return { byProject, byWeek, productivity };
  }, [allData, monthStart, monthEnd]);

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hasWeekly = data.byWeek?.some(w => w.created > 0 || w.completed > 0) ?? false;
  const hasProductivity = data.productivity?.some(p => p.completed > 0) ?? false;
  const hasAnyData = hasWeekly || data.byProject.length > 0 || hasProductivity;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            {t('dashboard.chartsTitle', 'Аналитика')}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonthOffset(o => o - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center capitalize">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isCurrentMonth} onClick={() => setMonthOffset(o => o + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasAnyData ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('common.noData')}</p>
        ) : (
          <Tabs defaultValue={hasWeekly ? 'weekly' : data.byProject.length > 0 ? 'projects' : 'productivity'}>
            <TabsList className="mb-3">
              {hasWeekly && <TabsTrigger value="weekly">{t('dashboard.tabWeekly', 'Седмичен тренд')}</TabsTrigger>}
              {data.byProject.length > 0 && <TabsTrigger value="projects">{t('dashboard.tabProjects', 'По проекти')}</TabsTrigger>}
              {hasProductivity && <TabsTrigger value="productivity">{t('dashboard.tabProductivity', 'Продуктивност')}</TabsTrigger>}
            </TabsList>

            {hasWeekly && (
              <TabsContent value="weekly">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.byWeek} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(var(--foreground))' }} />
                    <Bar dataKey="created" name={t('dashboard.created', 'Създадени')} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name={t('dashboard.completed', 'Завършени')} fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>
            )}

            {data.byProject.length > 0 && (
              <TabsContent value="projects">
                <ResponsiveContainer width="100%" height={Math.max(180, data.byProject.length * 36)}>
                  <BarChart data={data.byProject} layout="vertical" margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value, name]} />
                    <Bar dataKey="active" name={t('dashboard.active', 'Активни')} stackId="a" fill="hsl(var(--primary))" />
                    <Bar dataKey="completed" name={t('dashboard.completed', 'Завършени')} stackId="a" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>
            )}

            {hasProductivity && (
              <TabsContent value="productivity">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.productivity} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(var(--foreground))' }} />
                    <Line type="monotone" dataKey="completed" name={t('dashboard.completedPerDay', 'Завършени на ден')} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>
            )}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
