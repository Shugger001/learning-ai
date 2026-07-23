-- StudySync: focus minutes, flashcard occlusions, class exit tickets
-- Run in Supabase SQL Editor if remote schema lags behind the app.

-- Daily focus / study minutes
alter table public.study_activity
  add column if not exists minutes_studied integer not null default 0;

-- Image occlusion flashcards
alter table public.flashcards
  add column if not exists image_url text,
  add column if not exists occlusion jsonb default '[]'::jsonb;

-- Teacher exit tickets on assignments
alter table public.class_assignments
  add column if not exists exit_ticket_required boolean not null default false,
  add column if not exists exit_ticket_quiz_ids jsonb not null default '[]'::jsonb;

alter table public.assignment_progress
  add column if not exists exit_ticket_score integer,
  add column if not exists exit_ticket_total integer,
  add column if not exists exit_ticket_at timestamptz;
