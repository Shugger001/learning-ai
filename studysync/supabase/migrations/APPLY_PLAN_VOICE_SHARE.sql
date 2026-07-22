-- Week plans + progress share token (safe to re-run)

alter table public.profiles
  add column if not exists progress_share_token text;

create unique index if not exists profiles_progress_share_token_idx
  on public.profiles (progress_share_token)
  where progress_share_token is not null;

create table if not exists public.study_week_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  sessions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists study_week_plans_user_idx
  on public.study_week_plans (user_id);

alter table public.study_week_plans enable row level security;

drop policy if exists "Users manage own week plans" on public.study_week_plans;
create policy "Users manage own week plans"
  on public.study_week_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
