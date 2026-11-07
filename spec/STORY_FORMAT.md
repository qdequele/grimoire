# Grimoire story format — v1

A **story pack** is a folder that Grimoire can open and play. The engine never contains story content: everything specific to a scenario lives in the pack.

```
the-silent-light/
  story.json        required — the whole story (validated by story.schema.json)
  images/           optional — maps, portraits, handout scans
  sounds/           optional — story-specific sounds (rare; prefer the shared library)
```

`story.json` must declare `"format": "grimoire-story/1"`. The full machine-readable definition is [`story.schema.json`](story.schema.json); the sample is [`stories/the-silent-light`](../stories/the-silent-light/story.json).

---

## 1. Top-level structure

| Key | Required | What it is |
|---|---|---|
| `format` | yes | Always `grimoire-story/1` for this version. |
| `meta` | yes | Title, language, players, duration, author, license… |
| `overview` | | The keeper's one-screen briefing (secret, steps, branches). |
| `acts` | yes | Ordered acts, each with ordered scenes. |
| `npcs` | | People and creatures, with optional combat stats. |
| `handouts` | | Documents given to players (text and/or image). |
| `pregens` | | Pre-generated investigators. |
| `knowledge` | | "Who knows what" table: which skill helps with which need. |
| `trackers` | | Counters shown in the side panel (ritual progress, nights, turns). |
| `sounds` | | Story-specific sounds, each with a fallback to the shared library. |

All ids are **kebab-case** (`the-lamp`, `drowned-child`) and must be unique within their list. Ids are what links everything together, so never change them once a story is in use: saved games refer to scene ids.

## 2. `meta`

| Field | Notes |
|---|---|
| `id`, `title`, `lang` | Required. `lang` is the language of every text in the file (`en`, `fr`…). One file = one language; a translation is a separate pack. |
| `summary` | Spoiler-free pitch for the story picker. |
| `players` | `{ "min": 1, "max": 4 }` |
| `duration`, `era`, `setting` | Free text. |
| `system` | `d100` (only value supported in v1). |
| `author`, `source`, `version`, `tags`, `contentWarnings` | Free text / lists. |
| `license` | `CC-BY-4.0`, `CC0`… for shareable stories. **Use `private` for anything imported from a book you own**: Grimoire will refuse to export or share those. |

## 3. `overview`

The briefing the keeper reads five minutes before playing.

- `secret` — what is really going on.
- `steps` — the main beats in order (use `[[scene-id]]` links).
- `mustNotMiss` — clues or actions without which the story can't end.
- `branches` — player choices that change the outcome.
- `ifStuck` — nudges, NPC relaunches.
- `keeperTips` — tone, pacing, how to play key NPCs.

## 4. Acts and scenes

```json
{ "id": "rock", "title": "Gull Rock", "scenes": [ … ] }
```

A **scene** is one screen in the app.

| Field | Shown as |
|---|---|
| `title`, `ref`, `lead` | Header: title, source page (optional), one-line summary. |
| `readAloud` | Gold frame "Read to the players". One string per paragraph. |
| `flow` | "Scene flow": numbered steps (see below). |
| `notes` | Extra reference blocks (`{ title, items[] }`) that don't fit a step: room contents, timelines. |
| `npcs` | NPC ids shown in the "Scene NPCs" panel. |
| `handouts` | Handout ids available in this scene. |
| `rolls` | Quick roll buttons not tied to a step (damage, SAN). |
| `ambience` | Up to 3 sound ids, played together as a loop. |
| `sfx` | Sound-effect buttons for this scene. |
| `next` | Likely next scene ids (defaults to the following scene). |
| `images` | `{ src, caption, keeperOnly }` maps or pictures. |
| `screen` | What the table's ambiance screen shows during this scene (see §4.5). |
| `optional` | `true` for skippable scenes. |
| `notesFirst` | Show `notes` before the read-aloud text. |
| `notesAfter` | Reference blocks shown after the flow. |
| `callout` | A highlighted keeper note at the end of the scene. |
| `npcTable` | `true` to show the story's NPC reference table in this scene. |

