-- 2026-07-23: Per-user AI/STT настройки + сигурно съхранение на ключове (Вариант A).
-- Прилага се РЪЧНО в Supabase SQL Editor. Идемпотентна (safe re-run).

-- 1) Несекретна конфигурация (браузърът чете/пише своя ред) --------------------
create table if not exists public.user_ai_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  stt_provider     text not null default 'soniox',
  stt_model        text not null default 'stt-rt-v5',
  stt_language     text not null default 'bg',
  stt_translate_to text,
  ai_provider      text not null default 'ollama',
  ai_base_url      text,
  ai_model         text not null default 'deepseek-v4-flash',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.user_ai_settings enable row level security;

drop policy if exists "own ai settings select" on public.user_ai_settings;
create policy "own ai settings select" on public.user_ai_settings
  for select using (auth.uid() = user_id);
drop policy if exists "own ai settings insert" on public.user_ai_settings;
create policy "own ai settings insert" on public.user_ai_settings
  for insert with check (auth.uid() = user_id);
drop policy if exists "own ai settings update" on public.user_ai_settings;
create policy "own ai settings update" on public.user_ai_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own ai settings delete" on public.user_ai_settings;
create policy "own ai settings delete" on public.user_ai_settings
  for delete using (auth.uid() = user_id);

-- 2) Секрети (браузърът НЕ чете; само service_role) ----------------------------
create table if not exists public.user_ai_secrets (
  user_id    uuid not null references auth.users(id) on delete cascade,
  provider   text not null,
  api_key    text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.user_ai_secrets enable row level security;
-- Нарочно БЕЗ политики за роля authenticated → браузърът няма достъп.
-- service_role (edge функции) заобикаля RLS и чете суровия ключ.

-- Belt-and-suspenders: изричен revoke, дори RLS вече да го покрива.
-- service_role заобикаля RLS/GRANT-овете и запазва достъп.
revoke all on public.user_ai_secrets from anon, authenticated;

-- 3) Запис на секрет — SECURITY DEFINER, ограничен до текущия потребител --------
create or replace function public.set_ai_secret(p_provider text, p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_provider is null or length(p_provider) = 0 then
    raise exception 'provider required';
  end if;
  if p_key is null or length(p_key) = 0 then
    raise exception 'key required';
  end if;
  insert into public.user_ai_secrets (user_id, provider, api_key, updated_at)
  values (auth.uid(), p_provider, p_key, now())
  on conflict (user_id, provider)
  do update set api_key = excluded.api_key, updated_at = now();
end;
$$;

revoke all on function public.set_ai_secret(text, text) from public;
grant execute on function public.set_ai_secret(text, text) to authenticated;

-- 4) Статус на секрет (без да връща ключа) — само зададен ли е + последни 4 ------
create or replace function public.get_ai_secret_status()
returns table(provider text, is_set boolean, last4 text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  return query
    select s.provider, true as is_set, right(s.api_key, 4) as last4
    from public.user_ai_secrets s
    where s.user_id = auth.uid();
end;
$$;

revoke all on function public.get_ai_secret_status() from public;
grant execute on function public.get_ai_secret_status() to authenticated;
