import { supabase } from '@/integrations/supabase/client';

/**
 * Достъп до спортните таблици.
 *
 * `integrations/supabase/types.ts` е авто-генериран и още не познава `sport_programs`,
 * `sport_sessions` и `sport_measurements` (миграцията се прилага ръчно в Supabase SQL
 * Editor — виж правило 1 в CLAUDE.md). Затова заявките минават през нетипизиран клиент.
 *
 * Останалите хукове в проекта пишат `(supabase as any)` при всяка заявка. Тук същият
 * компромис е събран на ЕДНО място: един коментар за ESLint вместо по един на заявка,
 * и една точка за смяна, когато типовете бъдат регенерирани.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sportDb = supabase as any;
