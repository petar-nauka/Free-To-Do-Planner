import { describe, it, expect } from 'vitest';
import { buildDigests, isoWeek, renderDigestHtml, digestSubject, taskUrl } from './digest.ts';

const NOW = new Date('2026-10-26T06:00:00Z'); // понеделник
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();

const projects = [
  { id: 'p-on', name: 'Сайт', user_id: 'u1', stale_tasks_email: true },
  { id: 'p-off', name: 'Изключен', user_id: 'u1', stale_tasks_email: false },
];
// Приети членове на p-on (собственикът u1 не е тук — той има достъп като собственик).
// u5 вече не е член (изваден) — неговите стари задачи в p-on не бива да му се пращат.
const members = [
  { project_id: 'p-on', user_id: 'u2' },
  { project_id: 'p-on', user_id: 'u3' },
  { project_id: 'p-on', user_id: 'u4' },
];
const profiles = [
  { user_id: 'u1', email: 'ana@example.com', display_name: 'Ана', stale_tasks_email: true },
  { user_id: 'u2', email: 'bob@example.com', display_name: null, stale_tasks_email: false },
  { user_id: 'u3', email: '', display_name: 'Без имейл', stale_tasks_email: true },
  { user_id: 'u4', email: 'dora@example.com', display_name: 'Дора', stale_tasks_email: true },
  { user_id: 'u5', email: 'eve@example.com', display_name: 'Ева', stale_tasks_email: true },
];
function task(id: string, extra: Record<string, unknown> = {}) {
  return {
    id, title: `Задача ${id}`, priority: 'medium', project_id: 'p-on', user_id: 'u1',
    updated_at: daysAgo(40), created_at: daysAgo(90), archived_at: null, ...extra,
  };
}

describe('buildDigests', () => {
  it('събира задачите, непипани 30+ дни, при създателя им — най-старите първи', () => {
    const digests = buildDigests([task('a', { updated_at: daysAgo(31) }), task('b', { updated_at: daysAgo(75) })], projects, members, profiles, NOW);
    expect(digests).toHaveLength(1);
    expect(digests[0].email).toBe('ana@example.com');
    expect(digests[0].items.map((i) => [i.task.id, i.staleDays])).toEqual([['b', 75], ['a', 31]]);
    expect(digests[0].items[0].projectName).toBe('Сайт');
  });

  it('пропуска пипнатите в последните 30 дни и архивираните', () => {
    const digests = buildDigests([task('fresh', { updated_at: daysAgo(29) }), task('done', { archived_at: daysAgo(1) })], projects, members, profiles, NOW);
    expect(digests).toEqual([]);
  });

  it('спазва двата ключа: на проекта и личния', () => {
    const digests = buildDigests(
      [task('in-off-project', { project_id: 'p-off' }), task('of-opted-out-user', { user_id: 'u2' })],
      projects, members, profiles, NOW,
    );
    expect(digests).toEqual([]);
  });

  it('праща само на хора с достъп до проекта: приет член — да, изваден — не', () => {
    const digests = buildDigests(
      [task('by-member', { user_id: 'u4' }), task('by-removed', { user_id: 'u5' })],
      projects, members, profiles, NOW,
    );
    expect(digests.map((d) => [d.email, d.items.map((i) => i.task.id)])).toEqual([['dora@example.com', ['by-member']]]);
  });

  it('пропуска потребител без имейл и задача в непознат (архивиран) проект', () => {
    const digests = buildDigests([task('no-mail', { user_id: 'u3' }), task('lost', { project_id: 'gone' })], projects, members, profiles, NOW);
    expect(digests).toEqual([]);
  });
});

describe('isoWeek', () => {
  it('дава ISO седмицата — понеделник и неделя са в една и съща', () => {
    expect(isoWeek(new Date('2026-10-26T06:00:00Z'))).toBe('2026-W44');
    expect(isoWeek(new Date('2026-11-01T20:00:00Z'))).toBe('2026-W44');
    expect(isoWeek(new Date('2027-01-01T08:00:00Z'))).toBe('2026-W53');
  });
});

describe('писмото', () => {
  const digest = buildDigests([task('x', { title: '<script>alert(1)</script>' })], projects, members, profiles, NOW)[0];

  it('екранира текста от потребителя', () => {
    const html = renderDigestHtml(digest, 'https://todo.example.com');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('линкът води право към задачата', () => {
    expect(taskUrl('https://todo.example.com/', 'a1b2c3d4-0000-0000-0000-000000000001', '0f9e8d7c-0000-0000-0000-000000000002'))
      .toBe('https://todo.example.com/p/a1b2c3d4000000000000000000000001/tasks/0f9e8d7c000000000000000000000002');
    expect(renderDigestHtml(digest, 'https://todo.example.com')).toContain('href="https://todo.example.com/p/pon/tasks/x"');
  });

  it('без адрес на сайта — без линкове, но писмото пак става', () => {
    expect(renderDigestHtml(digest, '')).not.toContain('href=');
  });

  it('заглавието казва колко са задачите', () => {
    expect(digestSubject(1)).toBe('🕸️ 1 задача стои непипана над месец');
    expect(digestSubject(4)).toBe('🕸️ 4 задачи стоят непипани над месец');
  });
});
