/**
 * Вътрешните постоянни адреси на приложението — едно място за URL договора.
 *
 * Схема: `/p/<проект>/<таб>/<елемент>`, където всеки сегмент изглежда като
 * `<четимо-име>-<32 шестнайсетични знака>`. Последните 32 знака са id-то на реда
 * без тиретата; всичко преди тях е украса и не се чете от кода. Затова
 * преименуването на проект/задача/бележка **не чупи вече запазени линкове**.
 *
 * Дизайн: `docs/superpowers/specs/2026-09-17-permalinks-design.md`
 */

/** Официална българска транслитерация (Закон за транслитерацията). */
const BG_TO_LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht',
  ъ: 'a', ь: 'y', ю: 'yu', я: 'ya',
};

const MAX_SLUG_LENGTH = 50;

const COMPACT_ID = /^[0-9a-f]{32}$/i;
const DASHED_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Табовете в проекта — имената им в адреса са и вътрешните стойности на `Tabs`. */
export const PROJECT_TABS = ['tasks', 'notes', 'sheets', 'reminders', 'recurring'] as const;
export type ProjectTab = (typeof PROJECT_TABS)[number];

export function isProjectTab(value?: string | null): value is ProjectTab {
  return !!value && (PROJECT_TABS as readonly string[]).includes(value);
}

type Named = { id: string; name?: string | null };
type Titled = { id: string; title?: string | null };

/** Човешко име → безопасен за адрес сегмент. Само украса — никой не го чете обратно. */
export function slugify(text?: string | null): string {
  if (!text) return '';

  let transliterated = '';
  for (const char of text.toLowerCase()) {
    transliterated += BG_TO_LAT[char] ?? char;
  }

  return transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

/** `<име>-<id без тирета>`; при липсващо име — само id-то. */
export function entitySegment(name: string | null | undefined, id: string): string {
  const compact = id.replace(/-/g, '');
  const slug = slugify(name);
  return slug ? `${slug}-${compact}` : compact;
}

/**
 * Обратното на `entitySegment`. Чете последните 32 знака; приема и пълен UUID
 * с тирета, за да продължат да работят ръчно писани и по-стари линкове.
 * Връща `null`, когато сегментът не е нито едното.
 */
export function parseEntityId(segment?: string | null): string | null {
  if (!segment) return null;

  const tail = segment.slice(-32);
  if (COMPACT_ID.test(tail)) {
    const lower = tail.toLowerCase();
    return [
      lower.slice(0, 8),
      lower.slice(8, 12),
      lower.slice(12, 16),
      lower.slice(16, 20),
      lower.slice(20),
    ].join('-');
  }

  if (DASHED_ID.test(segment)) return segment.toLowerCase();

  return null;
}

export function projectPath(project: Named): string {
  return `/p/${entitySegment(project.name, project.id)}`;
}

export function projectTabPath(project: Named, tab: ProjectTab): string {
  return `${projectPath(project)}/${tab}`;
}

export function taskPath(project: Named, task: Titled): string {
  return `${projectTabPath(project, 'tasks')}/${entitySegment(task.title, task.id)}`;
}

export function notePath(project: Named, note: Titled): string {
  return `${projectTabPath(project, 'notes')}/${entitySegment(note.title, note.id)}`;
}

export function sheetPath(project: Named, sheet: Named): string {
  return `${projectTabPath(project, 'sheets')}/${entitySegment(sheet.name, sheet.id)}`;
}

/**
 * Превежда стария формат `/?project=X&task=Y` (или `&note=Z`) към новия адрес.
 *
 * Пази вече изпратените имейл напомняния и всеки линк, копиран преди промяната.
 * Връща `null`, когато няма какво да се превежда.
 *
 * Имена на елемента нямаме — старият линк носи само id-та. Това е напълно
 * достатъчно: id-то е единственото, което се чете обратно.
 */
export function legacyPathToNew(params: URLSearchParams, project: Named): string | null {
  if (!params.get('project')) return null;

  // Параметрите идват от адресната лента, тоест от когото и да е. Вграждаме в
  // пътя само истински id-та — всичко друго се игнорира и се отваря проектът.
  const taskId = parseEntityId(params.get('task'));
  if (taskId) return taskPath(project, { id: taskId });

  const noteId = parseEntityId(params.get('note'));
  if (noteId) return notePath(project, { id: noteId });

  return projectPath(project);
}
