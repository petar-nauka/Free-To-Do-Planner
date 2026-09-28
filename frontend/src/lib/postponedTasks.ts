import type { TaskWithProject } from '@/hooks/useAllTasks';

/** Праговете, които се предлагат в картона „Отложени задачи". */
export const POSTPONED_DAY_OPTIONS = [30, 60, 90] as const;

export const DEFAULT_POSTPONED_DAYS = 30;

export type PostponedTask = TaskWithProject & {
  /** От колко цели дни задачата не е пипана. */
  staleDays: number;
};

type Options = {
  now: Date | number;
  days: number;
  /** ID на проект; `undefined` или `'all'` = без филтър. */
  projectId?: string;
  /** Колко реда да върнем (общият брой се връща отделно). */
  limit?: number;
};

const DAY_MS = 86400000;

/**
 * От колко дни задачата стои без движение, или `null` ако няма годна дата.
 * `updated_at` пада при всяка промяна (редакция, статус, преместване); при липса
 * ползваме `created_at`, за да не изпуснем задачата напълно.
 */
function staleDaysOf(task: TaskWithProject, nowMs: number): number | null {
  const stamp = task.updated_at || task.created_at;
  if (!stamp) return null;
  const ms = new Date(stamp).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor((nowMs - ms) / DAY_MS);
}

/**
 * Задачите без движение поне `days` дни, най-занемарените първи.
 *
 * `sort` в JS е стабилен → при равен престой се пази входният ред, а `useAllTasks`
 * вече подрежда по приоритет. Така по-важното излиза по-горе без допълнителна логика.
 */
function postponed(tasks: TaskWithProject[], now: Date | number, days: number): PostponedTask[] {
  const nowMs = now instanceof Date ? now.getTime() : now;

  return tasks
    .map((task) => ({ task, staleDays: staleDaysOf(task, nowMs) }))
    .filter((x): x is { task: TaskWithProject; staleDays: number } => x.staleDays !== null)
    .filter((x) => x.staleDays >= days)
    .map((x) => ({ ...x.task, staleDays: x.staleDays }))
    .sort((a, b) => b.staleDays - a.staleDays);
}

/**
 * Топ отложени задачи + общия им брой (за етикета „Топ 10 от 23").
 * `total` е за избрания проект, за да не лъже, когато има филтър.
 */
export function selectPostponedTasks(
  tasks: TaskWithProject[],
  { now, days, projectId, limit = 10 }: Options
): { items: PostponedTask[]; total: number } {
  const all = postponed(tasks, now, days);
  const scoped =
    projectId && projectId !== 'all' ? all.filter((t) => t.project_id === projectId) : all;

  return { items: scoped.slice(0, limit), total: scoped.length };
}

/**
 * Проектите, които реално имат отложени задачи — за филтъра. Не предлагаме
 * проекти, които биха дали празен списък.
 */
export function postponedProjectOptions(
  tasks: TaskWithProject[],
  { now, days }: Pick<Options, 'now' | 'days'>
): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const task of postponed(tasks, now, days)) {
    if (!byId.has(task.project_id)) byId.set(task.project_id, task.project_name);
  }

  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'));
}
