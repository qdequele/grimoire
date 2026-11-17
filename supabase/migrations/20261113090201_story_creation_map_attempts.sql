-- Story creator: the "scene-map" calls of a creation are counted (create-story reserves one before
-- each Claude call and refuses past twice STORY_MAPS_PER_STORY), failed and parallel ones included.
-- Additive and re-runnable.
alter table public.story_creations add column if not exists map_attempts integer not null default 0;
