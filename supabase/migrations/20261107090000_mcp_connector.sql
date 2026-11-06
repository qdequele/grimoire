-- MCP connector: keepers create and revise stories from ChatGPT or Claude (the mcp Edge Function).
-- The chat app's model writes, so these creations cost no tokens: they get their own monthly limit,
-- counted apart from the website creator's.
alter table public.story_creations
  add column source text not null default 'web' check (source in ('web', 'mcp'));

-- Story edits made through the connector, counted per day (MCP_EDITS_DAILY_LIMIT).
alter table public.ai_usage drop constraint ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check check (kind in ('profile', 'narrator', 'story-ideas', 'mcp-edit'));
