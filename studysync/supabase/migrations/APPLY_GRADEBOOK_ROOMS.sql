-- Gradebook helpers + study rooms + email unsubscribe (safe to re-run)

alter table public.email_preferences
  add column if not exists unsubscribe_token text;

create unique index if not exists email_preferences_unsub_token_idx
  on public.email_preferences (unsubscribe_token)
  where unsubscribe_token is not null;

create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies (id) on delete cascade,
  host_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  join_code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_rooms_study_idx on public.study_rooms (study_id);
create index if not exists study_rooms_host_idx on public.study_rooms (host_id);

alter table public.study_rooms enable row level security;

drop policy if exists "Hosts manage study rooms" on public.study_rooms;
create policy "Hosts manage study rooms"
  on public.study_rooms for all
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

drop policy if exists "Authenticated read active rooms" on public.study_rooms;
create policy "Authenticated read active rooms"
  on public.study_rooms for select
  using (auth.uid() is not null and is_active = true);
