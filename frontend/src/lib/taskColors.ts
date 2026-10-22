/**
 * Цвят на фона на задача — палитрата на Google Keep: пастели в светъл режим,
 * наситени тонове в тъмен (CSS променливите `--task-*` в index.css).
 *
 * Класовете са изписани изцяло нарочно: Tailwind генерира само класове, които
 * вижда като цял текст в кода. Сглобен в движение (`bg-task-${color}`) клас
 * не стига до CSS-а — затова в базата пазим ключа, а класът идва от тук.
 */
export const TASK_COLORS = [
  { key: 'red', label: 'Червен', className: 'bg-task-red' },
  { key: 'orange', label: 'Оранжев', className: 'bg-task-orange' },
  { key: 'yellow', label: 'Жълт', className: 'bg-task-yellow' },
  { key: 'green', label: 'Зелен', className: 'bg-task-green' },
  { key: 'teal', label: 'Тюркоаз', className: 'bg-task-teal' },
  { key: 'sky', label: 'Светлосин', className: 'bg-task-sky' },
  { key: 'blue', label: 'Син', className: 'bg-task-blue' },
  { key: 'purple', label: 'Лилав', className: 'bg-task-purple' },
  { key: 'pink', label: 'Розов', className: 'bg-task-pink' },
  { key: 'brown', label: 'Кафяв', className: 'bg-task-brown' },
  { key: 'gray', label: 'Сив', className: 'bg-task-gray' },
] as const;

export type TaskColor = (typeof TASK_COLORS)[number]['key'];

/** Класът за фона, или `undefined` за „без цвят" и за непознат ключ. */
export function taskColorClass(color?: string | null): string | undefined {
  return TASK_COLORS.find((c) => c.key === color)?.className;
}
