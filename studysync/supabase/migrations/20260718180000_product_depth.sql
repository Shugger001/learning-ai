-- Product depth: usage period reset + quiz attempt history

alter table public.profiles
  add column if not exists usage_reset_at timestamptz not null default now();

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  score integer not null default 0,
  total integer not null default 0,
  wrong_quiz_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_user_study_created_idx
  on public.quiz_attempts (user_id, study_id, created_at desc);

alter table public.quiz_attempts enable row level security;

drop policy if exists "Users manage own quiz attempts" on public.quiz_attempts;
create policy "Users manage own quiz attempts"
  on public.quiz_attempts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