### 4.1 Flow steps

The heart of a scene: what happens, in order, with the rolls and their outcomes.

```json
{
  "title": "Search the keeper's room",
  "text": "What to describe or what the players can do.",
  "roll": { "type": "skill", "options": ["spot-hidden"] },
  "success": "What they get.",
  "failure": "What happens otherwise.",
  "pushed": "If they push the roll and fail again.",
  "extra": "Side note (muted).",
  "goto": ["the-lamp"]
}
```

Only `title` is required. Write steps in **play order**; one step = one decision or one roll.

**Choices.** When the players can go several ways at one point, write the step that sets up the choice, then one step per choice with `branch` naming it: the app shows them as lettered options (A, B, C) under that step.

```json
{ "title": "Clémence", "text": "She stands in the water and asks for her letters." },
{ "title": "The letters", "branch": "If she gives back the letters", "success": "…" },
{ "title": "Into the sea", "branch": "If she has no letters", "roll": { "type": "characteristic", "options": ["POW"] } }
```

A step whose title starts with "If …" (or "Si …" in French) counts as a choice too.

Instead of a structured `roll`, a step may carry `test`: the roll in plain words (`"Charme ou Persuasion"`, `"Bibliothèque (pour retrouver la date)"`, `"SAN 0/1D6"`). The app turns it into roll buttons; text in brackets is a hint and is dropped.

### 4.2 Rolls

| `type` | Uses | Example |
|---|---|---|
| `skill` | `options` (skill ids), `difficulty`, `bonus` | `{ "type": "skill", "options": ["charm", "persuade"] }` |
| `characteristic` | `options` (codes) | `{ "type": "characteristic", "options": ["STR"] }` |
| `luck` | — | `{ "type": "luck" }` |
| `san` | `san` | `{ "type": "san", "san": "1/1D6", "label": "Seeing the body" }` |
| `damage` | `dice` | `{ "type": "damage", "dice": "1D8+1D4" }` |
| `opposed` | `options`, `against: { npc, skill }` | `{ "type": "opposed", "options": ["fighting-brawl"], "against": { "npc": "elias", "skill": "dodge" } }` |
| `group` | `options` — everyone rolls | `{ "type": "group", "options": ["listen"] }` |

- `options` lists alternatives: the player picks one ("Charm **or** Persuade").
- `difficulty`: `regular` (default), `hard` (½), `extreme` (⅕).
- `bonus`: `1`/`2` bonus dice, `-1`/`-2` penalty dice.
- Every roll becomes a clickable button: the keeper picks investigators and Grimoire rolls, logs and applies the result.

### 4.3 Skill ids and characteristic codes

Characteristics: `STR` `CON` `SIZ` `DEX` `APP` `INT` `POW` `EDU`, plus `luck` and `san`.

Skills (ids are language-neutral; the app shows the localized name):

`accounting` `anthropology` `appraise` `archaeology` `art-craft` `charm` `climb` `credit-rating` `cthulhu-mythos` `disguise` `dodge` `drive-auto` `electrical-repair` `fast-talk` `fighting-brawl` `firearms-handgun` `firearms-rifle` `first-aid` `history` `intimidate` `jump` `language-other` `language-own` `law` `library-use` `listen` `locksmith` `mechanical-repair` `medicine` `natural-world` `navigate` `occult` `operate-heavy-machinery` `persuade` `pilot` `psychoanalysis` `psychology` `ride` `science` `sleight-of-hand` `spot-hidden` `stealth` `survival` `swim` `throw` `track`

Specialisations use a colon: `language-other:latin`, `science:chemistry`, `art-craft:photography`. Unknown ids are allowed (the keeper types the value by hand).

### 4.4 Rich text

