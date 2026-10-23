/**
 * Седмичното писмо „непипани задачи" — само чиста логика, без мрежа и без Deno,
 * за да я тестваме с vitest (digest.test.ts). index.ts чете базата и праща писмата.
 *
 * „Непипана" = без никаква промяна (`updated_at`, иначе `created_at`) поне STALE_DAYS дни —
 * същото правило като картона „Отложени задачи" (frontend/src/lib/postponedTasks.ts).
 */

export const STALE_DAYS = 30;
/** Повече редове правят писмото нечетимо; останалите се броят накрая. */
export const MAX_ROWS = 50;

const DAY_MS = 86400000;

export interface DigestTask {
  id: string;
  title: string;
  priority: string;
  project_id: string;
  user_id: string;
  updated_at: string | null;
  created_at: string | null;
  archived_at: string | null;
}
export interface DigestProject { id: string; name: string; user_id: string; stale_tasks_email: boolean }
/** Приет член на проект (project_members със status = 'accepted'). */
export interface DigestMember { project_id: string; user_id: string }
export interface DigestProfile { user_id: string; email: string | null; display_name: string | null; stale_tasks_email: boolean }
export interface DigestItem { task: DigestTask; projectName: string; staleDays: number }
export interface Digest { email: string; name: string; items: DigestItem[] }

/**
 * Едно писмо на човек: неговите (създадени от него) задачи, непипани поне `days` дни,
 * само в проекти с включен ключ и само ако личният му ключ е включен. Най-старите първи.
 * `projects` трябва да съдържа само активните проекти — задача в друг проект се пропуска.
 *
 * Създателят получава задачата само докато още има достъп до проекта (собственик или приет
 * член — същото правило като `is_project_member` в базата). Иначе изваден от проекта човек
 * би продължил да вижда в писмата заглавията на задачите и името на проекта.
 */
export function buildDigests(
  tasks: DigestTask[],
  projects: DigestProject[],
  members: DigestMember[],
  profiles: DigestProfile[],
  now: Date,
  days = STALE_DAYS,
): Digest[] {
  const activeProjects = new Map(projects.filter((p) => p.stale_tasks_email).map((p) => [p.id, p]));
  const hasAccess = new Set([
    ...projects.map((p) => `${p.id}:${p.user_id}`),
    ...members.map((m) => `${m.project_id}:${m.user_id}`),
  ]);
  const recipients = new Map(
    profiles.filter((p) => p.stale_tasks_email && p.email).map((p) => [p.user_id, p]),
  );

  const byUser = new Map<string, DigestItem[]>();
  for (const task of tasks) {
    if (task.archived_at) continue;
    const project = activeProjects.get(task.project_id);
    if (!project || !recipients.has(task.user_id)) continue;
    if (!hasAccess.has(`${task.project_id}:${task.user_id}`)) continue;
    const projectName = project.name;
    const stamp = new Date(task.updated_at || task.created_at || '').getTime();
    if (Number.isNaN(stamp)) continue;
    const staleDays = Math.floor((now.getTime() - stamp) / DAY_MS);
    if (staleDays < days) continue;
    const list = byUser.get(task.user_id) ?? [];
    list.push({ task, projectName, staleDays });
    byUser.set(task.user_id, list);
  }

  return [...byUser.entries()]
    .map(([userId, items]) => {
      const profile = recipients.get(userId)!;
      return {
        email: profile.email!,
        name: profile.display_name || profile.email!,
        items: items.sort((a, b) => b.staleDays - a.staleDays),
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}

/** ISO седмица като `2026-W44` — по нея пазим да няма второ писмо в същата седмица. */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday); // четвъртъкът на седмицата решава годината
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Адрес към задачата във формата на приложението; id без тирета стига (името е само украса). */
export function taskUrl(appUrl: string, projectId: string, taskId: string): string {
  const compact = (id: string) => id.replace(/-/g, '');
  return `${appUrl.replace(/\/+$/, '')}/p/${compact(projectId)}/tasks/${compact(taskId)}`;
}

export function digestSubject(count: number): string {
  return count === 1
    ? '🕸️ 1 задача стои непипана над месец'
    : `🕸️ ${count} задачи стоят непипани над месец`;
}

function esc(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PRIORITY = { high: '🔴 Висок', medium: '🟡 Среден', low: '🟢 Нисък' } as Record<string, string>;

export function renderDigestHtml(digest: Digest, appUrl: string, days = STALE_DAYS): string {
  const base = appUrl.replace(/\/+$/, '');
  const shown = digest.items.slice(0, MAX_ROWS);
  const rows = shown.map(({ task, projectName, staleDays }) => {
    const title = esc(task.title);
    const titleCell = base
      ? `<a href="${esc(taskUrl(base, task.project_id, task.id))}" style="color:#4c1d95;text-decoration:none;">${title}</a>`
      : title;
    return `<tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:8px 6px;font-size:13px;">${titleCell}</td>
      <td style="padding:8px 6px;font-size:12px;color:#6b7280;">${esc(projectName)}</td>
      <td style="padding:8px 6px;font-size:12px;">${PRIORITY[task.priority] ?? ''}</td>
      <td style="padding:8px 6px;font-size:12px;color:#b45309;white-space:nowrap;">${staleDays} дни</td>
    </tr>`;
  }).join('');
  const more = digest.items.length - shown.length;
  const settingsLink = base
    ? `<a href="${esc(base)}/settings" style="color:#6b7280;">Настройки</a>`
    : 'Настройки';

  return `
  <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:linear-gradient(135deg,#7c3bed,#6a2fd6);padding:20px;border-radius:12px;margin-bottom:20px;">
      <h1 style="color:white;margin:0;font-size:20px;">🕸️ Непипани задачи</h1>
      <p style="color:rgba(255,255,255,.85);margin:6px 0 0;">Здравейте, ${esc(digest.name)}!</p>
    </div>
    <p style="color:#374151;">Тези <strong>${digest.items.length}</strong> задачи не са променяни повече от <strong>${days} дни</strong>.
    Свърши ги, архивирай ги или ги преплануй — всяка промяна ги маха от следващото писмо.</p>
    <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
      <thead><tr style="background:#f3f4f6;">
        <th style="padding:8px 6px;text-align:left;font-size:11px;color:#6b7280;">ЗАДАЧА</th>
        <th style="padding:8px 6px;text-align:left;font-size:11px;color:#6b7280;">ПРОЕКТ</th>
        <th style="padding:8px 6px;text-align:left;font-size:11px;color:#6b7280;">ПРИОРИТЕТ</th>
        <th style="padding:8px 6px;text-align:left;font-size:11px;color:#6b7280;">НЕПИПАНА</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${more > 0 ? `<p style="color:#6b7280;font-size:13px;">…и още ${more}.</p>` : ''}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <p style="color:#9ca3af;font-size:11px;">Писмото идва всеки понеделник. Спира се от ${settingsLink}
    → „Имейл за непипани задачи“, а за отделен проект — от редакцията на проекта.</p>
  </div>`;
}
