# Grimoire (ex « Écran du Gardien ») — handoff notes

Keeper's companion web app for d100 investigation/horror tabletop games. Built iteratively in a claude.ai conversation as a **single HTML file** published as a claude.ai Artifact. This folder is the full state at handoff, to be migrated into a real project (web engine + story packs + Tauri macOS app).

## Layout

```
app/
  index.html          the whole app (HTML + CSS + JS in one file, ~470 KB)
  sons/*.mp3          sound library (ambiences amb-*, effects fx-*), loaded by relative path
i18n/                 translation sources and the build script that injected them into index.html
  build.py            one-shot patcher (already applied — do NOT re-run on the current index.html)
  i18n_tpl.js         FR/EN DOM translation layer (injected at end of <script>)
  scen_tpl.js         builds the "Edge of Darkness" (frontiere-en) scenario from frontiere_en.json
  ui_en.json, ui_patterns_en.json, skills_en.json, data_en.json, frontiere_en.json
  *_fr.json           extracted French sources
grimoire-spec/        target story-pack format (spec, JSON Schema, sound ids, sample story)
```

## Run it locally

Sounds are fetched with `fetch("sons/…")`, so serve over HTTP (file:// breaks audio):

```sh
cd app && python3 -m http.server 8000   # → http://localhost:8000
```

Fonts come from Google Fonts (IM Fell DW Pica, Spectral, IBM Plex Sans Condensed/Mono, Limelight, Josefin Sans, Cormorant Garamond).

## claude.ai runtime dependencies (must be replaced outside claude.ai)

The page calls `window.claude.use(...)` (guarded; the app degrades gracefully without it):

| Capability | Used for | Replacement idea |
|---|---|---|
| `sample` | Narrator panel (LLM writes narration from scene context; `NARR_RULES` + `RULES_TXT` + `narrContext()`) | Anthropic API with user's key (Tauri: key in Keychain, call from Rust side) |
| `db` | Cloud sync: docs `data/users/${UID}/etat` and `save-*` | Local files (Tauri fs) / optional sync later |
| `user` | `id()` for the db path | drop |
| `downloads` | Export a character as a file | Tauri save dialog / browser download |

Everything else persists in `localStorage`: `gardien-v2` (main state `S`), saves list, `gardien-lang`, `gardien-skin`.

## Code architecture (as it is today)

Single `<script>`. Main pieces, roughly in file order:

- **Data constants**: `ACTS` (frontiere scenes), `LIVRES_ACTS`, `SCENARIOS` (list; each has `id, t, acts, party, ritual, who, lang`), `PROFILES` (NPC table rows), `INV0` (pre-generated investigators), `WHO` (who-knows-what), `STATES`, `BEASTS` (combat stat blocks per scenario), `WEAPONS`, `CARS`, `SKILLS`, `OCCS`, `RULES` (paraphrased rules sections), `GLOSS` (hover glossary), `REC_AMB`/`REC_FX` (sound library), `AMB_FOR`/`SFX_FOR` (scene → sounds), `NAMES`, `FOLIES`, `NPCS`.
- **Post-processing of scenes**: `FLOWS` (scene id → "Fil de la scène" steps, replaces old secs) and `READS` (read-aloud texts) are merged into scenes right after `SCENARIOS`.
- **State**: `S` (views, current scenario `S.cur`, per-scenario state `S.scen[id]` = party, done, scene, groups, combat…, progression `S.prog[charId]`). `ST()` = current scenario state, `SC()` = current scenario.
- **Views**: `show(v)` + `route()`; home menu sub-views via `HV` (menu/parties/joueurs/histoire). Play view = `renderPlay()` → `renderNav`, `renderScene`, `renderInv`.
- **Pattern used everywhere**: features were added by *wrapping* functions (`const _rs=renderScene; renderScene=function(){_rs(); …}`) plus event delegation and MutationObservers. Expect several stacked wrappers on `renderScene`, `show`, `renderPlay`. A refactor should flatten these.
- **Rolls**: `openPick(kind,label,val)` (choose investigators) → `rollPick`; `d100`, `level`, `valFor(c,…,skill)`, `skillsOf` / `allSkillsOf` (sheet skills + rule base values), `carOf` (characteristics incl. manually entered ones in `S.prog[id].car`). Flow tests are parsed by `ftParse`.
- **Combat**: `renderCombat`, `openCombat`, `applyDamage` (major wound, dying, death, impaling).
- **Progression**: checks per skill, `improve`, `histAdd`; saves `saveSnapshot`/`restoreSave`.
- **Sounds**: Web Audio, `startAmb`/`stopAmb`/`playSfx`, looping ambiences with crossfade-friendly files.
- **i18n**: DOM-level translation (`trS`, `i18nNode`, MutationObserver) driven by dictionaries; scenario data stays French internally, the English scenario `frontiere-en` reuses French skill labels in data. Scenarios are filtered by UI language (`scLangOK`).
- **Theme**: `html[data-skin="deco"]` Art Deco black & gold (default) vs classic; key T. Language key L. Shortcuts D/S/C/R/J/N/←/→.

## Known issues / debt

- One 3,500-line script, globals everywhere, stacked wrappers → refactor into modules (suggest: Vite + TS, or keep vanilla ES modules).
- i18n is a DOM text-replacement layer: fragile for dynamic strings; some rare messages (toasts, journal lines) remain French. Replace with proper `t()` keys during refactor.
- Scenario content is hard-coded in JS; target is the story-pack format in `grimoire-spec/`.
- Pre-generated investigators lack most characteristics (only DEX known); keeper can type them in.
- Narrator and cloud sync never tested outside claude.ai.

## Copyright — important for the open-source repo

`ACTS`, `LIVRES_ACTS`, `PROFILES`, `INV0`, `WHO`, `BEASTS`, `RULES`, `FLOWS`, page refs and `frontiere_en.json` are **derived from Chaosium's Call of Cthulhu Starter Set** (paraphrased, but still derivative). Keep them out of any public repo: convert them to *private* story packs on your own machine. Publish only the engine, the spec, the sound library (respect CC BY credits) and original content (e.g. the sample story, the READS ambience texts if you rewrite them as generic).

## Suggested migration plan

1. Create repo `grimoire/` with `grimoire-spec/` as `spec/`.
2. Split `index.html` into modules; keep behaviour identical (Playwright smoke tests: home, new game, scene, dice, combat, sounds, FR/EN).
3. Write a converter: current `SCENARIOS` data → `story.json` packs (private), validate against `spec/story.schema.json`.
4. Make the engine load packs instead of constants; map skill ids ↔ display names per language.
5. Replace `window.claude` capabilities (narrator via Anthropic API, local persistence).
6. Story editor + AI import (screenshots/PDF/text → draft pack).
7. Tauri macOS wrapper.
