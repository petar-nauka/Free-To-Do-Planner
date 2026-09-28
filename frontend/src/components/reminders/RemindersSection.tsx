import { useState } from 'react';
import { format, Locale } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';
import { Bell, Plus, Trash2, Mail, Calendar, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useReminders, Reminder } from '@/hooks/useReminders';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

interface RemindersSectionProps {
  projectId: string;
}

export function RemindersSection({ projectId }: RemindersSectionProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { reminders, isLoading, createReminder, deleteReminder } = useReminders(projectId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reminderDate: '',
    reminderTime: '09:00',
    reminderEmail: user?.email || '',
  });

  const dateLocale = i18n.language === 'bg' ? bg : enUS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const reminderDateTime = new Date(`${formData.reminderDate}T${formData.reminderTime}`);
    
    await createReminder.mutateAsync({
      projectId,
      title: formData.title,
      description: formData.description,
      reminderDate: reminderDateTime.toISOString(),
      reminderEmail: formData.reminderEmail,
    });

    setFormData({
      title: '',
      description: '',
      reminderDate: '',
      reminderTime: '09:00',
      reminderEmail: user?.email || '',
    });
    setIsDialogOpen(false);
  };

  const pendingReminders = reminders.filter(r => !r.is_sent);
  const sentReminders = reminders.filter(r => r.is_sent);

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
          <Bell className="w-5 h-5" />
          {t('reminders.title')}
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
              <DialogTitle>{t('reminders.newReminder')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('common.title')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={t('reminders.whatToRemind')}
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('reminders.reminderDescription')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('reminders.additionalDetails')}
                  className="rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">{t('common.date')}</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.reminderDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, reminderDate: e.target.value }))}
                    required
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">{t('common.time')}</Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.reminderTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, reminderTime: e.target.value }))}
                    required
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('reminders.sendToEmail')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.reminderEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, reminderEmail: e.target.value }))}
                  placeholder="email@example.com"
                  required
                  className="rounded-xl"
                />
              </div>

              <Button type="submit" className="w-full rounded-xl" disabled={createReminder.isPending}>
                {createReminder.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4 mr-2" />
                )}
                {t('reminders.createReminder')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingReminders.length === 0 && sentReminders.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            {t('reminders.noReminders')}
          </p>
        ) : (
          <>
            {pendingReminders.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">{t('reminders.upcoming')}</h4>
                {pendingReminders.map((reminder) => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    onDelete={() => deleteReminder.mutate(reminder.id)}
                    dateLocale={dateLocale}
                  />
                ))}
              </div>
            )}

            {sentReminders.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">{t('reminders.sent')}</h4>
                {sentReminders.slice(0, 5).map((reminder) => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    onDelete={() => deleteReminder.mutate(reminder.id)}
                    dateLocale={dateLocale}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ReminderCard({ reminder, onDelete, dateLocale }: { reminder: Reminder; onDelete: () => void; dateLocale: Locale }) {
  const { t } = useTranslation();
  const reminderDate = new Date(reminder.reminder_date);
  const isPast = reminderDate < new Date();

  return (
    <div className={`p-3 rounded-xl border ${reminder.is_sent ? 'bg-muted/50' : 'bg-card'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${reminder.is_sent ? 'line-through text-muted-foreground' : ''}`}>
            {reminder.title}
          </p>
          {reminder.description && (
            <p className="text-sm text-muted-foreground truncate">{reminder.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(reminderDate, 'dd MMM yyyy', { locale: dateLocale })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(reminderDate, 'HH:mm')}
            </span>
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {reminder.reminder_email}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reminder.is_sent ? (
            <Badge variant="secondary" className="text-xs">{t('reminders.sent')}</Badge>
          ) : isPast ? (
            <Badge variant="destructive" className="text-xs">{t('reminders.late')}</Badge>
          ) : (
            <Badge className="text-xs">{t('reminders.pending')}</Badge>
          )}
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