All long text fields accept a small, safe subset — **no HTML**:

| Syntax | Result |
|---|---|
| `**bold**`, `*italic*` | Emphasis |
| `[[scene-id]]` / `[[scene-id\|label]]` | Link to another scene |
| `{{npc:id}}` | NPC name, with its card on hover |
| `{{handout:id}}` | Handout title, opens it |
| `\n` | Line break (in handouts) |

Dice (`1D6`) and SAN losses (`1/1D4`) are detected automatically and get glossary tooltips.

### 4.5 Ambiance screen

The keeper can open an **ambiance screen** on a TV or tablet in the middle of the table: a slowly living picture for the current scene, and the handouts the keeper pushes to it. A scene may say what it shows:

```json
"screen": { "image": "images/harbour-fog.jpg", "preset": "fog" }
```

or, for a fire burning in the picture's fireplace:

```json
"screen": { "image": "images/great-hall.jpg", "preset": "hearth", "fire": { "x": 0.5, "y": 0.82, "width": 0.25 } }
```

| Field | Meaning |
|---|---|
| `image` | Background picture (relative path in `images/`), shown full screen with a slow pan and zoom. Never a spoiler: players see it. |
| `preset` | Living layers over it (see below). Default: picked from the scene's ambience sounds (`fireplace` → `hearth`). |
| `place` | Drawn scenery, shown when there is no picture: `church`, `graveyard`, `crypt`, `castle`, `manor`, `library`, `police` (a police station), `forest`, `harbour`, `street`, `asylum`, `station` (a railway station), `swamp`, `dig` (a desert excavation), `mountain`, `museum`, `cavern` (a cave, an underground lake), `farm`, `ship` (on deck, at sea), `fair` (a fairground), `mine`, `moor` (standing stones on a moor). Its silhouettes take the preset's colours (a graveyard in the fog, a manor in the storm). Default: guessed from the scene's title ("The old church", "Le cimetière"…), else none. |
| `time` | Time of day: `day`, `dusk` or `night`. It sets the light (sky colours, sun or moon, lit windows) and goes with any preset: a church in the `rain` by `day`, a street in the `snow` at `night`. Default: guessed from the scene's title ("Midnight", "L'aube"…) or its day/night sounds, else the preset's own (`night`, except `dust`: `day`). A `crypt` or a `cavern` stays dark. |
| `fire` | For `hearth`: where the fire burns in the picture, `x`/`y` the base centre and `width`, as fractions of the picture (0 to 1). The flames, embers and their flickering light are drawn there and follow the pan and zoom. Default: bottom centre. |

Presets:

| Preset | Looks like |
|---|---|
| `fog` | Mist drifting low over the ground |
| `rain` | Rain falling, a little mist |
| `candle` | Warm flickering light from below, a few embers |
| `hearth` | A live fire (at `fire`), its light flickering |
| `night` | Deep blue, motes in the dark |
| `storm` | Heavy rain, lightning now and then |
| `dust` | Dust motes in warm daylight |
| `snow` | Snow falling in a cold night, pale mist |
| `abyss` | Deep water: green-blue murk, light from the surface, bubbles rising |
| `ritual` | A sickly green glow breathing at the centre, faint turning rays, drifting spores |
| `nightmare` | Dark reds, heavy grain, the screen's edges throbbing like a heartbeat |
| `bulb` | A bare electric bulb that keeps failing (asylum, hospital, basement) |
| `blaze` | A building on fire: red glow from below, dark smoke, a storm of embers |

The last six are never picked from sounds: set them in `screen.preset`, or the keeper chooses them during the game.

All are optional. Without `preset`, the app picks one from the scene's `ambience` sounds (rain → `rain`, fireplace → `hearth`…). Without `image`, it uses the scene's first `images` entry marked `"keeperOnly": false`, else the drawn scenery of `place`, else a generated background in the preset's colours. A scene with a `place` and no `preset` or telling sounds gets that place's usual light (a library by candlelight, a street in the rain). Handouts with an `image` (or only `text`) can be pushed to the screen by the keeper.

