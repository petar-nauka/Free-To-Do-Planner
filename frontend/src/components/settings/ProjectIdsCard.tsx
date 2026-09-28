import { Copy, FolderOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjects } from '@/hooks/useProjects';
import { useToast } from '@/hooks/use-toast';

export function ProjectIdsCard() {
  const { projects } = useProjects();
  const { toast } = useToast();

  const copyToClipboard = (id: string, name: string) => {
    navigator.clipboard.writeText(id);
    toast({ title: `Копирано ID за "${name}"` });
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          Project IDs
        </CardTitle>
        <CardDescription>Използвай тези ID-та за n8n интеграция</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {projects && projects.length > 0 ? (
          projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
              onClick={() => copyToClipboard(project.id, project.name)}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{project.name}</p>
                <p className="text-xs text-muted-foreground font-mono select-all truncate">{project.id}</p>
              </div>
              <Copy className="w-4 h-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Няма проекти</p>
        )}
      </CardContent>
    </Card>
  );
}
