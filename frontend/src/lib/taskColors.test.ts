import { describe, it, expect } from 'vitest';
import tailwindConfig from '../../tailwind.config';
import { TASK_COLORS, taskColorClass } from './taskColors';

describe('taskColors', () => {
  it('връща класа за познат цвят', () => {
    expect(taskColorClass('blue')).toBe('bg-task-blue');
  });

  it('без цвят или с непознат ключ — няма клас (базата може да съдържа всичко)', () => {
    expect(taskColorClass(null)).toBeUndefined();
    expect(taskColorClass(undefined)).toBeUndefined();
    expect(taskColorClass('bg-red-500 hover:x')).toBeUndefined();
  });

  it('всеки цвят има клас bg-task-<ключ> и съответен цвят в tailwind.config', () => {
    const configured: Record<string, string> = tailwindConfig.theme.extend.colors.task;
    for (const color of TASK_COLORS) {
      expect(color.className).toBe(`bg-task-${color.key}`);
      expect(configured[color.key]).toBe(`hsl(var(--task-${color.key}))`);
    }
    expect(Object.keys(configured)).toHaveLength(TASK_COLORS.length);
  });
});
