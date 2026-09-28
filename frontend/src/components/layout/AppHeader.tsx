import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Settings, Moon, Sun, Menu, LogOut, User, Shield, Users, Pencil, FileDown, Trash2, Loader2, Archive, Home, Merge, CheckCircle2, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useSportProgram } from '@/hooks/useSportProgram';
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog';

interface ProjectMenuProps {
  onTeamClick: () => void;
  onEditClick: () => void;
  onExportClick: () => void;
  onArchiveClick: () => void;
  onDeleteClick: () => void;
  onMergeClick: () => void;
  isOwner: boolean;
  isExporting: boolean;
  isArchiving: boolean;
}

interface AppHeaderProps {
  onMenuClick: () => void;
  showMenuButton: boolean;
  projectName?: string;
  projectMenu?: ProjectMenuProps;
  onGoHome?: () => void;
}

export function AppHeader({ onMenuClick, showMenuButton, projectName, projectMenu, onGoHome }: AppHeaderProps) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { isEnabled: sportEnabled } = useSportProgram();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Listen for global open-search event (fired e.g. from MobileNav Search button)
  useEffect(() => {
    const handler = () => setSearchOpen(true);
    window.addEventListener('open-global-search', handler);
    return () => window.removeEventListener('open-global-search', handler);
  }, []);

  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    }
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const initials = user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <header className="h-14 bg-card border-b border-border px-2 sm:px-4 flex items-center justify-between gap-2 sm:gap-4">
      <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
        {showMenuButton && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="rounded-xl flex-shrink-0">
            <Menu className="w-5 h-5" />
          </Button>
        )}

        {/* Home link */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGoHome}
          className="rounded-xl gap-2 font-semibold text-primary hover:text-primary px-2 sm:px-3 flex-shrink-0"
        >
          <Home className="w-4 h-4" />
          <span className="hidden sm:inline truncate">{t('auth.appDescription')}</span>
        </Button>

        {/* Project Title */}
        {projectName && (
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-muted-foreground hidden sm:inline">/</span>
            <h1 className="text-sm sm:text-lg font-semibold truncate max-w-[120px] sm:max-w-xs">{projectName}</h1>
            {projectMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="rounded-xl">
                  <DropdownMenuItem 
                    className="rounded-lg cursor-pointer"
                    onClick={projectMenu.onTeamClick}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    {t('projects.teamMembers')}
                  </DropdownMenuItem>
                  {projectMenu.isOwner && (
                    <DropdownMenuItem 
                      className="rounded-lg cursor-pointer"
                      onClick={projectMenu.onEditClick}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('projects.editProject')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    className="rounded-lg cursor-pointer"
                    onClick={projectMenu.onExportClick}
                    disabled={projectMenu.isExporting}
                  >
                    {projectMenu.isExporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    {t('projects.exportAsPdf')}
                  </DropdownMenuItem>
                  {projectMenu.isOwner && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="rounded-lg cursor-pointer"
                        onClick={projectMenu.onMergeClick}
                      >
                        <Merge className="mr-2 h-4 w-4" />
                        Обедини с друг проект
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="rounded-lg cursor-pointer"
                        onClick={projectMenu.onArchiveClick}
                        disabled={projectMenu.isArchiving}
                      >
                        {projectMenu.isArchiving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Archive className="mr-2 h-4 w-4" />
                        )}
                        Архивирай
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="rounded-lg cursor-pointer text-destructive focus:text-destructive"
                        onClick={projectMenu.onDeleteClick}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('projects.deleteProject')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/completed')}
          className="rounded-xl gap-1.5 hidden sm:inline-flex"
          data-testid="header-completed-btn"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-medium">{t('header.completed', 'Завършени')}</span>
        </Button>

        {/* Search Icon */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSearchOpen(true)}
          className="rounded-xl"
          data-testid="header-search-btn"
        >
          <Search className="w-5 h-5" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-xl"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="rounded-xl p-1">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-lg cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              {t('header.profile')}
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="rounded-lg cursor-pointer"
              onClick={() => navigate('/settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              {t('header.settings')}
            </DropdownMenuItem>
            {sportEnabled && (
              <DropdownMenuItem
                className="rounded-lg cursor-pointer"
                onClick={() => navigate('/sport')}
                data-testid="dropdown-sport-link"
              >
                <Dumbbell className="mr-2 h-4 w-4" />
                Спорт
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="rounded-lg cursor-pointer sm:hidden"
              onClick={() => navigate('/completed')}
              data-testid="dropdown-completed-link"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {t('header.completed', 'Завършени')}
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem 
                className="rounded-lg cursor-pointer"
                onClick={() => navigate('/admin')}
              >
                <Shield className="mr-2 h-4 w-4" />
                {t('header.admin')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="rounded-lg cursor-pointer text-destructive focus:text-destructive"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t('header.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
