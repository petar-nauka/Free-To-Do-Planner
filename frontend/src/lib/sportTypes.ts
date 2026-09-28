/**
 * Типове за спортния дневник (/sport).
 *
 * Формата на програмата живее в `sport_programs.content` (jsonb) — нарочно, за да може
 * да се променя без миграция на базата. Затова тези типове описват съдържанието на
 * jsonb-а, а не колони.
 */

/** Какви полета за въвеждане показва упражнението. */
export type TrackKind = 'weight_reps' | 'reps' | 'time' | 'none';

export interface SportExercise {
  name: string;
  /** Целта като текст, напр. „12–15 на ръка". Само за четене от човек. */
  target: string;
  hint?: string;
  track: TrackKind;
}

/** Една сесия от деня: сутрешна рутина, тренировка, разходка, плуване… */
export interface SportBlock {
  title: string;
  /** Кратък ред под името в списъка за деня. */
  detail?: string;
  /** Времетраене като текст, напр. „10–15 мин.". */
  duration?: string;
  exercises: SportExercise[];
}

/** Кои блокове има даден ден от седмицата. Празен списък = почивен ден. */
export interface SportDayPattern {
  blocks: string[];
}

/** Прогресията за една от четирите седмици на цикъла. */
export interface SportWeek {
  label: string;
  strength: string;
  walks: string;
  goal: string;
  /** Бележка за подготовка, показва се само в блока `prep_block`. */
  prep?: string;
}

export interface SportRule {
  n: string;
  h: string;
  p: string;
}

export interface SportMeasureField {
  key: string;
  label: string;
  unit: string;
}

/** Съдържанието на `sport_programs.content`. */
export interface SportContent {
  version: number;
  title: string;
  rule: string;
  blocks: Record<string, SportBlock>;
  /** Точно 7 елемента: понеделник → неделя. */
  week_pattern: SportDayPattern[];
  weeks: SportWeek[];
  /** Ключ на блока, за който важи бележката за подготовка. Празно = без бележка. */
  prep_block?: string;
  rules: SportRule[];
  safety: { h: string; p: string };
  measures: SportMeasureField[];
}

/** Ред от `sport_programs`. */
export interface SportProgram {
  id: string;
  user_id: string;
  name: string;
  /** ISO дата (YYYY-MM-DD). Отправната точка за броенето на цикли. */
  start_date: string;
  cycle_days: number;
  content: SportContent;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Реално записано число за едно упражнение в една сесия. */
export interface SportEntry {
  name: string;
  weight?: number;
  reps?: number;
  time?: number;
}

/** Ред от `sport_sessions`. */
export interface SportSession {
  id: string;
  user_id: string;
  program_id: string | null;
  /** ISO дата (YYYY-MM-DD). */
  session_date: string;
  /** Ключ от `content.blocks`. */
  block_key: string;
  completed: boolean;
  completed_at: string | null;
  entries: SportEntry[];
  note: string | null;
}

/** Ред от `sport_measurements`. */
export interface SportMeasurement {
  id: string;
  user_id: string;
  measured_on: string;
  weight: number | null;
  metrics: Record<string, number>;
  note: string | null;
}
