import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SearchResult {
  type: 'project' | 'note' | 'task';
  id: string;
  title: string;
  projectId?: string;
  projectName?: string;
  description?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  tags?: { name: string; color: string }[];
  contentSnippet?: string;
  archived?: boolean;
}

export interface SearchFilters {
  priority?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  tag?: string;
  projectId?: string;
  includeArchived?: boolean;
  scope?: 'all' | 'projects' | 'notes' | 'tasks';
}

// Strip HTML tags from rich content for cleaner snippets
function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Build a small context snippet around the matching keyword
function buildSnippet(text: string, query: string, length = 120): string {
  const clean = stripHtml(text);
  if (!clean) return '';
  if (!query) return clean.slice(0, length);
  const idx = clean.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return clean.slice(0, length);
  const start = Math.max(0, idx - 30);
  const end = Math.min(clean.length, idx + query.length + 90);
  return (start > 0 ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '');
}

export function useGlobalSearch(query: string, filters?: SearchFilters) {
  const { user } = useAuth();
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const hasTaskFilters = !!(filters && (filters.priority || filters.status || filters.dateFrom || filters.dateTo || filters.tag));
  const scope = filters?.scope || 'all';

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery, filters],
    queryFn: async () => {
      const searchTerm = debouncedQuery.trim() ? `%${debouncedQuery}%` : null;
      const results: SearchResult[] = [];

      // Projects
      if ((scope === 'all' || scope === 'projects') && !hasTaskFilters && searchTerm) {
        let projectsQ = supabase
          .from('projects')
          .select('id, name, description, archived_at')
          .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
          .limit(10);
        if (!filters?.includeArchived) {
          projectsQ = projectsQ.is('archived_at', null);
        }
        const { data: projects } = await projectsQ;
        if (projects) {
          results.push(...projects.map((p: any) => ({
            type: 'project' as const,
            id: p.id,
            title: p.name,
            description: p.description || undefined,
            archived: !!p.archived_at,
          })));
        }
      }

      // Notes - search title + content
      if ((scope === 'all' || scope === 'notes') && !hasTaskFilters && searchTerm) {
        let notesQ = supabase
          .from('notes')
          .select('id, title, content, project_id, archived_at, projects(name)')
          .or(`title.ilike.${searchTerm},content.ilike.${searchTerm}`)
          .limit(15);

        if (filters?.projectId) {
          notesQ = notesQ.eq('project_id', filters.projectId);
        }
        if (!filters?.includeArchived) {
          notesQ = notesQ.is('archived_at', null);
        }

        const { data: notes } = await notesQ;
        if (notes) {
          results.push(...notes.map((n: any) => ({
            type: 'note' as const,
            id: n.id,
            title: n.title,
            projectId: n.project_id,
            projectName: n.projects?.name,
            contentSnippet: n.content ? buildSnippet(n.content, debouncedQuery) : undefined,
            archived: !!n.archived_at,
          })));
        }
      }

      // Tasks
      if (scope === 'all' || scope === 'tasks' || hasTaskFilters) {
        let taskQuery = supabase
          .from('tasks')
          .select('id, title, description, project_id, priority, status, due_date, archived_at, projects(name), task_tags(name, color)');

        if (!filters?.includeArchived) {
          taskQuery = taskQuery.is('archived_at', null);
        }
        if (filters?.projectId) {
          taskQuery = taskQuery.eq('project_id', filters.projectId);
        }
        if (searchTerm) {
          taskQuery = taskQuery.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
        }
        if (filters?.priority) {
          taskQuery = taskQuery.eq('priority', filters.priority as any);
        }
        if (filters?.status) {
          taskQuery = taskQuery.eq('status', filters.status as any);
        }
        if (filters?.dateFrom) {
          taskQuery = taskQuery.gte('due_date', filters.dateFrom);
        }
        if (filters?.dateTo) {
          taskQuery = taskQuery.lte('due_date', filters.dateTo);
        }

        taskQuery = taskQuery.limit(30);
        const { data: tasks } = await taskQuery;

        if (tasks) {
          let filteredTasks = tasks as any[];
          if (filters?.tag) {
            filteredTasks = filteredTasks.filter(t =>
              (t.task_tags as any[])?.some((tag: any) => tag.name.toLowerCase().includes(filters.tag!.toLowerCase()))
            );
          }
          results.push(...filteredTasks.map((t: any) => ({
            type: 'task' as const,
            id: t.id,
            title: t.title,
            projectId: t.project_id,
            projectName: t.projects?.name,
            description: t.description ? buildSnippet(t.description, debouncedQuery) : undefined,
            priority: t.priority,
            status: t.status,
            dueDate: t.due_date || undefined,
            tags: (t.task_tags as any[]) || [],
            archived: !!t.archived_at,
          })));
        }
      }

      return results;
    },
    enabled: !!user && (debouncedQuery.length > 0 || hasTaskFilters || !!filters?.projectId),
  });

  return { results, isLoading };
}
