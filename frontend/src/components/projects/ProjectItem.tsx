import { 
  Folder, Star, Heart, Zap, Rocket, Target,
  Briefcase, Code, Book, Music, Camera, Home
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Project } from '@/hooks/useProjects';

const iconMap: Record<string, React.ElementType> = {
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

const colorMap: Record<string, string> = {
  red: 'bg-project-red',
  orange: 'bg-project-orange',
  amber: 'bg-project-amber',
  yellow: 'bg-project-yellow',
  lime: 'bg-project-lime',
  green: 'bg-project-green',
  teal: 'bg-project-teal',
  cyan: 'bg-project-cyan',
  blue: 'bg-project-blue',
  indigo: 'bg-project-indigo',
  purple: 'bg-project-purple',
  pink: 'bg-project-pink',
};

interface ProjectItemProps {
  project: Project;
  isSelected: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

export function ProjectItem({ project, isSelected, isCollapsed, onClick }: ProjectItemProps) {
  const Icon = iconMap[project.icon] || Folder;
  const colorClass = colorMap[project.color] || 'bg-project-purple';

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-2 rounded-xl transition-all duration-200",
        isCollapsed ? "justify-center" : "",
        isSelected 
          ? "bg-sidebar-accent shadow-soft" 
          : "hover:bg-sidebar-accent/50"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-primary-foreground",
        colorClass
      )}>
        <Icon className="w-4 h-4" />
      </div>
      {!isCollapsed && (
        <span className={cn(
          "text-sm font-medium truncate text-left",
          isSelected ? "text-sidebar-foreground" : "text-sidebar-foreground/80"
        )}>
          {project.name}
        </span>
      )}
    </button>
  );
}
