-- The in-game narrator (narrate Edge Function) is counted like the profile suggestions.
alter table public.ai_usage drop constraint ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check check (kind in ('profile', 'narrator'));
