/**
 * Изчисления за спортния дневник — чисти функции без React и без мрежа.
 *
 * Две отделни оси на времето, които е важно да не се смесват:
 *
 *  1. **Ден от седмицата** (`weekdayOf`) идва от реалната дата и определя КОИ блокове
 *     се правят днес. Понеделник си е понеделник, независимо кога е започната програмата.
 *  2. **Ден / цикъл / седмица** (`cycleInfo`) идва от `start_date` и служи САМО за
 *     прогресията (седмица 1–4) и напредъка през циклите.
 *
 * Всички дати са ISO низове `YYYY-MM-DD` в местно време. Нарочно не се минава през
 * `Date.toISOString()` — той връща UTC и при българско време мести деня назад.
 */

import type { SportContent, SportProgram, SportSession } from './sportTypes';

export const DAYS_FULL = [
  'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота', 'Неделя',
] as const;

export const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'] as const;

export const DEFAULT_CYCLE_DAYS = 28;

const DAY_MS = 86400000;

/** Дата → `YYYY-MM-DD` в местно време. */
export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** `YYYY-MM-DD` → Date в местна полунощ. */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/**
 * Цели дни между две дати. Минава през местна полунощ и закръгля, за да не се счупи
 * при смяната на лятно/зимно време (тогава денонощието е 23 или 25 часа).
 */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((fromISO(toIso).getTime() - fromISO(fromIso).getTime()) / DAY_MS);
}

/** Реален ден от седмицата, понеделник = 0. Индекс в `content.week_pattern`. */
export function weekdayOf(iso: string): number {
  return (fromISO(iso).getDay() + 6) % 7;
}

export interface CycleInfo {
  /** Датата е преди началото на програмата. */
  beforeStart: boolean;
  /** 1 в деня на старта; отрицателен или 0 преди него. */
  dayIndex: number;
  cycle: number;
  dayInCycle: number;
  /** 1–4 при цикъл от 28 дни. */
  week: number;
}

export function cycleInfo(
  dateIso: string,
  startIso: string,
  cycleDays: number = DEFAULT_CYCLE_DAYS,
): CycleInfo {
  const diff = daysBetween(startIso, dateIso);
  if (diff < 0) {
    return { beforeStart: true, dayIndex: diff + 1, cycle: 0, dayInCycle: 0, week: 0 };
  }
  return {
    beforeStart: false,
    dayIndex: diff + 1,
    cycle: Math.floor(diff / cycleDays) + 1,
    dayInCycle: (diff % cycleDays) + 1,
    week: Math.floor((diff % cycleDays) / 7) + 1,
  };
}

/** Дата на конкретен ден от конкретен цикъл. Обратното на `cycleInfo`. */
export function dateOf(
  cycle: number,
  dayInCycle: number,
  startIso: string,
  cycleDays: number = DEFAULT_CYCLE_DAYS,
): string {
  return addDays(startIso, (cycle - 1) * cycleDays + (dayInCycle - 1));
}

export interface PlannedBlock {
  key: string;
  title: string;
  detail: string;
  duration: string;
}

/**
 * Блоковете, планирани за дадена дата, по реалния ден от седмицата.
 * Ключове, които вече не съществуват в `content.blocks`, се пропускат тихо —
 * това се случва, ако блокът е изтрит, но е останал в шаблона.
 */
export function plannedBlocks(content: SportContent, dateIso: string): PlannedBlock[] {
  const pattern = content.week_pattern?.[weekdayOf(dateIso)];
  const keys = pattern?.blocks ?? [];
  return keys
    .filter((k) => content.blocks?.[k])
    .map((k) => {
      const b = content.blocks[k];
      return { key: k, title: b.title, detail: b.detail ?? '', duration: b.duration ?? '' };
    });
}

export interface DayStats {
  /** Колко от планираните блокове са отметнати. */
  done: number;
  /** Колко блока изобщо са планирани. 0 = почивен ден. */
  total: number;
}

/**
 * Изпълнение за един ден. Знаменателят е ПЛАНИРАНОТО за деня, не фиксирано число —
 * така съзнателно оставеният почивен ден не се брои като пропуснат.
 */
