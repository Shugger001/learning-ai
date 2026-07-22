-- Classes, assignments, email preferences (safe to re-run)

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists classes_owner_idx on public.classes (owner_id);

create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'student' check (role in ('teacher', 'student')),
  invite_token text unique,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (class_id, email)
);

create index if not exists class_members_class_idx on public.class_members (class_id);
create index if not exists class_members_email_idx on public.class_members (lower(email));

create table if not exists public.class_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  title text,
  due_at timestamptz,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (class_id, study_id)
);

create index if not exists class_assignments_class_idx on public.class_assignments (class_id);

create table if not exists public.assignment_progress (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.class_assignments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  cards_reviewed integer not null default 0,
  last_reviewed_at timestamptz,
  completed_at timestamptz,
  unique (assignment_id, user_id)
);

create table if not exists public.email_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  weekly_recap boolean not null default false,
  timezone text not null default 'UTC',
  last_weekly_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_assignments enable row level security;
alter table public.assignment_progress enable row level security;
alter table public.email_preferences enable row level security;

drop policy if exists "Owners manage classes" on public.classes;
create policy "Owners manage classes"
  on public.classes for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Members read classes" on public.classes;
create policy "Members read classes"
  on public.classes for select
  using (
    exists (
      select 1 from public.class_members m
      where m.class_id = id
        and (
          m.user_id = auth.uid()
          or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

drop policy if exists "Owners manage members" on public.class_members;
create policy "Owners manage members"
  on public.class_members for all
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.classes c
      where c.id = class_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Members read own membership" on public.class_members;
create policy "Members read own membership"
  on public.class_members for select
  using (
    user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "Owners manage assignments" on public.class_assignments;
create policy "Owners manage assignments"
  on public.class_assignments for all
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.classes c
      where c.id = class_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Members read assignments" on public.class_assignments;
create policy "Members read assignments"
  on public.class_assignments for select
  using (
    exists (
      select 1 from public.class_members m
      where m.class_id = class_id
        and (
          m.user_id = auth.uid()
          or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

drop policy if exists "Users manage own assignment progress" on public.assignment_progress;
create policy "Users manage own assignment progress"
  on public.assignment_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Teachers read assignment progress" on public.assignment_progress;
create policy "Teachers read assignment progress"
  on public.assignment_progress for select
  using (
    exists (
      select 1
      from public.class_assignments a
      join public.classes c on c.id = a.class_id
      where a.id = assignment_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Users manage email preferences" on public.email_preferences;
create policy "Users manage email preferences"
  on public.email_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
