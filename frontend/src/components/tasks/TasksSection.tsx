import { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, Search, Filter, Archive, Group, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTasks, Task, TaskStatus, TaskPriority } from '@/hooks/useTasks';
import { TaskCard } from '@/components/tasks/TaskCard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { ArchiveDialog } from '@/components/tasks/ArchiveDialog';
import { TASK_COLORS, TaskColor } from '@/lib/taskColors';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface TasksSectionProps {
  projectId: string;
  /** Id на задачата, която адресът сочи, или null. */
  openTaskId?: string | null;
  /** Отваря/затваря задача чрез навигация; null затваря диалога. */
  onOpenTask?: (task: Task | null) => void;
  onOpenNote?: (noteId: string) => void;
  onOpenSpreadsheet?: (spreadsheetId: string) => void;
}

interface TagGroup {
  tag: string;
  color: string;
  tasks: Task[];
}

function groupTasksByTag(tasks: Task[]): TagGroup[] {
  const tagMap = new Map<string, { color: string; tasks: Task[] }>();
  const noTagTasks: Task[] = [];

  for (const task of tasks) {
    if (!task.task_tags || task.task_tags.length === 0) {
      noTagTasks.push(task);
    } else {
      // Group by first tag for simplicity
      for (const tag of task.task_tags) {
        const existing = tagMap.get(tag.name);
        if (existing) {
          existing.tasks.push(task);
        } else {
          tagMap.set(tag.name, { color: tag.color, tasks: [task] });
        }
      }
    }
  }

  const groups: TagGroup[] = [];
  tagMap.forEach((value, key) => {
    groups.push({ tag: key, color: value.color, tasks: value.tasks });
  });
  // Sort groups alphabetically
  groups.sort((a, b) => a.tag.localeCompare(b.tag));
  // Add "no tag" group at the end
  if (noTagTasks.length > 0) {
    groups.push({ tag: '__no_tag__', color: 'gray', tasks: noTagTasks });
  }

  return groups;
}

const tagColorMap: Record<string, string> = {
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  orange: 'bg-orange-500',
  gray: 'bg-muted-foreground',
};

