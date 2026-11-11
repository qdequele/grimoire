-- Maps composed by Claude from a description (create-story, action "map"): counted per keeper and
-- month like the other AI features (MAP_MONTHLY_LIMIT in the function).
alter table public.ai_usage drop constraint ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check check (kind in ('profile', 'narrator', 'story-ideas', 'mcp-edit', 'map'));
