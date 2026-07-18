-- StudySync initial schema
-- Tables: profiles, studies, flashcards, quizzes, notes
-- Includes RLS policies, indexes, and auth trigger for new users (5 credits)

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.content_type as enum ('video', 'pdf', 'audio', 'text');
create type public.study_status as enum ('processing', 'complete', 'error');
create type public.flashcard_difficulty as enum ('easy', 'medium', 'hard');
create type public.detail_level as enum ('concise', 'detailed');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  credits integer not null default 5 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_user_id_idx on public.profiles (user_id);

-- ---------------------------------------------------------------------------
-- studies
-- ---------------------------------------------------------------------------
create table public.studies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  content_type public.content_type not null,
  status public.study_status not null default 'processing',
  file_url text,
  transcript_text text,
  flashcard_count integer not null default 20 check (flashcard_count > 0),
  detail_level public.detail_level not null default 'detailed',
  error_message text,
  processing_progress integer not null default 0 check (
    processing_progress >= 0
    and processing_progress <= 100
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index studies_user_id_idx on public.studies (user_id);
create index studies_status_idx on public.studies (status);
create index studies_created_at_idx on public.studies (created_at desc);

-- ---------------------------------------------------------------------------
-- flashcards
-- ---------------------------------------------------------------------------
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies (id) on delete cascade,
  question text not null,
  answer text not null,
  difficulty public.flashcard_difficulty not null default 'medium',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index flashcards_study_id_idx on public.flashcards (study_id);

-- ---------------------------------------------------------------------------
-- quizzes
-- ---------------------------------------------------------------------------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies (id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quizzes_options_is_array check (jsonb_typeof(options) = 'array')
);

create index quizzes_study_id_idx on public.quizzes (study_id);

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null unique references public.studies (id) on delete cascade,
  content text not null default '',
  summary text,
  mind_map jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_study_id_idx on public.notes (study_id);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger studies_set_updated_at
before update on public.studies
for each row execute function public.set_updated_at();

create trigger flashcards_set_updated_at
before update on public.flashcards
for each row execute function public.set_updated_at();

create trigger quizzes_set_updated_at
before update on public.quizzes
for each row execute function public.set_updated_at();

create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile with 5 credits on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, avatar_url, credits)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    5
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Credit helpers (1 credit per upload)
-- ---------------------------------------------------------------------------
create or replace function public.consume_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_credits integer;
begin
  select credits into current_credits
  from public.profiles
  where user_id = p_user_id
  for update;

  if current_credits is null or current_credits < 1 then
    return false;
  end if;

  update public.profiles
  set credits = credits - 1
  where user_id = p_user_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.studies enable row level security;
alter table public.flashcards enable row level security;
alter table public.quizzes enable row level security;
alter table public.notes enable row level security;

-- profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- studies
create policy "Users can view own studies"
  on public.studies for select
  using (auth.uid() = user_id);

create policy "Users can insert own studies"
  on public.studies for insert
  with check (auth.uid() = user_id);

create policy "Users can update own studies"
  on public.studies for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own studies"
  on public.studies for delete
  using (auth.uid() = user_id);

-- flashcards (via study ownership)
create policy "Users can view own flashcards"
  on public.flashcards for select
  using (
    exists (
      select 1 from public.studies s
      where s.id = flashcards.study_id and s.user_id = auth.uid()
    )
  );

create policy "Users can insert own flashcards"
  on public.flashcards for insert
  with check (
    exists (
      select 1 from public.studies s
      where s.id = flashcards.study_id and s.user_id = auth.uid()
    )
  );

create policy "Users can update own flashcards"
  on public.flashcards for update
  using (
    exists (
      select 1 from public.studies s
      where s.id = flashcards.study_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.studies s
      where s.id = flashcards.study_id and s.user_id = auth.uid()
    )
  );

create policy "Users can delete own flashcards"
  on public.flashcards for delete
  using (
    exists (
      select 1 from public.studies s
      where s.id = flashcards.study_id and s.user_id = auth.uid()
    )
  );

-- quizzes
create policy "Users can view own quizzes"
  on public.quizzes for select
  using (
    exists (
      select 1 from public.studies s
      where s.id = quizzes.study_id and s.user_id = auth.uid()
    )
  );

create policy "Users can insert own quizzes"
  on public.quizzes for insert
  with check (
    exists (
      select 1 from public.studies s
      where s.id = quizzes.study_id and s.user_id = auth.uid()
    )
  );

create policy "Users can update own quizzes"
  on public.quizzes for update
  using (
    exists (
      select 1 from public.studies s
      where s.id = quizzes.study_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.studies s
      where s.id = quizzes.study_id and s.user_id = auth.uid()
    )
  );

create policy "Users can delete own quizzes"
  on public.quizzes for delete
  using (
    exists (
      select 1 from public.studies s
      where s.id = quizzes.study_id and s.user_id = auth.uid()
    )
  );

-- notes
create policy "Users can view own notes"
  on public.notes for select
  using (
    exists (
      select 1 from public.studies s
      where s.id = notes.study_id and s.user_id = auth.uid()
    )
  );

create policy "Users can insert own notes"
  on public.notes for insert
  with check (
    exists (
      select 1 from public.studies s
      where s.id = notes.study_id and s.user_id = auth.uid()
    )
  );

create policy "Users can update own notes"
  on public.notes for update
  using (
    exists (
      select 1 from public.studies s
      where s.id = notes.study_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.studies s
      where s.id = notes.study_id and s.user_id = auth.uid()
    )
  );

create policy "Users can delete own notes"
  on public.notes for delete
  using (
    exists (
      select 1 from public.studies s
      where s.id = notes.study_id and s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime: progress updates on studies
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.studies;

-- ---------------------------------------------------------------------------
-- Storage bucket for lecture uploads
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lectures',
  'lectures',
  false,
  524288000, -- 500 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/x-m4a',
    'text/plain'
  ]
)
on conflict (id) do nothing;

create policy "Users can upload own lectures"
  on storage.objects for insert
  with check (
    bucket_id = 'lectures'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read own lectures"
  on storage.objects for select
  using (
    bucket_id = 'lectures'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own lectures"
  on storage.objects for delete
  using (
    bucket_id = 'lectures'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
