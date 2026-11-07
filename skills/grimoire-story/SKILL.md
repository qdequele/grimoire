---
name: grimoire-story
description: Write an original story (scenario) for the Grimoire app, revise one of the keeper's Grimoire stories, or draw pictures for it (scene backgrounds, handouts, maps), through the Grimoire connector. Use when the user asks for a Grimoire story, a scenario or one-shot for d100 investigation or horror tabletop games, a change to one of their Grimoire stories, or pictures for one.
---

# Grimoire stories

Grimoire is a keeper's companion app for d100 investigation and horror tabletop games. Its connector (tools `grimoire_guide`, `save_outline`, `write_scenes`, `list_my_stories`, `get_story`, `edit_story`, `save_image`) lets you write stories straight into the keeper's library. You write; Grimoire checks and saves.

If the Grimoire tools are not available, tell the user to add the connector first (Grimoire → Réglages / Settings → ChatGPT et Claude) and stop.

## Before writing

1. Call `grimoire_guide` with topic `workflow`, then `rules`. Read `format` and `example` once per conversation before writing scenes. The guide is the reference: follow it over anything here.
2. Talk with the keeper like a fellow game master. Ask a few short questions at most (language, era and place, tone, threat, how many players, how long, what to avoid). Propose choices for the rest instead of asking.

## Writing

- Write the outline first and show it as a readable list: title, pitch, the secret in two or three sentences, then each act and its scenes with one line each, then the NPCs. Wait for the keeper's go-ahead or changes.
- Only then call `save_outline`, and `write_scenes` two or three scenes at a time, in the order it gives. Don't paste the scenes in the chat: say briefly what you wrote and how many remain.
- Every story is original: invent places, people, entities and books. Names from published games or fiction are refused by the tools.
- Respect what the keeper asked to avoid, completely.
- At the end, give the story's link and suggest one thing the keeper could check or change, and offer pictures (below).

## Revising

`list_my_stories`, then `get_story` (summary first, then only the scenes you need), then `edit_story` with the version you read. Say what you changed in a sentence or two.

## Pictures

You draw pictures in SVG; `save_image` stores them in the story and the keeper shows them on the table's ambiance screen. Read `grimoire_guide` topic `images` before the first one: its technical rules are enforced, and a refused SVG comes back with the reason.

- **Offer, don't impose.** Once the scenes are written, propose two or three scene backgrounds for key moments and a picture for each handout that is a document (letter, clipping, telegram, map, floor plan). Draw only what the keeper accepts.
- **Built-in décors first.** If a scene takes place in a church, graveyard, crypt, castle, manor, library, police station, forest, harbour or street, set its `screen.place` with `edit_story` `set_screen` instead of drawing: those décors are animated and fit every atmosphere and time of day.
- **Scene backgrounds**: `viewBox="0 0 1600 900"`, a full-frame background rectangle first; dark and atmospheric (night, dusk, fog), layered silhouettes from a hazy far layer to an almost black near layer, gradients for sky and glows, a few warm lights. No text, no detailed faces, no spoilers: players see it. The screen adds fog, rain, grain and a slow pan and zoom on top, so keep the subject central and away from the edges.
- **Handouts**: a sheet of aged paper (off-white or ochre, darker edges, a few stains and folds, worn edges) with the words in `<text>`, in the story's language, using generic font families only (`cursive` for handwriting, `serif` for print, `monospace` for typewriters). Keep the same words in the handout's `text` field. Create the handout first with `edit_story` `put_handout`, then `save_image` with `attach: { "handout": "<id>" }`.
- **Maps and floor plans**: top-down ink on paper, thick walls, door gaps with swing arcs, stairs as hatching, a label in each room, a compass rose, a scale bar and a small legend. Only what the investigators know.
- **Technical**: one root `<svg>` with a viewBox, at most 300 KB; shapes, paths, text, gradients, patterns, clip paths, masks, filters (no `feImage`); no scripts, event attributes, `foreignObject`, `<image>`, links, animation, DOCTYPE, editor namespaces or external URLs (`href` and `url()` only to `#id`; plain CSS, no `@import` or `@font-face`). Whole-number coordinates, `<symbol>` and `<use>` for repeated shapes.
- **Calls**: `name` like `harbour-night.svg` (same name again replaces it), the `version` from `get_story` or from the previous call's answer, `svg`, and `attach: { "scene": "<id>" }` or `{ "handout": "<id>" }`. `attach` without `svg` reuses a stored picture; `remove: true` deletes one. Don't paste the SVG in the chat: say what you drew.
