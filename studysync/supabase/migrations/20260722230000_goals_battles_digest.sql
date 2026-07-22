-- Mirror of APPLY_GOALS_BATTLES_DIGEST.sql

alter table public.email_preferences
  add column if not exists coach_digest boolean not null default false;

alter table public.email_preferences
  add column if not exists coach_email text;

alter table public.email_preferences
  add column if not exists free_minutes integer not null default 25;

alter table public.email_preferences
  add column if not exists last_coach_sent_at timestamptz;

create table if not exists public.quiz_battles (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  host_id uuid not null references auth.users (id) on delete cascade,
  quiz_ids jsonb not null default '[]'::jsonb,
  duration_sec integer not null default 120,
  status text not null default 'active' check (status in ('active', 'finished')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists quiz_battles_room_idx on public.quiz_battles (room_id);
create index if not exists quiz_battles_active_idx on public.quiz_battles (room_id, status);

alter table public.quiz_battles enable row level security;

drop policy if exists "Authenticated read battles" on public.quiz_battles;
create policy "Authenticated read battles"
  on public.quiz_battles for select
  using (auth.uid() is not null);

drop policy if exists "Hosts create battles" on public.quiz_battles;
create policy "Hosts create battles"
  on public.quiz_battles for insert
  with check (auth.uid() = host_id);

drop policy if exists "Hosts update battles" on public.quiz_battles;
create policy "Hosts update battles"
  on public.quiz_battles for update
  using (auth.uid() = host_id);