## 5. NPCs and creatures

```json
{
  "id": "elias", "name": "Elias Varnum", "kind": "person", "role": "Lighthouse keeper",
  "personality": "A grieving father who has stopped sleeping.",
  "knows": ["…"],
  "characteristics": { "STR": 65, "CON": 60, "SIZ": 70, "DEX": 50, "INT": 55, "POW": 40 },
  "hp": 13, "dodge": 25, "armor": 0, "attacksPerRound": 1,
  "attacks": [ { "name": "Boat hook", "skill": 45, "damage": "1D8" } ],
  "skills": { "listen": 50 },
  "sanLoss": "0/1D6",
  "special": ["Firearms deal half damage."],
  "portrait": "images/elias.jpg"
}
```

Everything except `id` and `name` is optional: a talking-only NPC can be just `name`, `role` and `knows`. Anything with `hp` and `attacks` can be dropped into combat.

## 6. Handouts, pregens, knowledge, trackers

- **NPC table** (`npcTable`, story level): `{ ref, note, rows }`, one row per character as shown in the "PNJ et monstres" panel: name, short description, HP, DEX, attack, defence.
- **Default party** (`defaultParty`): pregen ids suggested for a quick start.
- `meta.playersText`: players as written in the source (`"2 à 5 joueurs"`), shown instead of `players.min/max`.
- A pregen may give its skills as written on the sheet (`sheet`: `"Histoire 70 · Bibliothèque 60"`) instead of `skills`, and a `dodge` value.


- **Handout**: `{ id, title, text?, image?, scene? }` — shown to players full screen.
- **Pregen**: name, occupation, characteristics, hp/mp/san/luck, `skills` (id → value), attacks, background, important people.
- **Knowledge**: `{ need, best, backup }` rows for the "Who knows what" tab.
- **Tracker**: `{ id, label, max, unit, step, timer, help, scenes }` — e.g. a ritual needing 8 MP, a creature climbing 5 turns of stairs. The game screen has one tracker panel, shown for the whole game: it holds the tracker with id `ritual`, else the story's first tracker, so put the one the keeper needs at hand first. Other trackers are keeper reference for now, and `scenes` isn't used yet.

## 7. Sounds

Sounds belong to the **app**, not to stories. Scenes reference ids from the shared library [`sounds.json`](sounds.json):

```json
"ambience": ["rain-window", "clock"],
"sfx": ["door-creak", "footsteps"]
```

Each library sound has a localized name and tags (`indoor`, `night`, `weather`, `horror`…) to help authors and the importer choose. Ids marked `"status": "planned"` are reserved but may not have audio yet; the app simply hides them.

A story *may* ship its own sound:

```json
"sounds": [ { "id": "cult-chant", "file": "sounds/chant.mp3", "kind": "ambience", "fallback": "wind-howling", "credit": "…" } ]
```

If the file is missing, the `fallback` library sound plays instead.

## 8. Import (screenshots / PDF / text → story pack)

1. The keeper drops pages, screenshots or text into Grimoire (their own copy of a book).
2. An AI model, using the keeper's own API key, drafts `story.json` **scene by scene**, constrained by this schema and the sound and skill id lists.
3. The editor validates the draft, highlights broken links and unknown ids, and lets the keeper refine each scene ("shorter read-aloud", "add a pushed-roll consequence").
4. Imported stories are marked `"license": "private"` and stay on the keeper's machine.

Read-aloud texts generated during import should be **reworded**, not copied from the source.

## 9. Versioning

- The `format` string is bumped (`grimoire-story/2`) only for breaking changes; the app will migrate older packs.
- Adding optional fields is not breaking.
- Saved games store scene ids and investigator state, never story text, so a story can be edited between sessions.
