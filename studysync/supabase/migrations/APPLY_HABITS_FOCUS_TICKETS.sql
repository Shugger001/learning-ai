-- StudySync: focus minutes, flashcard occlusions, class exit tickets
-- Safe to re-run. Creates study_activity if earlier progress migration was skipped.

-- ---------------------------------------------------------------------------
-- Daily study activity (needed for focus minutes + goals)
-- ---------------------------------------------------------------------------
create table if not exists public.study_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  cards_reviewed integer not null default 0,
  quizzes_taken integer not null default 0,
  minutes_studied integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, activity_date)
);

create index if not exists study_activity_user_date_idx
  on public.study_activity (user_id, activity_date desc);

alter table public.study_activity enable row level security;

drop policy if exists "Users manage own study activity" on public.study_activity;
create policy "Users manage own study activity"
  on public.study_activity for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.study_activity
  add column if not exists minutes_studied integer not null default 0;

alter table public.profiles
  add column if not exists current_streak integer not null default 0;

alter table public.profiles
  add column if not exists longest_streak integer not null default 0;

alter table public.profiles
  add column if not exists last_study_date date;

-- ---------------------------------------------------------------------------
-- Image occlusion flashcards
-- ---------------------------------------------------------------------------
alter table public.flashcards
  add column if not exists image_url text,
  add column if not exists occlusion jsonb default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Teacher exit tickets (only if classes migrations already applied)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.class_assignments') is not null then
    alter table public.class_assignments
      add column if not exists exit_ticket_required boolean not null default false;
    alter table public.class_assignments
      add column if not exists exit_ticket_quiz_ids jsonb not null default '[]'::jsonb;
  end if;

  if to_regclass('public.assignment_progress') is not null then
    alter table public.assignment_progress
      add column if not exists exit_ticket_score integer;
    alter table public.assignment_progress
      add column if not exists exit_ticket_total integer;
    alter table public.assignment_progress
      add column if not exists exit_ticket_at timestamptz;
  end if;
end $$;
