-- 2026-10-22: Цвят на фона на задача (по модела на Google Keep).
-- Прилага се РЪЧНО в Supabase SQL Editor. Идемпотентна (safe re-run).
--
-- Стойността е ключ от палитрата във frontend/src/lib/taskColors.ts ('red', 'blue' …)
-- или NULL = без цвят. Непознат ключ просто не оцветява картата.

alter table public.tasks add column if not exists color text;
