-- Calendar / onboarding / editor invites

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

alter table public.share_invites
  drop constraint if exists share_invites_role_check;

alter table public.share_invites
  add constraint share_invites_role_check
  check (role in ('viewer', 'commenter', 'editor'));
