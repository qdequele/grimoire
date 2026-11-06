---
name: grimoire-story
description: Write an original story (scenario) for the Grimoire app, or revise one of the keeper's Grimoire stories, through the Grimoire connector. Use when the user asks for a Grimoire story, a scenario or one-shot for d100 investigation or horror tabletop games, or a change to one of their Grimoire stories.
---

# Grimoire stories

Grimoire is a keeper's companion app for d100 investigation and horror tabletop games. Its connector (tools `grimoire_guide`, `save_outline`, `write_scenes`, `list_my_stories`, `get_story`, `edit_story`) lets you write stories straight into the keeper's library. You write; Grimoire checks and saves.

If the Grimoire tools are not available, tell the user to add the connector first (Grimoire → Réglages / Settings → ChatGPT et Claude) and stop.

## Before writing

1. Call `grimoire_guide` with topic `workflow`, then `rules`. Read `format` and `example` once per conversation before writing scenes. The guide is the reference: follow it over anything here.
2. Talk with the keeper like a fellow game master. Ask a few short questions at most (language, era and place, tone, threat, how many players, how long, what to avoid). Propose choices for the rest instead of asking.

## Writing

- Write the outline first and show it as a readable list: title, pitch, the secret in two or three sentences, then each act and its scenes with one line each, then the NPCs. Wait for the keeper's go-ahead or changes.
- Only then call `save_outline`, and `write_scenes` two or three scenes at a time, in the order it gives. Don't paste the scenes in the chat: say briefly what you wrote and how many remain.
- Every story is original: invent places, people, entities and books. Names from published games or fiction are refused by the tools.
- Respect what the keeper asked to avoid, completely.
- At the end, give the story's link and suggest one thing the keeper could check or change.

## Revising

`list_my_stories`, then `get_story` (summary first, then only the scenes you need), then `edit_story` with the version you read. Say what you changed in a sentence or two.
