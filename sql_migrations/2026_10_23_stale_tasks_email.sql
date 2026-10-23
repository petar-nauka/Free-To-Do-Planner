-- 2026-10-23: Седмичен имейл за задачи, непипани 30+ дни.
-- Прилага се РЪЧНО в Supabase SQL Editor. Идемпотентна (safe re-run).
--
-- Писмото се праща в понеделник сутрин от edge функцията `stale-tasks-digest`
-- (frontend/supabase/functions/stale-tasks-digest) — пуска я cron на сървъра.
-- Получател е създателят на задачата. Писмо има само ако И двата ключа са включени:
--   profiles.stale_tasks_email — личният ключ (Настройки), всеки си го сменя сам;
--   projects.stale_tasks_email — ключът на проекта (редакция на проекта), сменя го собственикът.
--
-- Функцията ползва и два реда в app_settings (не са нужни предварително):
--   app_url                    — адресът на сайта, за линковете в писмото (без него писмото е без линкове);
--   stale_tasks_last_sent_week — седмицата на последното изпращане; пази от второ писмо в същата седмица.

alter table public.profiles add column if not exists stale_tasks_email boolean not null default true;
alter table public.projects add column if not exists stale_tasks_email boolean not null default true;
