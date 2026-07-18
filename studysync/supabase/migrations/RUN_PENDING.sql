-- StudySync: run this once in the Supabase SQL Editor
-- Project → SQL → New query → Paste → Run

-- 1) Quiz question count per study
alter table public.studies
  add column if not exists quiz_count integer not null default 10;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'studies_quiz_count_check'
  ) then
    alter table public.studies
      add constraint studies_quiz_count_check check (quiz_count > 0);
  end if;
end $$;

-- 2) Allow PowerPoint uploads in storage
update storage.buckets
set allowed_mime_types = array[
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
  'text/plain',
  'application/octet-stream'
]
where id = 'lectures';