export function dayStats(
  content: SportContent,
  sessions: SportSession[],
  dateIso: string,
): DayStats {
  const blocks = plannedBlocks(content, dateIso);
  const done = blocks.filter((b) =>
    sessions.some((s) => s.session_date === dateIso && s.block_key === b.key && s.completed),
  ).length;
  return { done, total: blocks.length };
}

/** Сборно изпълнение за диапазон дни от даден цикъл (включително двата края). */
export function rangeStats(
  program: SportProgram,
  sessions: SportSession[],
  cycle: number,
  fromDay: number,
  toDay: number,
): DayStats {
  let done = 0;
  let total = 0;
  for (let d = fromDay; d <= toDay; d++) {
    const st = dayStats(
      program.content,
      sessions,
      dateOf(cycle, d, program.start_date, program.cycle_days),
    );
    done += st.done;
    total += st.total;
  }
  return { done, total };
}

/** Колко дни от цикъла са изпълнени докрай (почивните дни не се броят). */
export function fullDaysInCycle(
  program: SportProgram,
  sessions: SportSession[],
  cycle: number,
): number {
  let n = 0;
  for (let d = 1; d <= program.cycle_days; d++) {
    const st = dayStats(
      program.content,
      sessions,
      dateOf(cycle, d, program.start_date, program.cycle_days),
    );
    if (st.total > 0 && st.done === st.total) n++;
  }
  return n;
}

export function percent(stats: DayStats): number {
  return stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
}

/* ---------------------------------------------------------------------------
 * Календарни седмици (Пн–Нд)
 *
 * Отделна ос от цикъла: цикълът брои прогресията от `start_date`, а тези функции
 * гледат нормалната календарна седмица — така „тази седмица" значи същото, което
 * значи и извън приложението.
 * ------------------------------------------------------------------------- */

/** Понеделникът на седмицата, в която пада датата. */
export function weekStartOf(iso: string): string {
  return addDays(iso, -weekdayOf(iso));
}

export interface PeriodStats extends DayStats {
  /** Дни в периода, за които изобщо е имало планирани блокове. */
  activeDays: number;
  /** Дни, изкарани докрай (почивните не се броят). */
  fullDays: number;
}

/** Изпълнение за произволен диапазон дати, включително двата края. */
export function periodStats(
  content: SportContent,
  sessions: SportSession[],
  fromIso: string,
  toIso: string,
): PeriodStats {
  let done = 0;
  let total = 0;
  let activeDays = 0;
  let fullDays = 0;

  for (let iso = fromIso; iso <= toIso; iso = addDays(iso, 1)) {
    const st = dayStats(content, sessions, iso);
    done += st.done;
    total += st.total;
    if (st.total > 0) {
      activeDays++;
      if (st.done === st.total) fullDays++;
    }
  }

  return { done, total, activeDays, fullDays };
}

export interface BlockBreakdownRow {
  key: string;
  title: string;
  done: number;
  total: number;
}

/**
 * Колко пъти всеки блок е бил планиран и колко от тях са отметнати.
 * Показва кое точно се пропуска — общият процент това го скрива.
 */
export function blockBreakdown(
  content: SportContent,
  sessions: SportSession[],
  fromIso: string,
  toIso: string,
): BlockBreakdownRow[] {
  const rows = new Map<string, BlockBreakdownRow>();

  for (let iso = fromIso; iso <= toIso; iso = addDays(iso, 1)) {
    for (const b of plannedBlocks(content, iso)) {
      const row = rows.get(b.key) ?? { key: b.key, title: b.title, done: 0, total: 0 };
      row.total++;
      if (sessions.some((s) => s.session_date === iso && s.block_key === b.key && s.completed)) {
        row.done++;
      }
      rows.set(b.key, row);
    }
  }

  // Най-пропусканите отгоре — там е полезната информация.
  return Array.from(rows.values()).sort(
    (a, b) => a.done / a.total - b.done / b.total || b.total - a.total,
  );
}

