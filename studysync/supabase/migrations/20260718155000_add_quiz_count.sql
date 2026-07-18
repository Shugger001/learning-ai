-- Allow clients to choose quiz question count per study
alter table public.studies
  add column if not exists quiz_count integer not null default 10
  check (quiz_count > 0);
