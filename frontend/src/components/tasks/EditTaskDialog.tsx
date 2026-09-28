import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Table2 } from 'lucide-react';
import { useTasks, Task, TaskStatus, TaskPriority } from '@/hooks/useTasks';
import { useSpreadsheets } from '@/hooks/useSpreadsheets';
import { AttachmentsSection } from '@/components/attachments/AttachmentsSection';
import { TaskCommentsSection } from '@/components/tasks/TaskCommentsSection';
import { PROJECT_COLORS, ProjectColor } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface EditTaskDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTaskDialog({ task, open, onOpenChange }: EditTaskDialogProps) {
  const { t } = useTranslation();
  const { updateTask, addTag, removeTag } = useTasks(task.project_id);
  const { spreadsheets } = useSpreadsheets(task.project_id);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState(task.spreadsheet_id || '');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<ProjectColor>('blue');

  useEffect(() => {
    if (open) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setStatus(task.status);
      setDueDate(task.due_date || '');
      setSelectedSpreadsheetId(task.spreadsheet_id || '');
    }
  }, [open, task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await updateTask.mutateAsync({
      id: task.id,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      due_date: dueDate || null,
      spreadsheet_id: (selectedSpreadsheetId && selectedSpreadsheetId !== 'none') ? selectedSpreadsheetId : null,
    });

    onOpenChange(false);
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    
    await addTag.mutateAsync({
      taskId: task.id,
      name: newTagName.trim(),
      color: newTagColor,
    });

    setNewTagName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{t('tasks.editTask')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-task-title">{t('common.title')}</Label>
            <Input
              id="edit-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('tasks.whatNeedsDone')}
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-task-description">{t('common.description')}</Label>
            <Textarea
              id="edit-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('tasks.addDetails')}
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('tasks.priority')}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="low" className="rounded-lg">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-priority-low" />
                      {t('tasks.priorityLow')}
                    </span>
                  </SelectItem>
                  <SelectItem value="medium" className="rounded-lg">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-priority-medium" />
                      {t('tasks.priorityMedium')}
                    </span>
                  </SelectItem>
                  <SelectItem value="high" className="rounded-lg">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-priority-high" />
                      {t('tasks.priorityHigh')}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('common.status')}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="new" className="rounded-lg">{t('tasks.statusNew')}</SelectItem>
                  <SelectItem value="in_progress" className="rounded-lg">{t('tasks.statusInProgress')}</SelectItem>
                  <SelectItem value="future" className="rounded-lg">{t('tasks.statusFuture')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-task-due">{t('tasks.dueDate')}</Label>
            <Input
              id="edit-task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Spreadsheet link */}
          {spreadsheets.length > 0 && (
            <div className="space-y-2">
              <Label>{t('spreadsheets.linkToTask', 'Свързана таблица')}</Label>
              <Select value={selectedSpreadsheetId || 'none'} onValueChange={setSelectedSpreadsheetId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={t('spreadsheets.selectSheet', 'Избери таблица')} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="none" className="rounded-lg">
                    {t('common.none', 'Без')}
                  </SelectItem>
                  {spreadsheets.map((sheet) => (
                    <SelectItem key={sheet.id} value={sheet.id} className="rounded-lg">
                      <span className="flex items-center gap-2">
                        <Table2 className="w-3.5 h-3.5" />
                        {sheet.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <Label>{t('tasks.tags')}</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {task.task_tags?.map(tag => (
                <Badge 
                  key={tag.id}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => removeTag.mutate(tag.id)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder={t('tasks.newTag')}
                className="rounded-xl flex-1"
              />
              <Select value={newTagColor} onValueChange={(v) => setNewTagColor(v as ProjectColor)}>
                <SelectTrigger className="w-24 rounded-xl">
                  <div className={cn("w-4 h-4 rounded-full", `bg-project-${newTagColor}`)} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {PROJECT_COLORS.map(({ name }) => (
                    <SelectItem key={name} value={name} className="rounded-lg">
                      <div className={cn("w-4 h-4 rounded-full", `bg-project-${name}`)} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddTag}
                className="rounded-xl"
                disabled={!newTagName.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Attachments */}
          <AttachmentsSection projectId={task.project_id} taskId={task.id} />

          {/* Comments */}
          <TaskCommentsSection taskId={task.id} />

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              {t('common.cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={!title.trim() || updateTask.isPending}
              className="rounded-xl bg-gradient-to-r from-primary to-secondary"
            >
              {updateTask.isPending ? t('common.saving') : t('tasks.saveChanges')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}