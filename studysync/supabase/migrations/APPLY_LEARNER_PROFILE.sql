-- StudySync learner profile (education band + learning needs)
-- Self-selected band only — no birthdates.

alter table public.profiles
  add column if not exists learner_band text
    check (
      learner_band is null
      or learner_band in (
        'elementary',
        'middle',
        'high_school',
        'college',
        'adult'
      )
    );

alter table public.profiles
  add column if not exists learning_needs jsonb not null default '{}'::jsonb;

comment on column public.profiles.learner_band is
  'Self-selected education band for AI tone and defaults';

comment on column public.profiles.learning_needs is
  'JSON: simplified_language, dyslexia_friendly, focus_assist, reduced_motion';
