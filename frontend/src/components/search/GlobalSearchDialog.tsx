import { useState, useEffect } from 'react';
import { Search, FolderKanban, FileText, CheckSquare, Filter, X, Tag, Calendar, AlertTriangle, Archive } from 'lucide-react';
import {
  CommandDialog,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useGlobalSearch, SearchFilters } from '@/hooks/useGlobalSearch';
import { useProjects } from '@/hooks/useProjects';
import { buildSearchResultPath } from './searchNavigation';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: 'Висок', color: 'text-red-500' },
  medium: { label: 'Среден', color: 'text-amber-500' },
  low: { label: 'Нисък', color: 'text-blue-500' },
};

const statusConfig: Record<string, string> = {
  new: 'Нова',
  in_progress: 'В процес',
  future: 'На изчакване',
};

type Scope = 'all' | 'projects' | 'notes' | 'tasks';

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [scope, setScope] = useState<Scope>('all');
  const [filters, setFilters] = useState<SearchFilters>({});

  const combinedFilters: SearchFilters = { ...filters, scope };
  const { results, isLoading } = useGlobalSearch(query, combinedFilters);

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => k !== 'scope' && !!v);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const handleSelect = (result: typeof results[0]) => {
    const path = buildSearchResultPath(result);

    onOpenChange(false);
    setQuery('');
    setFilters({});
    setScope('all');

    if (path) navigate(path);
  };

  const clearFilters = () => setFilters({});

  const projectResults = results.filter(r => r.type === 'project');
  const noteResults = results.filter(r => r.type === 'note');
  const taskResults = results.filter(r => r.type === 'task');

  const scopeTabs: { id: Scope; label: string; count: number }[] = [
    { id: 'all', label: t('search.all', 'Всички'), count: results.length },
    { id: 'projects', label: t('nav.projects', 'Проекти'), count: projectResults.length },
    { id: 'notes', label: t('nav.notes', 'Бележки'), count: noteResults.length },
    { id: 'tasks', label: t('nav.tasks', 'Задачи'), count: taskResults.length },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center border-b border-border px-3" data-testid="global-search-dialog">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <input
          data-testid="global-search-input"
          className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={t('search.placeholder', 'Търсене на проекти, бележки, задачи...')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          data-testid="global-search-filters-toggle"
          variant="ghost"
          size="sm"
          className={`ml-1 h-8 px-2 ${hasActiveFilters ? 'text-primary' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4" />
          {hasActiveFilters && <span className="ml-1 text-xs">●</span>}
        </Button>
      </div>

      {/* Scope tabs */}
      <div className="border-b border-border px-3 py-2 flex items-center gap-1 overflow-x-auto">
        {scopeTabs.map(tab => (
          <button
            key={tab.id}
            data-testid={`search-scope-${tab.id}`}
            onClick={() => setScope(tab.id)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap',
              scope === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {tab.label}
            {(query.length > 0 || hasActiveFilters) && (
              <span className="ml-1 opacity-70">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="border-b border-border p-3 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('search.filters', 'Разширени филтри')}
            </span>
            {hasActiveFilters && (
              <Button
                data-testid="search-filters-clear"
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={clearFilters}
              >
                <X className="w-3 h-3 mr-1" />
                {t('common.clear', 'Изчисти')}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Project filter */}
            <Select
              value={filters.projectId || 'all'}
              onValueChange={(v) => setFilters(f => ({ ...f, projectId: v === 'all' ? undefined : v }))}
            >
              <SelectTrigger data-testid="search-filter-project" className="h-8 text-xs col-span-2">
                <FolderKanban className="w-3 h-3 mr-1" />
                <SelectValue placeholder={t('search.allProjects', 'Всички проекти')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('search.allProjects', 'Всички проекти')}</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Priority */}
            <Select
              value={filters.priority || 'any'}
              onValueChange={(v) => setFilters(f => ({ ...f, priority: v === 'any' ? undefined : v }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                <SelectValue placeholder={t('tasks.priority', 'Приоритет')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('search.anyPriority', 'Всякакъв')}</SelectItem>
                <SelectItem value="high">🔴 Висок</SelectItem>
                <SelectItem value="medium">🟡 Среден</SelectItem>
                <SelectItem value="low">🔵 Нисък</SelectItem>
              </SelectContent>
            </Select>

            {/* Status */}
            <Select
              value={filters.status || 'any'}
              onValueChange={(v) => setFilters(f => ({ ...f, status: v === 'any' ? undefined : v }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <CheckSquare className="w-3 h-3 mr-1" />
                <SelectValue placeholder={t('tasks.status', 'Статус')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('search.anyStatus', 'Всякакъв')}</SelectItem>
                <SelectItem value="new">Нова</SelectItem>
                <SelectItem value="in_progress">В процес</SelectItem>
                <SelectItem value="future">На изчакване</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range */}
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <Input
                type="date"
                className="h-8 text-xs"
                value={filters.dateFrom || ''}
                onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value || undefined }))}
              />
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <Input
                type="date"
                className="h-8 text-xs"
                value={filters.dateTo || ''}
                onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value || undefined }))}
              />
            </div>
          </div>

          {/* Tag filter */}
          <div className="flex items-center gap-1">
            <Tag className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <Input
              className="h-8 text-xs"
              placeholder={t('search.filterByTag', 'Филтрирай по таг...')}
              value={filters.tag || ''}
              onChange={(e) => setFilters(f => ({ ...f, tag: e.target.value || undefined }))}
            />
          </div>

          {/* Include archived */}
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              data-testid="search-filter-archived"
              type="checkbox"
              className="rounded border-border"
              checked={!!filters.includeArchived}
              onChange={(e) => setFilters(f => ({ ...f, includeArchived: e.target.checked || undefined }))}
            />
            <Archive className="w-3 h-3" />
            {t('search.includeArchived', 'Включи архивирани')}
          </label>
        </div>
      )}

      <CommandList>
        <CommandEmpty>
          {isLoading ? t('common.loading', 'Търсене...') : t('search.noResults', 'Няма резултати.')}
        </CommandEmpty>

        {projectResults.length > 0 && (
          <CommandGroup heading={t('nav.projects', 'Проекти')}>
            {projectResults.map(result => (
              <CommandItem
                key={result.id}
                onSelect={() => handleSelect(result)}
                className="rounded-lg cursor-pointer"
                data-testid={`search-result-project-${result.id}`}
              >
                <FolderKanban className="mr-2 h-4 w-4 text-primary" />
                <span>{result.title}</span>
                {result.archived && (
                  <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">
                    <Archive className="w-2.5 h-2.5 mr-0.5" />
                    Архив
                  </Badge>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {noteResults.length > 0 && (
          <CommandGroup heading={t('nav.notes', 'Бележки')}>
            {noteResults.map(result => (
              <CommandItem
                key={result.id}
                onSelect={() => handleSelect(result)}
                className="rounded-lg cursor-pointer"
                data-testid={`search-result-note-${result.id}`}
              >
                <FileText className="mr-2 h-4 w-4 text-secondary mt-1 flex-shrink-0" />
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{result.title}</span>
                    {result.archived && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        <Archive className="w-2.5 h-2.5 mr-0.5" />
                        Архив
                      </Badge>
                    )}
                  </div>
                  {result.contentSnippet && (
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {result.contentSnippet}
                    </span>
                  )}
                  {result.projectName && (
                    <span className="text-xs text-muted-foreground/70">в {result.projectName}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {taskResults.length > 0 && (
          <CommandGroup heading={t('nav.tasks', 'Задачи')}>
            {taskResults.map(result => (
              <CommandItem
                key={result.id}
                onSelect={() => handleSelect(result)}
                className="rounded-lg cursor-pointer"
                data-testid={`search-result-task-${result.id}`}
              >
                <CheckSquare className="mr-2 h-4 w-4 text-accent flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="truncate">{result.title}</span>
                    {result.priority && (
                      <span className={`text-xs ${priorityConfig[result.priority]?.color || ''}`}>
                        {priorityConfig[result.priority]?.label}
                      </span>
                    )}
                    {result.status && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {statusConfig[result.status] || result.status}
                      </Badge>
                    )}
                    {result.archived && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        <Archive className="w-2.5 h-2.5 mr-0.5" />
                        Завършена
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {result.projectName && (
                      <span className="text-xs text-muted-foreground">в {result.projectName}</span>
                    )}
                    {result.dueDate && (
                      <span className="text-xs text-muted-foreground">📅 {result.dueDate}</span>
                    )}
                    {result.tags && result.tags.length > 0 && (
                      <div className="flex gap-1">
                        {result.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] h-4 px-1">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
