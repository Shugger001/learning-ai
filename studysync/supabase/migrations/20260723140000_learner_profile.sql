-- StudySync learner profile (education band + learning needs)

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
