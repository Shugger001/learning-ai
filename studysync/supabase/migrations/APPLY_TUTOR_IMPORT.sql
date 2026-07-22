-- Tutor/import helpers (safe to re-run)
-- Adds notion content type for Notion export imports

do $$ begin
  alter type public.content_type add value if not exists 'notion';
exception
  when duplicate_object then null;
end $$;
