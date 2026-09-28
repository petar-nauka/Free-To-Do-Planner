import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { useTasks, TaskStatus, TaskPriority } from '@/hooks/useTasks';
import { useSpreadsheets } from '@/hooks/useSpreadsheets';
import { useTranslation } from 'react-i18next';
import { CalendarIcon, X, Plus, Table2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { TAG_COLORS } from '@/lib/constants';

interface CreateTaskDialogProps {
  projectId: string;
  status: TaskStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Tag {
  name: string;
  color: string;
}

export function CreateTaskDialog({ projectId, status, open, onOpenChange }: CreateTaskDialogProps) {
  const { t } = useTranslation();
  const { createTask } = useTasks(projectId);
  const { spreadsheets } = useSpreadsheets(projectId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [selectedTagColor, setSelectedTagColor] = useState<string>(TAG_COLORS[0].name);

  const handleAddTag = () => {
    if (newTagName.trim() && !tags.find(t => t.name === newTagName.trim())) {
      setTags([...tags, { name: newTagName.trim(), color: selectedTagColor }]);
      setNewTagName('');
    }
  };

  const handleRemoveTag = (tagName: string) => {
    setTags(tags.filter(t => t.name !== tagName));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await createTask.mutateAsync({
      projectId,
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
      spreadsheetId: (selectedSpreadsheetId && selectedSpreadsheetId !== 'none') ? selectedSpreadsheetId : undefined,
      tags: tags.length > 0 ? tags : undefined,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate(undefined);
    setSelectedSpreadsheetId('');
    setTags([]);
    setNewTagName('');
    onOpenChange(false);
  };

  const getTagColorClass = (colorName: string) => {
    return TAG_COLORS.find(c => c.name === colorName)?.class || TAG_COLORS[0].class;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{t('tasks.createTask')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="task-title">{t('common.title')}</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('tasks.whatNeedsDone')}
              className="rounded-xl"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="task-description">{t('projects.descriptionOptional')}</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('tasks.addDetails')}
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>

          {/* Priority & Due Date row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
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

            {/* Due Date */}
            <div className="space-y-2">
              <Label>{t('tasks.dueDate')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-xl",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : t('tasks.selectDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Spreadsheet link */}
          {spreadsheets.length > 0 && (
            <div className="space-y-2">
              <Label>{t('spreadsheets.linkToTask', 'Свързана таблица')}</Label>
              <Select value={selectedSpreadsheetId} onValueChange={setSelectedSpreadsheetId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={t('spreadsheets.selectSheet', 'Избери таблица (по желание)')} />
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
            
            {/* Existing tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag.name}
                    variant="secondary"
                    className={cn("rounded-full px-3 py-1", getTagColorClass(tag.color))}
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag.name)}
                      className="ml-1 hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add new tag */}
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder={t('tasks.addTag')}
                className="rounded-xl flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl w-10 p-0"
                  >
                    <span className={cn("w-4 h-4 rounded-full", getTagColorClass(selectedTagColor))} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2 rounded-xl" align="end">
                  <div className="flex gap-1 flex-wrap max-w-[200px]">
                    {TAG_COLORS.map(({ name, class: colorClass }) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setSelectedTagColor(name)}
                        className={cn(
                          "w-6 h-6 rounded-md transition-transform hover:scale-110",
                          colorClass,
                          selectedTagColor === name && "ring-2 ring-primary ring-offset-2"
                        )}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
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

          <DialogFooter className="gap-2 sm:gap-0">
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
              disabled={!title.trim() || createTask.isPending}
              className="rounded-xl bg-gradient-to-r from-primary to-secondary"
            >
              {createTask.isPending ? t('common.creating') : t('tasks.createTask')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
