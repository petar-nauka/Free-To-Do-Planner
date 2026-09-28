import { describe, it, expect } from 'vitest';
import { selectPostponedTasks, postponedProjectOptions } from './postponedTasks';

const NOW = new Date('2026-07-24T12:00:00Z');

/** Задача, пипана преди N дни. */
function task(id: string, daysAgo: number, extra: Record<string, unknown> = {}) {
  const updated = new Date(NOW.getTime() - daysAgo * 86400000).toISOString();
  return {
    id,
    title: `Задача ${id}`,
    project_id: 'p1',
    project_name: 'Проект 1',
    status: 'new',
    priority: 'medium',
    due_date: null,
    created_at: updated,
    updated_at: updated,
    ...extra,
  } as any;
}

describe('selectPostponedTasks', () => {
  it('взима само задачи без движение поне N дни (граница: 30 влиза, 29 не)', () => {
    const { items } = selectPostponedTasks([task('a', 29), task('b', 30), task('c', 31)], {
      now: NOW,
      days: 30,
    });
    expect(items.map((t) => t.id)).toEqual(['c', 'b']); // най-занемарената първа
  });

  it('изчислява от колко дни стои задачата', () => {
    const { items } = selectPostponedTasks([task('a', 45)], { now: NOW, days: 30 });
    expect(items[0].staleDays).toBe(45);
  });

  it('реже до лимита, но връща общия брой (за „Топ 10 от N")', () => {
    const many = Array.from({ length: 23 }, (_, i) => task(`t${i}`, 40 + i));
    const { items, total } = selectPostponedTasks(many, { now: NOW, days: 30 });
    expect(items).toHaveLength(10);
    expect(total).toBe(23);
  });

  it('филтрира по проект, а общият брой е за избрания проект', () => {
    const tasks = [
      task('a', 40),
      task('b', 50, { project_id: 'p2', project_name: 'Проект 2' }),
      task('c', 60, { project_id: 'p2', project_name: 'Проект 2' }),
    ];
    const { items, total } = selectPostponedTasks(tasks, { now: NOW, days: 30, projectId: 'p2' });
    expect(items.map((t) => t.id)).toEqual(['c', 'b']);
    expect(total).toBe(2);
  });

  it('„all" не филтрира по проект', () => {
    const tasks = [task('a', 40), task('b', 50, { project_id: 'p2' })];
    expect(selectPostponedTasks(tasks, { now: NOW, days: 30, projectId: 'all' }).total).toBe(2);
  });

  it('при липсващо updated_at ползва created_at (не изпуска задачата)', () => {
    const t = task('a', 40);
    t.updated_at = null;
    const { items } = selectPostponedTasks([t], { now: NOW, days: 30 });
    expect(items.map((x) => x.id)).toEqual(['a']);
  });

  it('пропуска задачи без валидна дата, вместо да ги подрежда като NaN', () => {
    const broken = { ...task('a', 40), updated_at: 'не-е-дата', created_at: null };
    expect(selectPostponedTasks([broken as any], { now: NOW, days: 30 }).items).toEqual([]);
  });

  it('при равен престой запазва входния ред (useAllTasks вече подрежда по приоритет)', () => {
    const high = task('high', 40, { priority: 'high' });
    const low = task('low', 40, { priority: 'low' });
    const { items } = selectPostponedTasks([high, low], { now: NOW, days: 30 });
    expect(items.map((t) => t.id)).toEqual(['high', 'low']);
  });
});

describe('postponedProjectOptions', () => {
  it('връща само проектите с отложени задачи, без дубликати, по азбучен ред', () => {
    const tasks = [
      task('a', 40, { project_id: 'p2', project_name: 'Бета' }),
      task('b', 50, { project_id: 'p1', project_name: 'Алфа' }),
      task('c', 60, { project_id: 'p2', project_name: 'Бета' }),
      task('d', 5, { project_id: 'p3', project_name: 'Гама' }), // не е отложена
    ];
    expect(postponedProjectOptions(tasks, { now: NOW, days: 30 })).toEqual([
      { id: 'p1', name: 'Алфа' },
      { id: 'p2', name: 'Бета' },
    ]);
  });
});
