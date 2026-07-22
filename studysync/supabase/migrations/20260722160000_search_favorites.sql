-- Favorites for StudySync

alter table public.studies
  add column if not exists is_favorite boolean not null default false;

create index if not exists studies_user_favorite_idx
  on public.studies (user_id, is_favorite desc, updated_at desc);
