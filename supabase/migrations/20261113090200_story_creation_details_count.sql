-- Story creator: the "outline-details" calls of a creation are counted (create-story reserves one
-- before each Claude call and refuses past STORY_DETAILS_PER_STORY). Without a counter the action
-- could be repeated without end on one creation. Additive and re-runnable.
alter table public.story_creations add column if not exists details_count integer not null default 0;
