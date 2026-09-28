import type { CellData, ColumnDef, Spreadsheet } from '@/hooks/useSpreadsheets';

/**
 * Какво се записва в базата при дублиране на таблица.
 *
 * Нарочно е отделно от самата заявка: тук е лесно да се сбърка тихо (да се
 * забрави поле, да се пренесе `id` или „архивирано"), затова е чиста функция
 * с тестове, а не няколко реда, скрити вътре в мутацията.
 */
export interface DuplicatePayload {
  project_id: string;
  user_id: string;
  name: string;
  data: CellData[][];
  column_definitions: ColumnDef[];
  freeze_header: boolean;
}

const UNTITLED = 'Untitled';

/** `Центрове` → `Copy Центрове`. Буквално, както е поискано. */
export function duplicateName(name?: string | null): string {
  return `Copy ${name?.trim() || UNTITLED}`;
}

export function buildDuplicatePayload(
  source: Spreadsheet,
  target: { projectId: string; userId: string },
): DuplicatePayload {
  return {
    project_id: target.projectId,
    user_id: target.userId,
    name: duplicateName(source.name),
    // Дълбоко копие: иначе копието и оригиналът сочат към едни и същи редове в
    // паметта и редакцията на едното мълчаливо променя другото в кеша.
    data: source.data.map((row) => row.map((cell) => ({ ...cell }))),
    column_definitions: source.column_definitions.map((col) => ({ ...col })),
    freeze_header: source.freeze_header ?? false,
    // `id`, `created_at`, `updated_at` ги дава базата.
    // `archived_at` НЕ се пренася — копие на архивирана таблица тръгва активно,
    // иначе би се родило невидимо в списъка.
  };
}
