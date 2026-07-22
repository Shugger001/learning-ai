-- Mirror of APPLY_TUTOR_IMPORT.sql

do $$ begin
  alter type public.content_type add value if not exists 'notion';
exception
  when duplicate_object then null;
end $$;
