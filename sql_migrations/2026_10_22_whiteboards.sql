-- 2026-10-22: Бели дъски (Excalidraw) — нов таб в проекта до Бележки и Таблици.
-- Прилага се РЪЧНО в Supabase SQL Editor. Идемпотентна (safe re-run).
--
-- `data` пази сцената на Excalidraw: { elements: [...], appState: { viewBackgroundColor } }.
-- Достъпът следва проекта: виждат го членовете, пипат го собственикът и редакторите.

create table if not exists public.whiteboards (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null,
  name        text not null default 'Нова дъска',
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_whiteboards_project_id on public.whiteboards(project_id);

alter table public.whiteboards enable row level security;

drop policy if exists "whiteboards select" on public.whiteboards;
create policy "whiteboards select" on public.whiteboards
  for select using (public.is_project_member(auth.uid(), project_id));

drop policy if exists "whiteboards insert" on public.whiteboards;
create policy "whiteboards insert" on public.whiteboards
  for insert with check (user_id = auth.uid() and public.can_edit_project(auth.uid(), project_id));

drop policy if exists "whiteboards update" on public.whiteboards;
create policy "whiteboards update" on public.whiteboards
  for update using (public.can_edit_project(auth.uid(), project_id))
  with check (public.can_edit_project(auth.uid(), project_id));

drop policy if exists "whiteboards delete" on public.whiteboards;
create policy "whiteboards delete" on public.whiteboards
  for delete using (public.can_edit_project(auth.uid(), project_id));

drop trigger if exists update_whiteboards_updated_at on public.whiteboards;
create trigger update_whiteboards_updated_at
  before update on public.whiteboards
  for each row execute function public.update_updated_at_column();
