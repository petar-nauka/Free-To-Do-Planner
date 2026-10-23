import { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useProjects, Project } from '@/hooks/useProjects';
import { PROJECT_COLORS, PROJECT_ICONS, ProjectColor, ProjectIcon } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { 
  Folder, Star, Heart, Zap, Rocket, Target,
  Briefcase, Code, Book, Music, Camera, Home
} from 'lucide-react';

const iconComponents: Record<ProjectIcon, React.ElementType> = {
  folder: Folder,
  star: Star,
  heart: Heart,
  zap: Zap,
  rocket: Rocket,
  target: Target,
  briefcase: Briefcase,
  code: Code,
  book: Book,
  music: Music,
  camera: Camera,
  home: Home,
};

interface EditProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProjectDialog({ project, open, onOpenChange }: EditProjectDialogProps) {
  const { updateProject } = useProjects();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [color, setColor] = useState<ProjectColor>(project.color as ProjectColor);
  const [icon, setIcon] = useState<ProjectIcon>(project.icon as ProjectIcon);
  const [staleEmail, setStaleEmail] = useState(project.stale_tasks_email ?? true);

  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description || '');
      setColor(project.color as ProjectColor);
      setIcon(project.icon as ProjectIcon);
      setStaleEmail(project.stale_tasks_email ?? true);
    }
  }, [open, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await updateProject.mutateAsync({
      id: project.id,
      name: name.trim(),
      description: description.trim() || null,
      color,
      icon,
      stale_tasks_email: staleEmail,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Edit Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Project Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Project"
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this project about?"
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map(({ name: colorName, class: colorClass }) => (
                <button
                  key={colorName}
                  type="button"
                  onClick={() => setColor(colorName)}
                  className={cn(
                    "w-8 h-8 rounded-lg transition-all",
                    colorClass,
                    color === colorName 
                      ? "ring-2 ring-offset-2 ring-foreground scale-110" 
                      : "hover:scale-105"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_ICONS.map((iconName) => {
                const IconComponent = iconComponents[iconName];
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIcon(iconName)}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                      icon === iconName 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    <IconComponent className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="edit-stale-email">Седмичен имейл за непипани задачи</Label>
              <p className="text-xs text-muted-foreground">
                Всеки понеделник: задачите от този проект, непипани над 30 дни.
              </p>
            </div>
            <Switch id="edit-stale-email" checked={staleEmail} onCheckedChange={setStaleEmail} />
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!name.trim() || updateProject.isPending}
              className="rounded-xl bg-gradient-to-r from-primary to-secondary"
            >
              {updateProject.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