/** Последната мярка в периода (или null). Ползва се за сравнение между седмици. */
export function lastMeasurementIn(
  measurements: { measured_on: string; metrics: Record<string, number> }[],
  fromIso: string,
  toIso: string,
): { measured_on: string; metrics: Record<string, number> } | null {
  const inRange = measurements
    .filter((m) => m.measured_on >= fromIso && m.measured_on <= toIso)
    .filter((m) => Object.keys(m.metrics ?? {}).length > 0)
    .sort((a, b) => (a.measured_on < b.measured_on ? 1 : -1));
  return inRange[0] ?? null;
}

export interface WeekHistoryRow {
  /** Понеделникът на седмицата. */
  monday: string;
  sunday: string;
  stats: PeriodStats;
}

/**
 * Последните `count` календарни седмици, приключващи със седмицата на `anchorIso`.
 * Седмици изцяло преди началото на програмата се изрязват — там няма какво да се брои.
 */
export function weeklyHistory(
  content: SportContent,
  sessions: SportSession[],
  anchorIso: string,
  startIso: string,
  count = 8,
): WeekHistoryRow[] {
  const rows: WeekHistoryRow[] = [];
  const anchorMonday = weekStartOf(anchorIso);
  const programMonday = weekStartOf(startIso);

  for (let i = 0; i < count; i++) {
    const monday = addDays(anchorMonday, -7 * i);
    if (monday < programMonday) break;
    const sunday = addDays(monday, 6);
    rows.push({ monday, sunday, stats: periodStats(content, sessions, monday, sunday) });
  }

  return rows;
}

/** „7 – 13 август" / „28 юли – 3 август" за заглавие на периода. */
const MONTHS_GENITIVE = [
  'януари', 'февруари', 'март', 'април', 'май', 'юни',
  'юли', 'август', 'септември', 'октомври', 'ноември', 'декември',
] as const;

export function formatWeekRange(mondayIso: string): string {
  const from = fromISO(mondayIso);
  const to = fromISO(addDays(mondayIso, 6));
  const fromMonth = MONTHS_GENITIVE[from.getMonth()];
  const toMonth = MONTHS_GENITIVE[to.getMonth()];
  return from.getMonth() === to.getMonth()
    ? `${from.getDate()} – ${to.getDate()} ${toMonth}`
    : `${from.getDate()} ${fromMonth} – ${to.getDate()} ${toMonth}`;
}

/**
 * Последно записаното число за упражнение преди дадена дата — показва се като
 * подсказка „миналия път", за да не се търси в историята.
 */
export function lastEntryFor(
  sessions: SportSession[],
  exerciseName: string,
  beforeIso: string,
): { date: string; weight?: number; reps?: number; time?: number } | null {
  const hits = sessions
    .filter(
      (s) => s.session_date < beforeIso && s.entries?.some((e) => e.name === exerciseName),
    )
    .sort((a, b) => (a.session_date < b.session_date ? 1 : -1));
  if (!hits.length) return null;
  const entry = hits[0].entries.find((e) => e.name === exerciseName)!;
  return { date: hits[0].session_date, weight: entry.weight, reps: entry.reps, time: entry.time };
}

/** Имената на всички упражнения, за които изобщо са записвани числа. */
export function trackedExerciseNames(sessions: SportSession[]): string[] {
  const set = new Set<string>();
  sessions.forEach((s) =>
    s.entries?.forEach((e) => {
      if (e.weight != null || e.reps != null || e.time != null) set.add(e.name);
    }),
  );
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'bg'));
}

/** Точките за графиката на едно упражнение — тегло, иначе повторения, иначе време. */
export function exerciseHistory(
  sessions: SportSession[],
  exerciseName: string,
): { date: string; value: number }[] {
  return sessions
    .filter((s) => s.entries?.some((e) => e.name === exerciseName))
    .sort((a, b) => (a.session_date < b.session_date ? -1 : 1))
    .map((s) => {
      const e = s.entries.find((x) => x.name === exerciseName)!;
      const value = e.weight ?? e.reps ?? e.time;
      return { date: s.session_date, value: value as number };
    })
    .filter((p) => p.value != null && Number.isFinite(p.value));
}
