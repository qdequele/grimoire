-- Maps composed by Claude from a description (create-story, action "map"): counted per keeper and
-- month like the other AI features (MAP_MONTHLY_LIMIT in the function).
--
-- First shipped as 20261111090000_ai_usage_map.sql, the same version as character_items: production
-- had applied character_items under that version, so the CLI kept trying to apply it again and every
-- deploy stopped there, and this one never ran. Its own version now; `if exists` so it also runs on a
-- database where it was applied under the old name (local stacks).
alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check check (kind in ('profile', 'narrator', 'story-ideas', 'mcp-edit', 'map'));