export function TasksSection({ projectId, openTaskId, onOpenTask, onOpenNote, onOpenSpreadsheet }: TasksSectionProps) {
  const { t } = useTranslation();
  const { tasks, isLoading, reorderTasks } = useTasks(projectId);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority[]>([]);
  const [colorFilter, setColorFilter] = useState<TaskColor[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>('new');
  const [groupByTag, setGroupByTag] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const columns: { id: TaskStatus; title: string; color: string }[] = [
    { id: 'new', title: t('tasks.statusNew'), color: 'from-project-blue to-project-cyan' },
    { id: 'in_progress', title: t('tasks.statusInProgress'), color: 'from-project-amber to-project-orange' },
    { id: 'future', title: t('tasks.statusFuture'), color: 'from-project-purple to-project-pink' },
  ];

  // Filter out archived tasks
  const activeTasks = tasks.filter(task => !(task as any).archived_at);

  const filteredTasks = activeTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter.length === 0 || priorityFilter.includes(task.priority);
    const matchesColor = colorFilter.length === 0 || colorFilter.includes(task.color as TaskColor);
    return matchesSearch && matchesPriority && matchesColor;
  });

  const getTasksByStatus = (status: TaskStatus) => 
    filteredTasks
      .filter(task => task.status === status)
      .sort((a, b) => a.position - b.position);

  const toggleGroupCollapse = (columnId: string, tagName: string) => {
    const key = `${columnId}:${tagName}`;
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceStatus = result.source.droppableId as TaskStatus;
    const destStatus = result.destination.droppableId as TaskStatus;
    const taskId = result.draggableId;

    const sourceTasks = getTasksByStatus(sourceStatus);
    const destTasks = sourceStatus === destStatus 
      ? sourceTasks 
      : getTasksByStatus(destStatus);

    const [movedTask] = sourceTasks.splice(result.source.index, 1);
    
    if (sourceStatus === destStatus) {
      sourceTasks.splice(result.destination.index, 0, movedTask);
      
      const updates = sourceTasks.map((task, index) => ({
        id: task.id,
        status: sourceStatus,
        position: index,
      }));
      
      reorderTasks.mutate(updates);
    } else {
      destTasks.splice(result.destination.index, 0, movedTask);
      
      const sourceUpdates = sourceTasks.map((task, index) => ({
        id: task.id,
        status: sourceStatus,
        position: index,
      }));
      
      const destUpdates = destTasks.map((task, index) => ({
        id: task.id === taskId ? taskId : task.id,
        status: destStatus,
        position: index,
      }));
      
      reorderTasks.mutate([...sourceUpdates, ...destUpdates]);
    }
  };

  const openCreateDialog = (status: TaskStatus) => {
    setCreateStatus(status);
    setCreateDialogOpen(true);
  };

  const togglePriorityFilter = (priority: TaskPriority) => {
    setPriorityFilter(prev => 
      prev.includes(priority) 
        ? prev.filter(p => p !== priority)
        : [...prev, priority]
    );
  };

  const toggleColorFilter = (color: TaskColor) => {
    setColorFilter(prev =>
      prev.includes(color)
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };

  const renderGroupedTasks = (columnId: TaskStatus, columnTasks: Task[]) => {
    const groups = groupTasksByTag(columnTasks);

    return (
      <div className="space-y-2">
        {groups.map((group) => {
          const key = `${columnId}:${group.tag}`;
          const isCollapsed = collapsedGroups.has(key);
          const isNoTag = group.tag === '__no_tag__';
          const colorClass = tagColorMap[group.color] || 'bg-muted-foreground';

          return (
            <div key={group.tag} className="space-y-1">
              <button
                onClick={() => toggleGroupCollapse(columnId, group.tag)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-muted/70 transition-colors text-sm"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                {isNoTag ? (
                  <span className="text-muted-foreground italic text-xs">{t('tasks.noTag', 'Без етикет')}</span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", colorClass)} />
                    <span className="font-medium text-foreground text-xs">{group.tag}</span>
                  </div>
                )}
                <span className="text-muted-foreground text-xs ml-auto">{group.tasks.length}</span>
              </button>
              {!isCollapsed && (
                <div className="space-y-2 pl-1">
                  {group.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isDragging={false}
                      isDetailOpen={openTaskId === task.id}
                      onDetailOpenChange={(open) => onOpenTask?.(open ? task : null)}
                      onOpenNote={onOpenNote}
                      onOpenSpreadsheet={onOpenSpreadsheet}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {columns.map(column => (
            <div 
              key={column.id} 
              className="flex-1 min-w-[280px] max-w-[400px] flex flex-col bg-card rounded-2xl border border-border overflow-hidden"
            >
              {/* Column Header */}
              <div className={cn(
                "px-4 py-3 bg-gradient-to-r text-primary-foreground flex items-center justify-between",
                column.color
              )}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{column.title}</span>
                  <span className="w-6 h-6 rounded-full bg-primary-foreground/20 text-sm flex items-center justify-center">
                    {getTasksByStatus(column.id).length}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 rounded-lg hover:bg-primary-foreground/20 text-primary-foreground"
                  onClick={() => openCreateDialog(column.id)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Tasks */}
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex-1 p-3 space-y-2 overflow-y-auto transition-colors",
                      snapshot.isDraggingOver && "bg-muted/50"
                    )}
                  >
                    {isLoading ? (
                      <div className="space-y-2">
                        {[1, 2].map(i => (
                          <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
                        ))}
                      </div>
                    ) : groupByTag ? (
                      renderGroupedTasks(column.id, getTasksByStatus(column.id))
                    ) : (
                      getTasksByStatus(column.id).map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <TaskCard
                                task={task}
                                isDragging={snapshot.isDragging}
                                isDetailOpen={openTaskId === task.id}
                                onDetailOpenChange={(open) => onOpenTask?.(open ? task : null)}
                                onOpenNote={onOpenNote}
                                onOpenSpreadsheet={onOpenSpreadsheet}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Controls - Below Kanban */}
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('tasks.searchTasks')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl bg-muted/50 border-0"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="rounded-xl">
              <Filter className="w-4 h-4 mr-2" />
              {t('common.filter')}
              {priorityFilter.length + colorFilter.length > 0 && (
                <span className="ml-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {priorityFilter.length + colorFilter.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="rounded-xl">
            <DropdownMenuLabel>{t('tasks.priority')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={priorityFilter.includes('high')}
              onCheckedChange={() => togglePriorityFilter('high')}
              className="rounded-lg"
            >
              <span className="w-2 h-2 rounded-full bg-priority-high mr-2" />
              {t('tasks.priorityHigh')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={priorityFilter.includes('medium')}
              onCheckedChange={() => togglePriorityFilter('medium')}
              className="rounded-lg"
            >
              <span className="w-2 h-2 rounded-full bg-priority-medium mr-2" />
              {t('tasks.priorityMedium')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={priorityFilter.includes('low')}
              onCheckedChange={() => togglePriorityFilter('low')}
              className="rounded-lg"
            >
              <span className="w-2 h-2 rounded-full bg-priority-low mr-2" />
              {t('tasks.priorityLow')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('tasks.color', 'Цвят')}</DropdownMenuLabel>
            {TASK_COLORS.map(color => (
              <DropdownMenuCheckboxItem
                key={color.key}
                checked={colorFilter.includes(color.key)}
                onCheckedChange={() => toggleColorFilter(color.key)}
                className="rounded-lg"
              >
                <span className={cn('w-3 h-3 rounded-full border border-border mr-2', color.className)} />
                {color.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          variant={groupByTag ? "default" : "outline"} 
          className="rounded-xl"
          onClick={() => setGroupByTag(!groupByTag)}
        >
          <Tag className="w-4 h-4 mr-2" />
          {t('tasks.groupByTag', 'Групиране')}
        </Button>

        <Button 
          variant="outline" 
          className="rounded-xl"
          onClick={() => setArchiveDialogOpen(true)}
        >
          <Archive className="w-4 h-4 mr-2" />
          {t('tasks.archive')}
        </Button>
      </div>

      <CreateTaskDialog
        projectId={projectId}
        status={createStatus}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <ArchiveDialog
        projectId={projectId}
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
      />
    </div>
  );
}
