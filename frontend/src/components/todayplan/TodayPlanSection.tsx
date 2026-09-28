import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';
import { 
  Target, 
  Plus, 
  X, 
  CheckCircle2, 
  Circle,
  Settings2,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTodayPlan } from '@/hooks/useTodayPlan';
import { useTasks } from '@/hooks/useTasks';

interface TodayPlanSectionProps {
  projectId: string;
}

export function TodayPlanSection({ projectId }: TodayPlanSectionProps) {
  const { t, i18n } = useTranslation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [taskLimit, setTaskLimit] = useState(5);
  
  const { 
    todayPlan, 
    mitTasks, 
    isLoading, 
    addMitTask, 
    removeMitTask, 
    toggleMitCompletion,
    updateTaskLimit 
  } = useTodayPlan(projectId);
  
  const { tasks } = useTasks(projectId);
  
  const dateLocale = i18n.language === 'bg' ? bg : enUS;
  const today = new Date();
  const formattedDate = format(today, 'EEEE, d MMMM', { locale: dateLocale });
  
  // Get tasks that are not yet in MIT list (only non-archived tasks)
  const availableTasks = tasks.filter(
    task => !mitTasks.some(mit => mit.task_id === task.id)
  );
  
  // Get full task data for MIT tasks
  const mitTasksWithDetails = mitTasks.map(mit => ({
    ...mit,
    task: tasks.find(t => t.id === mit.task_id)
  })).filter(mit => mit.task);
  
  const completedCount = mitTasks.filter(m => m.is_completed).length;
  const currentLimit = todayPlan?.daily_task_limit || 5;

  const handleAddMit = async (taskId: string) => {
    if (mitTasks.length >= 3) return;
    await addMitTask.mutateAsync(taskId);
    setIsAddDialogOpen(false);
  };

  const handleUpdateLimit = async () => {
    await updateTaskLimit.mutateAsync(taskLimit);
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl mb-4">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl mb-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {t('todayPlan.title')}
                <Sparkles className="w-4 h-4 text-amber-500" />
              </CardTitle>
              <p className="text-sm text-muted-foreground capitalize">{formattedDate}</p>
            </div>
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl">
                <Settings2 className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 rounded-xl">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('todayPlan.dailyLimit')}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={taskLimit}
                      onChange={(e) => setTaskLimit(Number(e.target.value))}
                      className="rounded-xl"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleUpdateLimit}
                      className="rounded-xl"
                    >
                      {t('common.save')}
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* MIT Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm flex items-center gap-2">
              {t('todayPlan.mitTitle')}
              <Badge variant="secondary" className="rounded-full">
                {mitTasks.length}/3
              </Badge>
            </h4>
            
            {mitTasks.length < 3 && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="rounded-xl h-7 px-2">
                    <Plus className="w-4 h-4 mr-1" />
                    {t('common.add')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>{t('todayPlan.selectMit')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {availableTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        {t('todayPlan.noTasksAvailable')}
                      </p>
                    ) : (
                      availableTasks.map(task => (
                        <Button
                          key={task.id}
                          variant="ghost"
                          className="w-full justify-start rounded-xl h-auto py-3 px-4"
                          onClick={() => handleAddMit(task.id)}
                        >
                          <div className="text-left">
                            <p className="font-medium">{task.title}</p>
                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </Button>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          
          {mitTasksWithDetails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {t('todayPlan.noMitYet')}
            </p>
          ) : (
            <div className="space-y-2">
              {mitTasksWithDetails.map((mit, index) => (
                <div
                  key={mit.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    mit.is_completed 
                      ? 'bg-primary/5 border-primary/20' 
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    #{index + 1}
                  </div>
                  
                  <Checkbox
                    checked={mit.is_completed}
                    onCheckedChange={(checked) => 
                      toggleMitCompletion.mutate({ 
                        mitTaskId: mit.id, 
                        isCompleted: checked as boolean 
                      })
                    }
                    className="rounded-full"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${mit.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                      {mit.task?.title}
                    </p>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
                    onClick={() => removeMitTask.mutate(mit.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Progress */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('todayPlan.progress')}</span>
            <div className="flex items-center gap-2">
              {completedCount === mitTasks.length && mitTasks.length > 0 ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="font-medium">
                {completedCount}/{mitTasks.length} MIT
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-muted-foreground">{t('todayPlan.dailyLimit')}</span>
            <span className="font-medium">{currentLimit} {t('todayPlan.tasksToday')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
