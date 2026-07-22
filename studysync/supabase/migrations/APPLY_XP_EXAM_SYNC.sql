-- XP, exam campaigns, class deck sync (safe to re-run)

alter table public.profiles
  add column if not exists xp integer not null default 0;

alter table public.profiles
  add column if not exists level integer not null default 1;

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_key text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

create index if not exists user_achievements_user_idx
  on public.user_achievements (user_id);

alter table public.user_achievements enable row level security;

drop policy if exists "Users read own achievements" on public.user_achievements;
create policy "Users read own achievements"
  on public.user_achievements for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own achievements" on public.user_achievements;
create policy "Users insert own achievements"
  on public.user_achievements for insert
  with check (auth.uid() = user_id);

create table if not exists public.exam_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  exam_at date not null,
  study_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exam_campaigns_user_idx
  on public.exam_campaigns (user_id);

create index if not exists exam_campaigns_exam_at_idx
  on public.exam_campaigns (user_id, exam_at);

alter table public.exam_campaigns enable row level security;

drop policy if exists "Users manage own exam campaigns" on public.exam_campaigns;
create policy "Users manage own exam campaigns"
  on public.exam_campaigns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.studies
  add column if not exists source_study_id uuid references public.studies (id) on delete set null;

alter table public.studies
  add column if not exists pack_version integer not null default 1;

create index if not exists studies_source_study_idx
  on public.studies (source_study_id);

alter table public.flashcards
  add column if not exists content_key text;

alter table public.quizzes
  add column if not exists content_key text;

create index if not exists flashcards_content_key_idx
  on public.flashcards (study_id, content_key);

create index if not exists quizzes_content_key_idx
  on public.quizzes (study_id, content_key);

create table if not exists public.assignment_copies (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.class_assignments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  synced_at timestamptz,
  teacher_pack_version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (assignment_id, user_id)
);

create index if not exists assignment_copies_user_idx
  on public.assignment_copies (user_id);

create index if not exists assignment_copies_study_idx
  on public.assignment_copies (study_id);

alter table public.assignment_copies enable row level security;

drop policy if exists "Users manage own assignment copies" on public.assignment_copies;
create policy "Users manage own assignment copies"
  on public.assignment_copies for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Teachers read class assignment copies" on public.assignment_copies;
create policy "Teachers read class assignment copies"
  on public.assignment_copies for select
  using (
    exists (
      select 1
      from public.class_assignments ca
      join public.classes c on c.id = ca.class_id
      where ca.id = assignment_copies.assignment_id
        and c.owner_id = auth.uid()
    )
  );
