-- StudySync platform admin flag
-- After running, promote yourself:
--   update public.profiles set is_admin = true
--   where user_id = (select id from auth.users where email = 'you@example.com');

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists profiles_is_admin_idx
  on public.profiles (is_admin)
  where is_admin = true;
