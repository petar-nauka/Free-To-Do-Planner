-- 2026-08-01: Спорт — дневник за тренировки (страница /sport).
-- Прилага се РЪЧНО в Supabase SQL Editor. Идемпотентна (safe re-run).
--
-- Три таблици, всички строго per-user (user_id + RLS). НЯМА механизъм за споделяне —
-- за разлика от projects/tasks тук няма роля, покана или колона, през която друг
-- потребител да види чужди тренировки.
--
-- Включването на функцията НЕ е отделен флаг: чете се от sport_programs.is_active.
--   няма ред        → никога не е включвано (по подразбиране изключено)
--   is_active=false → изключено, данните остават
--   is_active=true  → включено

-- 1) Програмата (шаблонът) -----------------------------------------------------
create table if not exists public.sport_programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Моят първи месец',
  start_date  date not null default current_date,
  cycle_days  smallint not null default 28 check (cycle_days between 1 and 366),
  -- цялото дърво на програмата: blocks, week_pattern, weeks, rules, measures
  content     jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Най-много една АКТИВНА програма на потребител (неактивните са без ограничение).
create unique index if not exists sport_programs_one_active
  on public.sport_programs (user_id) where is_active;

alter table public.sport_programs enable row level security;

drop policy if exists "own sport programs select" on public.sport_programs;
create policy "own sport programs select" on public.sport_programs
  for select using (auth.uid() = user_id);
drop policy if exists "own sport programs insert" on public.sport_programs;
create policy "own sport programs insert" on public.sport_programs
  for insert with check (auth.uid() = user_id);
drop policy if exists "own sport programs update" on public.sport_programs;
create policy "own sport programs update" on public.sport_programs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own sport programs delete" on public.sport_programs;
create policy "own sport programs delete" on public.sport_programs
  for delete using (auth.uid() = user_id);

-- 2) Сесиите (какво реално е направено) ----------------------------------------
create table if not exists public.sport_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  program_id   uuid references public.sport_programs(id) on delete set null,
  session_date date not null,
  -- ключ на блок от content.blocks (morning, A, walk, потребителски…).
  -- Нарочно БЕЗ check-списък: блоковете се създават от потребителя.
  block_key    text not null check (length(btrim(block_key)) > 0),
  completed    boolean not null default false,
  completed_at timestamptz,
  -- реалните числа: [{ name, weight?, reps?, time? }, …]
  entries      jsonb not null default '[]'::jsonb,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, session_date, block_key)
);

create index if not exists sport_sessions_user_date
  on public.sport_sessions (user_id, session_date desc);

alter table public.sport_sessions enable row level security;

drop policy if exists "own sport sessions select" on public.sport_sessions;
create policy "own sport sessions select" on public.sport_sessions
  for select using (auth.uid() = user_id);
drop policy if exists "own sport sessions insert" on public.sport_sessions;
create policy "own sport sessions insert" on public.sport_sessions
  for insert with check (auth.uid() = user_id);
drop policy if exists "own sport sessions update" on public.sport_sessions;
create policy "own sport sessions update" on public.sport_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own sport sessions delete" on public.sport_sessions;
create policy "own sport sessions delete" on public.sport_sessions
  for delete using (auth.uid() = user_id);

-- 3) Мерките -------------------------------------------------------------------
-- Колоната е "metrics", НЕ "values" — values е резервирана дума в SQL.
create table if not exists public.sport_measurements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  weight      numeric(5,2),
  metrics     jsonb not null default '{}'::jsonb,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, measured_on)
);

alter table public.sport_measurements enable row level security;

drop policy if exists "own sport measurements select" on public.sport_measurements;
create policy "own sport measurements select" on public.sport_measurements
  for select using (auth.uid() = user_id);
drop policy if exists "own sport measurements insert" on public.sport_measurements;
create policy "own sport measurements insert" on public.sport_measurements
  for insert with check (auth.uid() = user_id);
drop policy if exists "own sport measurements update" on public.sport_measurements;
create policy "own sport measurements update" on public.sport_measurements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own sport measurements delete" on public.sport_measurements;
create policy "own sport measurements delete" on public.sport_measurements
  for delete using (auth.uid() = user_id);

-- 4) updated_at се вдига автоматично -------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sport_programs_touch on public.sport_programs;
create trigger sport_programs_touch before update on public.sport_programs
  for each row execute function public.touch_updated_at();

drop trigger if exists sport_sessions_touch on public.sport_sessions;
create trigger sport_sessions_touch before update on public.sport_sessions
  for each row execute function public.touch_updated_at();

drop trigger if exists sport_measurements_touch on public.sport_measurements;
create trigger sport_measurements_touch before update on public.sport_measurements
  for each row execute function public.touch_updated_at();
