-- Spaced drill podcasts, class announcements, assignment reminders (safe to re-run)

create table if not exists public.spaced_episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_date date not null,
  study_id uuid references public.studies (id) on delete set null,
  card_ids jsonb not null default '[]'::jsonb,
  script text,
  audio_url text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'complete', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, episode_date)
);

create index if not exists spaced_episodes_user_idx
  on public.spaced_episodes (user_id, episode_date desc);

alter table public.spaced_episodes enable row level security;

drop policy if exists "Users manage own spaced episodes" on public.spaced_episodes;
create policy "Users manage own spaced episodes"
  on public.spaced_episodes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.class_announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists class_announcements_class_idx
  on public.class_announcements (class_id, created_at desc);

alter table public.class_announcements enable row level security;

drop policy if exists "Members read announcements" on public.class_announcements;
create policy "Members read announcements"
  on public.class_announcements for select
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_announcements.class_id
        and (
          c.owner_id = auth.uid()
          or exists (
            select 1 from public.class_members m
            where m.class_id = c.id
              and m.user_id = auth.uid()
              and m.accepted_at is not null
          )
        )
    )
  );

drop policy if exists "Teachers post announcements" on public.class_announcements;
create policy "Teachers post announcements"
  on public.class_announcements for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.classes c
      where c.id = class_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Teachers delete announcements" on public.class_announcements;
create policy "Teachers delete announcements"
  on public.class_announcements for delete
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_announcements.class_id
        and c.owner_id = auth.uid()
    )
  );

alter table public.email_preferences
  add column if not exists assignment_reminders boolean not null default true;

alter table public.email_preferences
  add column if not exists last_due_reminder_at timestamptz;
