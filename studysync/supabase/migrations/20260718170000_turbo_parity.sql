-- StudySync Turbo parity schema (run in Supabase SQL Editor)

-- Content types: youtube
do $$ begin
  alter type public.content_type add value if not exists 'youtube';
exception when duplicate_object then null;
end $$;

-- Studies: source URL + folder
alter table public.studies
  add column if not exists source_url text;

alter table public.studies
  add column if not exists folder_id uuid;

alter table public.studies
  add column if not exists share_token text unique;

-- Folders / courses
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists folders_user_id_idx on public.folders (user_id);

alter table public.studies
  drop constraint if exists studies_folder_id_fkey;

alter table public.studies
  add constraint studies_folder_id_fkey
  foreign key (folder_id) references public.folders (id) on delete set null;

-- Flashcard SRS
alter table public.flashcards
  add column if not exists ease numeric not null default 2.5;

alter table public.flashcards
  add column if not exists interval_days integer not null default 0;

alter table public.flashcards
  add column if not exists reps integer not null default 0;

alter table public.flashcards
  add column if not exists due_at timestamptz not null default now();

-- Quiz types
do $$ begin
  create type public.quiz_type as enum ('mcq', 'fill_blank', 'short_answer');
exception when duplicate_object then null;
end $$;

alter table public.quizzes
  add column if not exists quiz_type public.quiz_type not null default 'mcq';

-- Chat
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_study_id_idx on public.chat_messages (study_id);

-- Podcasts
create table if not exists public.podcasts (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null unique references public.studies (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'complete', 'error')),
  script text,
  audio_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Premade library
create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null default 'General',
  description text,
  content text not null,
  created_at timestamptz not null default now()
);

-- Profiles: billing / usage
alter table public.profiles
  add column if not exists plan text not null default 'free';

alter table public.profiles
  add column if not exists stripe_customer_id text;

alter table public.profiles
  add column if not exists uploads_used integer not null default 0;

alter table public.profiles
  add column if not exists chat_used integer not null default 0;

alter table public.profiles
  add column if not exists podcasts_used integer not null default 0;

-- RLS
alter table public.folders enable row level security;
alter table public.chat_messages enable row level security;
alter table public.podcasts enable row level security;
alter table public.library_items enable row level security;

drop policy if exists "Users manage own folders" on public.folders;
create policy "Users manage own folders"
  on public.folders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own chat" on public.chat_messages;
create policy "Users manage own chat"
  on public.chat_messages for all
  using (
    exists (
      select 1 from public.studies s
      where s.id = chat_messages.study_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.studies s
      where s.id = chat_messages.study_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own podcasts" on public.podcasts;
create policy "Users manage own podcasts"
  on public.podcasts for all
  using (
    exists (
      select 1 from public.studies s
      where s.id = podcasts.study_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.studies s
      where s.id = podcasts.study_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Anyone can read library" on public.library_items;
create policy "Anyone can read library"
  on public.library_items for select
  using (true);

-- Seed a few library guides
insert into public.library_items (title, subject, description, content)
select * from (values
  (
    'AP US History - Revolution Era',
    'History',
    'Core concepts from the American Revolution for APUSH review.',
    E'# American Revolution\n\n## Causes\n- Taxation without representation\n- Enlightenment ideas\n- Colonial identity\n\n## Key Events\n- Stamp Act (1765)\n- Boston Tea Party (1773)\n- Declaration of Independence (1776)\n- Treaty of Paris (1783)\n\n## Key People\n- Thomas Jefferson\n- George Washington\n- John Adams'
  ),
  (
    'Intro to Calculus - Limits & Derivatives',
    'Math',
    'Foundational calculus concepts for STEM students.',
    E'# Limits and Derivatives\n\n## Limits\nA limit describes the value a function approaches as the input approaches some value.\n\n## Derivative\nThe derivative is the instantaneous rate of change: f''(x) = lim(h→0) [f(x+h)-f(x)]/h\n\n## Rules\n- Power rule\n- Product rule\n- Chain rule'
  ),
  (
    'Biology - Cell Structure',
    'Biology',
    'Organelles and cell theory essentials.',
    E'# Cell Structure\n\n## Cell Theory\n1. All living things are made of cells\n2. Cells are the basic unit of life\n3. Cells arise from pre-existing cells\n\n## Organelles\n- Nucleus: genetic control\n- Mitochondria: ATP production\n- Ribosomes: protein synthesis\n- ER & Golgi: processing and transport'
  )
) as v(title, subject, description, content)
where not exists (select 1 from public.library_items limit 1);

-- Storage for podcasts
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'podcasts',
  'podcasts',
  true,
  104857600,
  array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
)
on conflict (id) do nothing;
