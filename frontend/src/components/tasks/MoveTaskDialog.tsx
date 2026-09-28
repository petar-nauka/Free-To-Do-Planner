import { useState } from 'react';
import { FolderInput } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useProjects } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Task } from '@/hooks/useTasks';

interface MoveTaskDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoveTaskDialog({ task, open, onOpenChange }: MoveTaskDialogProps) {
  const { projects } = useProjects();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [targetProjectId, setTargetProjectId] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);

  const otherProjects = projects.filter(p => p.id !== task.project_id);
  const targetProject = otherProjects.find(p => p.id === targetProjectId);

  const handleMove = async () => {
    if (!targetProjectId) return;
    setIsMoving(true);

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ project_id: targetProjectId })
        .eq('id', task.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['tasks'] });

      toast({
        title: 'Задачата е преместена',
        description: `"${task.title}" → "${targetProject?.name}"`,
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Грешка', description: error.message, variant: 'destructive' });
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FolderInput className="w-5 h-5" />
            Прехвърли задача
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Прехвърли „{task.title}" към:</Label>
            <Select value={targetProjectId} onValueChange={setTargetProjectId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Избери проект..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {otherProjects.map(p => (
                  <SelectItem key={p.id} value={p.id} className="rounded-lg">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Отказ
          </Button>
          <Button
            onClick={handleMove}
            disabled={!targetProjectId || isMoving}
            className="rounded-xl bg-gradient-to-r from-primary to-secondary"
          >
            {isMoving ? 'Преместване...' : 'Премести'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
