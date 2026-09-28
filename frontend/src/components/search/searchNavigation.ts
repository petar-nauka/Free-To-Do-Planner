import type { SearchResult } from '@/hooks/useGlobalSearch';
import { notePath, projectPath, taskPath } from '@/lib/deepLinks';

/**
 * Превръща резултат от глобалното търсене в постоянен адрес.
 *
 * Резултатът носи и `title`, и `projectName`, затова адресът се получава
 * четим още от тук — без допълнителна справка в базата. Ползваме URL вместо
 * callback-и, за да работи търсенето от **всяка** страница, която рендерира
 * `AppHeader` (Dashboard, Completed, ...), без prop drilling.
 *
 * Връща `null` когато няма накъде да навигираме — бележка/задача без `projectId`
 * (не бива да пращаме потребителя към счупен URL).
 */
export function buildSearchResultPath(
  result: Pick<SearchResult, 'type' | 'id'> & { title?: string; projectId?: string; projectName?: string }
): string | null {
  if (result.type === 'project') {
    return projectPath({ id: result.id, name: result.title });
  }

  if (!result.projectId) return null;

  const project = { id: result.projectId, name: result.projectName };
  const item = { id: result.id, title: result.title };

  return result.type === 'note' ? notePath(project, item) : taskPath(project, item);
}
