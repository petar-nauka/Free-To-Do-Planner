import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Plus, X, GripVertical, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePriorityTasks } from '@/hooks/usePriorityTasks';
import { useAllTasks, TaskWithProject } from '@/hooks/useAllTasks';
import { useProjects } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const priorityColors: Record<string, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

export function PriorityTasksCard() {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  
  const { priorityTasks, isLoading: loadingPriority, addPriorityTask, removePriorityTask, toggleCompleted, reorderPriorityTasks } = usePriorityTasks();
  const { data: allTasks = [], isLoading: loadingTasks } = useAllTasks();
  const { projects } = useProjects();

  // Get task details for priority tasks
  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  const priorityTasksWithDetails = priorityTasks
    .map(pt => ({
      ...pt,
      task: taskMap.get(pt.task_id),
    }))
    .filter(pt => pt.task); // Filter out tasks that no longer exist

  // Available tasks (not already in priority list)
  const availableTasks = allTasks.filter(
    task => !priorityTasks.some(pt => pt.task_id === task.id)
  );

  // Filtered available tasks by selected project
  const filteredAvailableTasks = useMemo(() => {
    if (selectedProjectFilter === 'all') return availableTasks;
    return availableTasks.filter(task => task.project_id === selectedProjectFilter);
  }, [availableTasks, selectedProjectFilter]);

  const handleAddTask = async (taskId: string) => {
    await addPriorityTask.mutateAsync(taskId);
  };

  const handleRemoveTask = async (priorityTaskId: string) => {
    await removePriorityTask.mutateAsync(priorityTaskId);
  };

  const handleToggleCompleted = async (id: string, currentValue: boolean) => {
    await toggleCompleted.mutateAsync({ id, isCompleted: !currentValue });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(priorityTasksWithDetails);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updates = items.map((item, index) => ({
      id: item.id,
      position: index,
    }));

    reorderPriorityTasks.mutate(updates);
  };

  const completedCount = priorityTasksWithDetails.filter(pt => pt.is_completed).length;
  const totalCount = priorityTasksWithDetails.length;

  if (loadingPriority || loadingTasks) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          {t('dashboard.priorityTasks', 'Приоритетни задачи')}
          {totalCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {completedCount}/{totalCount}
            </Badge>
          )}
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl"
              disabled={priorityTasks.length >= 10}
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('common.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>{t('dashboard.selectPriorityTask', 'Избери приоритетна задача')}</DialogTitle>
            </DialogHeader>
            
            {/* Project Filter */}
            <div className="mb-4">
              <Select value={selectedProjectFilter} onValueChange={setSelectedProjectFilter}>
                <SelectTrigger className="rounded-xl">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={t('dashboard.filterByProject', 'Филтрирай по проект')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('dashboard.allProjects', 'Всички проекти')}</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <ScrollArea className="max-h-[400px] pr-4">
              {filteredAvailableTasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {t('dashboard.noTasksToAdd', 'Няма налични задачи за добавяне')}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredAvailableTasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => {
                        handleAddTask(task.id);
                        setDialogOpen(false);
                      }}
                      className="w-full p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left flex items-start gap-3"
                    >
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", priorityColors[task.priority])} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm break-words line-clamp-2">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {task.project_name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {priorityTasksWithDetails.length === 0 ? (
          <div className="text-center py-8">
            <Star className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">
              {t('dashboard.noPriorityTasks', 'Изберете до 10 приоритетни задачи')}
            </p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="priority-tasks">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {priorityTasksWithDetails.map((pt, index) => (
                    <Draggable key={pt.id} draggableId={pt.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-xl bg-muted/50 transition-all",
                            snapshot.isDragging && "shadow-lg ring-2 ring-primary/20",
                            pt.is_completed && "opacity-60"
                          )}
                        >
                          <div {...provided.dragHandleProps} className="cursor-grab">
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <Checkbox
                            checked={pt.is_completed}
                            onCheckedChange={() => handleToggleCompleted(pt.id, pt.is_completed)}
                            className="flex-shrink-0"
                          />
                          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", priorityColors[pt.task?.priority || 'medium'])} />
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "font-medium text-sm break-words line-clamp-1",
                              pt.is_completed && "line-through"
                            )}>
                              {pt.task?.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {pt.task?.project_name}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 flex-shrink-0"
                            onClick={() => handleRemoveTask(pt.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
        
        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">{t('todayPlan.progress')}</span>
              <span className="font-medium">{Math.round((completedCount / totalCount) * 100)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
