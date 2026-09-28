import { useState } from 'react';
import { RefreshCw, Plus, Trash2, Mail, Clock, Loader2, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useRecurringTasks, RecurringTask, RecurrenceType } from '@/hooks/useRecurringTasks';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

interface RecurringSectionProps {
  projectId: string;
}

export function RecurringSection({ projectId }: RecurringSectionProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { recurringTasks, isLoading, createRecurringTask, deleteRecurringTask, toggleActive } = useRecurringTasks(projectId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    recurrenceType: 'weekly' as RecurrenceType,
    dayOfWeek: '1',
    dayOfMonth: '1',
    timeOfDay: '09:00',
    notificationEmail: user?.email || '',
  });

  const daysOptions = [
    { value: '0', label: t('recurring.sunday') },
    { value: '1', label: t('recurring.monday') },
    { value: '2', label: t('recurring.tuesday') },
    { value: '3', label: t('recurring.wednesday') },
    { value: '4', label: t('recurring.thursday') },
    { value: '5', label: t('recurring.friday') },
    { value: '6', label: t('recurring.saturday') },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createRecurringTask.mutateAsync({
      projectId,
      title: formData.title,
      description: formData.description,
      recurrenceType: formData.recurrenceType,
      dayOfWeek: formData.recurrenceType === 'weekly' ? parseInt(formData.dayOfWeek) : null,
      dayOfMonth: formData.recurrenceType === 'monthly' ? parseInt(formData.dayOfMonth) : null,
      timeOfDay: formData.timeOfDay,
      notificationEmail: formData.notificationEmail,
    });

    setFormData({
      title: '',
      description: '',
      recurrenceType: 'weekly',
      dayOfWeek: '1',
      dayOfMonth: '1',
      timeOfDay: '09:00',
      notificationEmail: user?.email || '',
    });
    setIsDialogOpen(false);
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          {t('recurring.recurringShort')}
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl">
              <Plus className="w-4 h-4 mr-1" />
              {t('common.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>{t('recurring.newRecurring')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('common.title')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={t('recurring.whatShouldHappen')}
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('projects.descriptionOptional')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('reminders.additionalDetails')}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('recurring.recurrence')}</Label>
                <Select
                  value={formData.recurrenceType}
                  onValueChange={(value: RecurrenceType) => setFormData(prev => ({ ...prev, recurrenceType: value }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t('recurring.daily')}</SelectItem>
                    <SelectItem value="weekly">{t('recurring.weekly')}</SelectItem>
                    <SelectItem value="monthly">{t('recurring.monthly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.recurrenceType === 'weekly' && (
                <div className="space-y-2">
                  <Label>{t('recurring.dayOfWeek')}</Label>
                  <Select
                    value={formData.dayOfWeek}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, dayOfWeek: value }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {daysOptions.map(day => (
                        <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.recurrenceType === 'monthly' && (
                <div className="space-y-2">
                  <Label>{t('recurring.dayOfMonth')}</Label>
                  <Select
                    value={formData.dayOfMonth}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, dayOfMonth: value }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="time">{t('common.time')}</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.timeOfDay}
                  onChange={(e) => setFormData(prev => ({ ...prev, timeOfDay: e.target.value }))}
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('recurring.sendNotificationTo')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.notificationEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, notificationEmail: e.target.value }))}
                  placeholder="email@example.com"
                  required
                  className="rounded-xl"
                />
              </div>

              <Button type="submit" className="w-full rounded-xl" disabled={createRecurringTask.isPending}>
                {createRecurringTask.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {t('common.create')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {recurringTasks.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            {t('recurring.noRecurring')}
          </p>
        ) : (
          recurringTasks.map((task) => (
            <RecurringTaskCard
              key={task.id}
              task={task}
              onDelete={() => deleteRecurringTask.mutate(task.id)}
              onToggle={() => toggleActive.mutate({ id: task.id, isActive: !task.is_active })}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function RecurringTaskCard({ 
  task, 
  onDelete, 
  onToggle 
}: { 
  task: RecurringTask; 
  onDelete: () => void; 
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  const getDayName = (dayNum: number | null) => {
    if (dayNum === null) return '';
    const days = [
      t('recurring.sunday'),
      t('recurring.monday'),
      t('recurring.tuesday'),
      t('recurring.wednesday'),
      t('recurring.thursday'),
      t('recurring.friday'),
      t('recurring.saturday'),
    ];
    return days[dayNum] || '';
  };

  const getRecurrenceLabel = (type: RecurrenceType) => {
    switch (type) {
      case 'daily': return t('recurring.daily');
      case 'weekly': return t('recurring.weekly');
      case 'monthly': return t('recurring.monthly');
      default: return type;
    }
  };

  const getScheduleText = () => {
    const time = task.time_of_day.slice(0, 5);
    if (task.recurrence_type === 'daily') {
      return t('recurring.everyDayAt', { time });
    }
    if (task.recurrence_type === 'weekly') {
      return t('recurring.everyWeekdayAt', { day: getDayName(task.day_of_week), time });
    }
    if (task.recurrence_type === 'monthly') {
      return t('recurring.everyMonthDayAt', { day: task.day_of_month, time });
    }
    return '';
  };

  return (
    <div className={`p-3 rounded-xl border ${task.is_active ? 'bg-card' : 'bg-muted/50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${!task.is_active ? 'text-muted-foreground' : ''}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-sm text-muted-foreground truncate">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {getScheduleText()}
            </span>
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {task.notification_email}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant={task.is_active ? 'default' : 'secondary'} className="text-xs">
            {getRecurrenceLabel(task.recurrence_type as RecurrenceType)}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggle}
          >
            {task.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}