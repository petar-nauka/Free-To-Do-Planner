import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Merge } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useProjects, Project } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface MergeProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}

export function MergeProjectDialog({ project, open, onOpenChange, onMerged }: MergeProjectDialogProps) {
  const { t } = useTranslation();
  const { projects } = useProjects();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [targetProjectId, setTargetProjectId] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);

  const otherProjects = projects.filter(p => p.id !== project.id);
  const targetProject = otherProjects.find(p => p.id === targetProjectId);

  const handleMerge = async () => {
    if (!targetProjectId) return;
    setIsMerging(true);

    try {
      // Move all tasks
      const { error: tasksError } = await supabase
        .from('tasks')
        .update({ project_id: targetProjectId })
        .eq('project_id', project.id);
      if (tasksError) throw tasksError;

      // Move all notes
      const { error: notesError } = await supabase
        .from('notes')
        .update({ project_id: targetProjectId })
        .eq('project_id', project.id);
      if (notesError) throw notesError;

      // Move all spreadsheets
      const { error: spreadsheetsError } = await supabase
        .from('spreadsheets')
        .update({ project_id: targetProjectId })
        .eq('project_id', project.id);
      if (spreadsheetsError) throw spreadsheetsError;

      // Move all reminders
      const { error: remindersError } = await supabase
        .from('reminders')
        .update({ project_id: targetProjectId })
        .eq('project_id', project.id);
      if (remindersError) throw remindersError;

      // Move all recurring tasks
      const { error: recurringError } = await supabase
        .from('recurring_tasks')
        .update({ project_id: targetProjectId })
        .eq('project_id', project.id);
      if (recurringError) throw recurringError;

      // Delete the source project
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);
      if (deleteError) throw deleteError;

      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['spreadsheets'] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-tasks'] });

      toast({
        title: 'Проектите са обединени',
        description: `Всичко от "${project.name}" е прехвърлено в "${targetProject?.name}"`,
      });

      onOpenChange(false);
      onMerged();
    } catch (error: any) {
      toast({ title: 'Грешка', description: error.message, variant: 'destructive' });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Merge className="w-5 h-5" />
            Обедини проект
          </DialogTitle>
          <DialogDescription>
            Всички задачи, бележки, таблици, напомняния и периодични задачи от „{project.name}" ще бъдат преместени в избрания проект. Текущият проект ще бъде изтрит.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Прехвърли всичко от „{project.name}" към:</Label>
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
            onClick={handleMerge}
            disabled={!targetProjectId || isMerging}
            className="rounded-xl bg-gradient-to-r from-primary to-secondary"
          >
            {isMerging ? 'Обединяване...' : 'Обедини'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
