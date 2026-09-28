import { FolderKanban, FileText, CheckSquare, Search, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type Tab = 'projects' | 'notes' | 'tasks' | 'search' | 'settings';

interface MobileNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const { t } = useTranslation();

  const tabs = [
    { id: 'projects' as Tab, icon: FolderKanban, label: t('nav.projects') },
    { id: 'notes' as Tab, icon: FileText, label: t('nav.notes') },
    { id: 'tasks' as Tab, icon: CheckSquare, label: t('nav.tasks') },
    { id: 'search' as Tab, icon: Search, label: t('nav.search') },
    { id: 'settings' as Tab, icon: Settings, label: t('nav.settings') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-2 py-1 md:hidden z-50">
      <div className="flex justify-around items-center">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
              activeTab === id 
                ? "text-primary bg-primary/10" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
