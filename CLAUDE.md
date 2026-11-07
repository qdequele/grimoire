# Grimoire (ex « Écran du Gardien ») — handoff notes

Keeper's companion web app for d100 investigation/horror tabletop games. Built iteratively in a claude.ai conversation as a **single HTML file** published as a claude.ai Artifact. This folder is the full state at handoff, to be migrated into a real project (web engine + story packs + Tauri macOS app).

## Layout

```
src/                  NEW app: Vite + React 19 + TypeScript (strict) + Tailwind v4 + shadcn/ui (base-nova)
  engine/             pure game rules, no UI: dice, success levels, damage. Unit-tested (Vitest).
  auth/ characters/ stories/ games/ import/ home/ companion/ screen/   features, co-located (page + TanStack Query hooks in api.ts)
  lib/supabase.ts     typed client; lib/database.types.ts is generated (`pnpm db:types` → scripts/gen-db-types.mjs)
  components/ui/      shadcn components (add with `pnpm dlx shadcn@latest add <name>`)
  App.tsx             router (React Router) + providers
supabase/
  migrations/         schema + RLS (profiles, stories, characters, games, story_imports, import-pages bucket)
  seed.sql            generated from stories/ (`pnpm db:seed-gen`): original stories → marketplace
  functions/import-story/   AI import Edge Function (Deno). Own deno.json.
  functions/create-story/   AI story creator (questionnaire → outline → scenes). Own deno.json.
  functions/mcp/      MCP connector: ChatGPT / Claude create and revise stories (OAuth). Own deno.json.
  functions/_shared/  import-draft.ts (draft schema, merge, → story.json), import-prompt.ts,
                      spec-bundle.ts (generated from spec/: `pnpm spec:bundle`), database.types.ts (generated)
  tests/              rls.test.ts (security rules), import-story.test.ts (function, fake Claude API)
scripts/              gen-seed.mjs, gen-spec-bundle.mjs
public/sons/*.mp3     sound library (ambiences amb-*, effects fx-*), shared by both apps
spec/                 story-pack format (STORY_FORMAT.md, story.schema.json, sounds.json)
skills/grimoire-story/ optional Claude skill for the MCP connector (downloaded from Réglages as a .zip)
stories/              original, publishable story packs (the-silent-light)
e2e/                  Playwright: legacy.spec.ts pins legacy behaviour, app.spec.ts tests the new app
legacy/               PRIVATE, gitignored except the sons symlink
  index.html          the old single-file app (HTML + CSS + JS, ~470 KB)
  sons -> ../public/sons
  i18n/               translation sources + build.py (one-shot patcher, already applied, do NOT re-run)
private/              PRIVATE, gitignored: story packs converted from books you own
```

`cn` comes from the `cn` package (shadcn's drop-in replacement for clsx + tailwind-merge), re-exported by `@/lib/utils`.

## Run it locally

```sh
supabase start      # local Supabase (OrbStack). Studio → http://127.0.0.1:54323
cp .env.example .env.local   # then fill VITE_SUPABASE_ANON_KEY from `supabase status`
pnpm dev            # new app → http://localhost:5173
pnpm functions      # Edge Functions with supabase/functions/.env (needs ANTHROPIC_API_KEY)
pnpm test:db        # RLS security + companion RPC tests against the local DB
pnpm test:import    # import, suggest-profile and narrate functions with a fake Claude API; first run:
                    #   supabase functions serve --env-file supabase/tests/functions.env
pnpm db:reset       # re-apply migrations + seed (wipes local data)
pnpm db:types       # regenerate DB types after a migration (scripts/gen-db-types.mjs: app + function copies, normalised)
pnpm legacy         # old app → http://localhost:8000 (must be served over HTTP: sounds use fetch)
pnpm test           # engine unit tests
pnpm e2e            # Playwright, both apps + companion (keeper and phone); the AI tests need the functions server above
                    #   (legacy project is skipped when legacy/index.html is absent)
pnpm typecheck && pnpm lint && pnpm build
```

The legacy `index.html` was a claude.ai Artifact fragment (claude.ai adds the document skeleton when publishing). A `<!doctype html>` + `<meta charset="utf-8">` header was added at migration: without it the browser decodes the file as Windows-1252 and the script fails with "Invalid or unexpected token".

Fonts come from Google Fonts (IM Fell DW Pica, Spectral, IBM Plex Sans Condensed/Mono, Limelight, Josefin Sans, Cormorant Garamond).

## Look and feel: the legacy app is the design spec

New screens must look like the original app, not like default shadcn. Both legacy skins are design
tokens in `src/index.css` (`html[data-skin]`, saved under `gardien-skin`): **Art Deco** (default:
black and gold, Limelight / Josefin Sans / Cormorant Garamond, square corners, fan pattern) and
**Classic** (green-black, IM Fell / IBM Plex / Spectral). Reuse `src/theme/Masthead.tsx`
(title block, quote column, skin toggle) and the legacy patterns: diamond-bullet menus, eyebrow
labels, gold double rules. Before building a screen, screenshot the legacy equivalent
(`pnpm legacy`) and match it. Keep Chaosium names (L'Appel de Cthulhu, Arkham…) out of the UI.

## Game screen: the original engine, embedded

The in-game interface is the legacy app's own engine, so it behaves exactly like the original:

- `public/play/engine.js`, `public/play/legacy.css`, `play.html` are **generated** by `pnpm engine:extract` (`scripts/extract-engine.mjs`) from `legacy/index.html`. Don't hand-edit them: change the extraction script (its `patch()` calls list every code change, each with a reason) and re-run.
- The extraction swaps every content constant for `GRIMOIRE_DATA.<NAME>` (found with a parser, not regexes) and removes the statements that only added content. Book references and setting names become `T(n, neutral)`: neutral text in the public code, original text from private data.
- `/games/:id` (`src/games/GamePage.tsx`) shows `play.html` in a full-screen iframe. `src/play/boot.ts` reads `window.parent.__grimoirePlay` (`src/play/host.ts`), sets `GRIMOIRE_DATA`/`GRIMOIRE_HOST`, then loads the engine as a classic script (it relies on sloppy-mode globals and function redeclarations: never make it a module).
- Data: `src/play/legacy/adapter.ts` turns any story.json into the engine's shapes; `src/play/engineData.ts` adds account investigators (`toLegacyCharacter`) and rules content.
- State: the engine's whole `S` is saved in `games.state.legacy` (debounced) plus a browser copy (`grimoire-game-<id>`, newest wins). Investigator progression (`S.prog[id]`) is written back to `characters.data.progress` and seeds every new game.
- Rules texts, glossary, bouts of madness, narrator instructions, translations and the original book references live in `private/engine-data.json` (gitignored), loaded with `import.meta.glob` when present; neutral fallbacks otherwise.
- Your legacy scenarios: `pnpm stories:convert -- --upload <email>` (`scripts/convert-legacy.ts`) converts `private/legacy-dump/` into private stories in `private/stories/` and uploads them. The dump is taken from the running legacy page (see the scripts' headers).
- Tests: `src/play/legacy/roundtrip.test.ts` (legacy data → story → engine data, field for field), `pnpm e2e:parity` (original vs new app, every scene and panel, FR + EN), and the "game screen" test in `e2e/app.spec.ts` (rolls, account save, quit, progression across games).
- Layout changes from the original (extraction patches, "game screen layout"): the narrator is a floating window (toolbar button, shortcut A, Escape closes, open state in `S.ui.narr`) instead of a right-column panel; "PNJ de la scène" and "Investigateurs" fold like Journal and Notes. English for the labels the app adds: `APP_UI_EN` in `src/play/engineData.ts`.
- Dice: the engine still rolls and words every result, then hands the dice it rolled to `window.GRIMOIRE_DICE` (`src/play/dice.tsx`, record → dice in `diceRecord.ts`). The Dés panel and each line of the roll picker throw the phones' 3D dice (`src/companion/dice3d/`), then show the number. The patches live in `scripts/engine-dice.mjs`: the extraction applies them last, and `node scripts/engine-dice.mjs --apply` applies them to the current `engine.js` (the legacy source isn't needed). Dice it can't draw (a D7, more than 12 dice) keep the old spinning number. `src/play/dice.css` (loaded after legacy.css) also gives the Dés panel the Art Deco look the legacy app never had (it stayed Classic's teal).
- Known, intended differences: in English the new app translates the ritual panel and rules sheet (the original left them in French until the language was switched by hand); the English glossary/translation race is normalised in the parity test. The 3D dice delay a roll's result by about 1.3 s (the original showed it after a 0.5 s spinning number).
- Narrator: the engine's `claude.use("sample")` call is patched to `GRIMOIRE_HOST.sample` (`src/play/narrator.ts`, same contract: streaming `onText`, abort, error codes), backed by the `narrate` Edge Function (`_shared/narrate.ts`: validation, prompt-cache split at "CONTEXTE ACTUEL DE LA PARTIE"). `NARRATOR_MONTHLY_LIMIT` (300) per account in `ai_usage`. No global `window.claude` shim: the engine's saves list only loads when `window.claude` is absent.
- UI additions (`scripts/engine-ui.mjs`, applied after the dice patches; new engine code in `scripts/engine-ui/ui.engine.js`, inserted before the first `route()`, styles in `scripts/engine-ui/ui.css`; `node scripts/engine-ui.mjs --apply` applies them to the current generated files, from a clean `git checkout` of them). The engine renders once before this code runs: functions and `var`s only there. What they do:
  - **Toolbar**: sticky while playing (the page scrolls below 1181 px), without the story title (`--top-h` for what sticks below it).
  - **Scene flow choices**: a step with `br` (story `step.branch`, or a title starting with "Si …"/"If …": `branchOf` in the adapter) is drawn under the step before it as lettered options (`.flb`, "Selon le choix des joueurs"). The Art Deco diamonds share one centre with their numbers.
  - **Documents**: `GRIMOIRE_DATA.HANDOUTS` and each scene's `hd` (the adapter: `scene.handouts` plus handouts naming the scene). Listed under the sounds (`.hd-row`), linked in the text (`{{handout:id}}` → `a.hdlink`), opened on paper (`#hdDlg`), with its picture (`GRIMOIRE_HOST.handoutImage`, signed) and "Montrer sur l'écran" (`GRIMOIRE_HOST.showHandout` → `ScreenControl.showHandout`).
  - **Ambiance preview**: the scene's ambiance screen, live and small, first in the sounds row: an iframe on `/screen-preview?preset=&place=&time=&image=` (`src/screen/ScreenPreview.tsx`, public, no Supabase; `previewScene` only accepts a picture from this project's signed Storage URLs). `GRIMOIRE_HOST.screenPreview(sceneId)` → `ScreenControl.preview` (ambiance + signed picture) and its label. A click opens the screen dialog.
  - **Investigator sheets**: the name on an investigator card (`[data-sheet]`) calls `GRIMOIRE_HOST.openSheet(cid)`: `CharacterSheetDialog` above the iframe for account investigators, else the card unfolds.
- Not wired yet: "Sauvegarder la partie" snapshots (still browser-only), and investigators created or edited from inside a game (they stay in that game, not in the account, and don't appear on players' phones).

## Player companion (players' phones)

Players open a link or QR code from the keeper on their phone, with no account: they follow and change their investigator's live points, keep a notebook, or create an investigator.

- **Routes** (`src/companion/`, public, no app chrome): `/t/:token` picks an investigator (or redirects to the remembered one, `grimoire-companion-<token>`, or to a personal link's), `/t/:token/c/:id` Fiche (HP/SAN/Luck/MP − +, characteristics, skills), `…/carnet`, `…/profil`, `/t/:token/nouveau` (the keeper's `CharacterWizard` with a first-name field). A revoked link shows "Ce lien n'est plus valide…".
- **Keeper side**: the engine toolbar's "Joueurs à la table" opens `TableLinksDialog` (`src/games/`, above the iframe): one table link (anyone joins or creates an investigator) and per-investigator personal links; create, QR, copy, revoke. Investigateurs page: "Carnet (n)" on each card opens `NotebookDialog` (`src/characters/notes.ts`: read, edit, delete the players' notes; owner RLS).
- **Tables**: `table_links` (token, game, `character_id` null = table link, `revoked_at`), `character_notes` (1..2000 chars, owner RLS for all operations), `game_points` (live pv/san/chance/pm/checks per game and investigator, `source` keeper|phone, server `updated_at`). `games.channel` is the realtime topic id; revoking rotates it. Link tokens are stored in plain text (the keeper's dialog re-shows their QR codes; owner-only RLS).
- **RPCs**: phones call security-definer RPCs with the token (`companion_open`, `companion_set_point` (one field), `companion_add_note`, `companion_create_character`; errors `link_invalid`, `not_in_game`, `bad_value`, `party_full`). Keeper: `revoke_table_link`, and `save_game_state` (the game screen's save: keeps investigators a phone added since the last load unless the keeper removed them; stamps `state.serverSavedAt`, the server's time). `companion_owner` is service-role only (suggest-profile charges the game owner's quota for a table link).
- **Phone sheets are untrusted**: `companion_create_character` rebuilds the sheet with `companion_clean_character` (only `CharacterData`'s keys, typed and bounded values, < 64 KB, `progress` dropped; anything else is `bad_value`). Skill keys must look like the app's (`id` or `id:specialty`), and `< > & "` are refused in the name, skill keys and the player's first name. The game screen also coerces values (`toLegacyCharacter`) and the extraction escapes them where the engine renders them, skill and player names included (dice result line, roll picker results, "Modifier la partie" warnings). The phone's wizard applies the same limits (`SHEET_LIMITS` in `src/characters/character.ts`, `maxLength` and a message under the field; `companionSheetProblems` names the field before sending). Keep all layers in step when adding a field. The typed first name reuses any of the keeper's players with that name, case-insensitively.
- **Realtime**: broadcast topic `companion:<games.channel>`, sent by DB triggers: `points` (full row, camelCase), `notes`, `member` and `roll` (`{ characterId }`), and `rotate` (empty, from `revoke_table_link` on the old topic just before the channel changes). The topic is public: anyone with a link can send on it. The game screen (`GamePage.tsx`) treats every event as a hint and re-reads the database under its RLS (`game_points` row, `games.state.party`, notes; `rotate` refetches the game). Phones apply `points` payloads for display only, clamped to the server's bounds, and refetch `companion_open` on `notes`, `member`, `rotate`. Both refetch on (re)subscribe to catch up.
- **Engine API**: `window.GRIMOIRE_ENGINE` (extraction patch, type `EngineApi` in `src/play/host.ts`): `setPoints(cid, v)`, `addMember(c, player, progress?)`, `setNotebooks(map)` (the folded "Carnet (n)" on investigator cards), `logRoll(text, kind)` (a phone's roll in the Journal), `setPhotos(map)` (the round heads, below). The game screen writes the keeper's point changes to `game_points` (`source: 'keeper'`) and applies phone rows on load, so changes made while its tab is closed show when it reopens. Phone point changes go to the Journal like the keeper's −/+ ("Nom : PV 13 → 12", one line per value within 20 s): live through `setPoints` (`jlogPoints`), on load through `applyPoints` (at the phone change's time).
- **Skill help and dice rolls** (Fiche and Dés tabs): tapping a skill, a characteristic, SAN or Luck opens `RollDialog` (`src/companion/Dice.tsx`): what it is for (`SkillDef.what` in `src/rules/d100.ts`, original texts, English in `en.ts`), thresholds, bonus/penalty dice (±2), then a d100. The Dés tab rolls 1–10 dice of D3…D100 ± 20 and lists this phone's last rolls (memory only). The **server rolls** (`companion_roll_check`, `companion_roll_dice`, `random()`); the phone sends what is rolled (`subject`: `skill:<key>`, `char:<STR…>`, `san`, `luck`) and the value it shows, which the keeper sees next to the result. Rows in `game_rolls` (owner RLS, 100 newest per game), a `roll` hint `{ characterId }` on the game's topic; the game screen reads new rows (`src/games/rolls.ts`, `rollFeed`; rolls made while its tab was closed aren't shown), shows each one as a toast at the top, under the toolbar (`showRollToast` in `src/games/RollToast.tsx`, 30 s or closed by hand; `rollMessage` in `src/companion/rolls.ts`) and writes it to the engine's Journal (`GRIMOIRE_ENGINE.logRoll`, `rollJournal`: under Dés, Tests or Santé mentale, saved with the game). A success doesn't tick the skill: the keeper does that, as before. On the phone the dice are thrown in 3D before the result shows (`src/companion/dice3d/`: polyhedra drawn with CSS transforms, no WebGL; `dice.ts` says which dice a roll shows, a d100 is a tens d10 and a units d10, unkept bonus/penalty dice fade; `DiceTray` rattles them while the server answers, then lands them on its values; no motion with `prefers-reduced-motion`).
- **Investigator photos**: tapping the round head at the top of the Fiche (or on an Investigateurs card, for the keeper) opens `PhotoDialog` (`src/characters/`): the picture is cropped to a centred square and shrunk to 192 px JPEG in the browser (`photoFromFile`, `src/characters/photo.ts`), stored as a data URL in `characters.photo` (≤ 60,000 characters; `character_photo_ok` in the migration and `isPhoto` accept only base64 JPEG/PNG/WebP, so the value is safe in a CSS `url()`). Phones call `companion_set_photo` (same link rules as points; `''` removes it); the keeper writes the column under RLS. A trigger sends a `photo` hint (`{ characterId }`) to the investigator's running games: phones refetch, the game screen re-reads the column. `Avatar` (`src/characters/Avatar.tsx`) draws the head everywhere in the app (phone list and sheet, Investigateurs, Joueurs, table links, roll toasts); in the engine, `head()` shows `PHOTOS[cid]` (extraction patch, pushed by `setPhotos`, never in `S`, so not in the saved game).
- **Tests**: `supabase/tests/companion.test.ts` (`pnpm test:db`), `e2e/companion.spec.ts` (keeper + 390×844 phone contexts; shared flows in `e2e/helpers.ts`), `src/companion/rolls.test.ts`.
- **Not wired / known limits**: investigators created inside the game screen don't appear on phones; two writers on the same field: last writer wins; no rate limit on notes or rolls (anyone with a link can write many; rolls are pruned to 100 per game); anyone with the table link can change any party member's photo; any active link, personal links included, lets its holder spend the keeper's AI profile-suggestion quota (`PROFILE_MONTHLY_LIMIT`).

## Story packs in Storage

Every story also exists as a story pack (spec/STORY_FORMAT.md) in the private `story-packs` bucket: `<owner id>/<story id>/story.json`, `images/…`, `sounds/…` (`marketplace/<story id>/…` for marketplace stories, writable by admins only). `stories.content` stays what the app reads; `stories.pack_files` lists the pack's other files.

- Import: Importer → "Packs Grimoire" (`src/import/PackImport.tsx`): one or more .zip, or a folder (a folder of pack folders imports them all; `splitPacks`). `src/stories/pack.ts` reads and checks packs (blocking errors vs schema warnings), `useImportPack` creates the private story, or updates the one with the same `meta.id` (its games keep working), then `writePack` uploads every file.
- Kept in sync: pack import, copy (`copyPackFiles`), delete (`deletePack`), AI import (the function writes story.json), the legacy converter, the MCP `save_image` (writes the file, `pack_files`, content and story.json together). Any new code path that saves `stories.content` must also write the pack's story.json (`writeStoryJson`).
- Download: story page → "Télécharger le pack (.zip)" (`downloadPack`).
- `pnpm packs:sync` writes story.json for every story (backfill; `pnpm db:reset` runs it, the seed can't write Storage).
- The game engine shows handout pictures (the document dialog) but not scene images or story sounds yet: they are stored and downloadable.

## Ambiance screen (TV / tablet at the table)

- `/screen/:token` (`src/screen/`): full-screen, no account. A slowly living background for the current scene (still picture with slow pan and zoom, or a generated gradient) plus preset layers (`fog`, `rain`, `candle`, `hearth`, `night`, `storm`, `dust`, `snow`, `abyss`, `ritual`, `nightmare`, `bulb`, `blaze`: fog bands tinted per preset, grain, vignette, flicker, one small particle canvas (rain, snow, dust, embers, bubbles, spores), lightning, a CSS light effect (`PresetLook.effect`: light shafts, eldritch aura, heartbeat, failing bulb, fire glow); `hearth` draws a live fire with its flickering light, `src/screen/Hearth.tsx`, at the scene's `screen.fire` place inside the pan-and-zoom), crossfade between scenes, handouts on "paper" over a dimmed scene. Transforms and opacity only; `prefers-reduced-motion` stops the motion. A tap starts full screen, sound and the Wake Lock; the cursor hides when idle.
- Lights in scene photos (`src/screen/PhotoLights.tsx`, finder `lightSpots.ts`): the picture's pixels are read once, small (a separate CORS request; refused or tainted: no lights), and bright, warm spots much brighter than their surroundings become masks screened over the photo, inside the pan and zoom. White-hot spots (flames, bulbs) flicker in two rhythms, larger ones (windows, doorways) breathe; cold lights (moon, sky) are left alone, and a picture where warm bright spots cover more than `MAX_LIT_SHARE` is daylight and gets none. Opacity-only CSS animations, none with `prefers-reduced-motion`.
- Same mechanism as the player companion, separate pieces: `screen_links` (one active per game, revocable), anonymous `screen_open(token)` → `{ channel, screen }` only, Realtime broadcast of `games.screen` on `screen:<games.screen_channel>` (trigger). Revoking rotates `screen_channel` only, so phones stay connected. A screen token is not a companion token.
- `games.screen` is `ScreenState` (`src/screen/state.ts`: pure reducer, follow vs pinned, preset override, handout). The keeper's game screen owns it: `ScreenControl` (`src/games/screen.ts`) follows the engine's scene through `PlayHost.save`/`loadState` (no engine patch for that), signs picture URLs (8 h, renewed hourly while the game is open) and writes `games.screen`. The screen never reads Storage itself.
- Drawn décors: when the scene has no picture, a place in silhouettes (`church`, `graveyard`, `crypt`, `castle`, `manor`, `library`, `police`, `forest`, `harbour`, `street` in `src/screen/Places.tsx`; `asylum`, `station`, `swamp`, `dig`, `mountain`, `museum`, `cavern`, `farm`, `ship`, `fair`, `mine`, `moor` in `src/screen/places/<id>.tsx`), original drawings generated from code (seeded), drawn with the helpers of `src/screen/placeKit.tsx`. A new place: its id in `PLACES` (`ambiance.ts`: label, default preset, title words), the story schema enum (`pnpm spec:bundle`), `PLACE_HINTS` in `create-prompt.ts`, the MCP guide and the Claude skill's lists, an English label, then its `Draw` in `places/` and in `DRAW`. A few full-screen SVG layers (far/mid/near, lit, pulse, water) that only drift or fade (parallax, breathing windows, candles, the lighthouse beam); colours from the preset's palette, so any place goes with any preset. Lights inside silhouette layers carry `.scr-glow` (off by day), edges facing the moon or sun `.scr-rim` (dimmer under a grey sky), edges lit by a lamp `.scr-rim-lamp`; the crypt and the street are drawn in one-point perspective inside the mid layer. Dev only: `/dev/places?place=…&preset=…&time=…` (`?sheet=1` for all ten) shows them without Supabase (`PlacesGallery.tsx`, registered only when `import.meta.env.DEV`).
- **Drawing the décors**: follow the `decor-artist` skill (`.claude/skills/decor-artist/SKILL.md`): 5–10 render → critique → fix loops per image, against a checklist of every mismatched join the keeper found.
  - `pnpm decor:shots <place> [--crop x,y,w,h] [--time night,dusk,day] [--clean]` (`scripts/decor-shots.mjs`, dev server running) renders both ends of the drift into `decor-review/`.
  - `pnpm decor:compare [places] [--ref <commit>]` (`scripts/decor-compare.mjs`) renders the ref (default `origin/main`, in a temporary git worktree sharing `node_modules`, its own Vite on :5198) and this checkout, and writes `decor-review/compare/index.html`, a before/after slider per place, time and drift end (served by `pnpm dev` at that path).
  - `pnpm e2e:decors` (`e2e/decors.spec.ts`, dev gallery only, no database) checks every place on screen, at rest and at both ends of the drift: each light touches a shape that drifts with it; no piece floats; no hard light edge lines up (upright edge or corner) with a shape at another depth; no accidental holes from overlapping shapes winding opposite ways; shapes marked `data-ground` (grass `"each"`, buildings) rest their foot on their layer or the one in front. The near layers' drift zooms 2% about the bottom edge (`transform-origin: 50% 100%` on `.scr-par`), so the ground stays put. It doesn't judge partial support, matching widths or readability: the loop does.
  - Lights go in the lit layer of their shape's depth (`lit-far`, `lit`, `lit-near`, flickering `pulse` = near, `pulse-mid`). A light spanning two depths is split by what it falls on. Silhouettes use `P` (each subpath its own element, so overlaps always fill, with a thin outline in their colour so neighbours don't show a hairline); line drawings (`.scr-rim`, groups with a fill or stroke) use plain `<path>`; holes on purpose use `fillRule="evenodd"`. `mid-front` drifts with mid but is drawn after its lights (the manor's veranda). Shapes meant to float carry `data-free`.
- Time of day (`TIMES`: `day`, `dusk`, `night`), apart from the preset (weather and mood): `paletteFor(preset, time)` (night = the preset's palette, day = its `day` palette or a daylight sky blended in, dusk = violet and a warm horizon). On the layer `data-time` and `data-sky` (`overcast` for rain/storm/snow): by day the sun replaces the moon, silhouettes stay dark, windows and lamps are off; a grey sky shows neither sun nor moon; a `crypt` or a `cavern` stays at night. From `screen.time`, else the scene's title (`timeFromText`), else day/night sounds, else `LOOKS[preset].time` (night, except dust). Keeper override `timeOverride`.
- Scene → ambiance: `sceneAmbiance` (`src/screen/ambiance.ts`): the scene's `screen: { image, preset, fire }` (spec §4.5), else a preset from its `ambience` sounds and its first `images` entry with `keeperOnly: false`. Pictures missing from `pack_files` are ignored.
- Keeper UI: toolbar button `#qaScreen` (extraction patch) → `ScreenDialog` (link + QR, follow, preset, sound, push/clear handouts: story handouts, scene images, pictures uploaded to the private `screen-images` bucket, `<owner>/<game>/…`).
- Tests: `src/screen/*.test.ts`, `supabase/tests/screen.test.ts` (`pnpm test:db`), "ambiance screen" in `e2e/app.spec.ts` (two pages).

## Story creator (AI)

Histoires → **Créer** (`/stories/create`, `src/stories/create/`): a questionnaire, then Claude writes an original private story.

- Steps: Cadre (story language, era, place) · Ambiance (tone, threat) · Intrigue (mystery, ideas) · Table (investigators, length, content to avoid) · Plan · Écriture. react-hook-form + zod (`brief.ts`); everything empty is left to Claude. Progress (answers, creation id, edited outline) is kept in `localStorage` (`grimoire-story-creator`).
- `create-story` Edge Function, one function with three actions (shared auth, quotas, cached system prompt): `ideas` ("Inspire-moi" / ↻: fills only empty fields, effort low, `STORY_IDEAS_MONTHLY_LIMIT` 50 in `ai_usage` kind `story-ideas`); `outline` (phase 1: secret, acts, scenes, NPCs; a new creation counts against `STORY_CREATE_MONTHLY_LIMIT` 10/month, rewrites with the keeper's notes are capped by `STORY_OUTLINES_PER_STORY` 5); `write` (phase 2: the next `STORY_SCENES_PER_CALL` (2) scenes as an `ImportDraft`, merged, `draftToStory`, validated, saved as a private story + pack story.json; the browser loops until `remaining` is 0, and can resume after an error or a reload). Admins are unlimited.
- The keeper reviews the outline before any scene is written: rename, rewrite summaries/secret, remove scenes, or ask for a new outline with notes. The edited outline goes with the first `write` call and is frozen after.
- State: `story_creations` (brief, outline, accumulated draft, story id, tokens; read own, function writes). Created stories carry `meta.tags: ['grimoire-creator']` (badge "Création privée") and `license: private`.
- Each written scene gets its ambiance screen: the draft's `place`, `preset` and `time` (enums read from the bundled story schema, `SCREEN_PLACES`/`SCREEN_PRESETS`/`SCREEN_TIMES` in `import-draft.ts`, `""` = let the app choose) become `screen: { place, preset }` in story.json. The prompt describes each value (`PLACE_HINTS`/`PRESET_HINTS` in `create-prompt.ts`, a test checks they cover the format); the AI import shares the draft and fills them too.
- Pure logic in `_shared/story-create.ts` (brief/outline parsing, batching, ordering, `createdStory`), prompts in `_shared/create-prompt.ts` (originality rules + `FORBIDDEN_NAMES`, lines and veils; exported section by section, the MCP guide serves the same text). Saving (story row + pack story.json) is `_shared/story-save.ts`, shared with the MCP connector. Forbidden names found in a created story are reported in `validationErrors` (not refused). Presets (tones, threats, lengths) exist in both `src/stories/create/brief.ts` (French labels) and `_shared/story-create.ts` (English prompt text); a unit test keeps the ids in sync.
- Tests: `story-create.test.ts` (unit), `supabase/tests/create-story.test.ts` (function, fake Claude answers from `supabase/tests/fake-creator.ts`, also used by the e2e test; set `FUNCTIONS_URL` to test a function served elsewhere, e.g. `deno run` of `index.ts` with `DENO_SERVE_ADDRESS`), e2e "keeper creates an original story".

## MCP connector (ChatGPT and Claude)

Keepers create and revise stories from ChatGPT or Claude. The chat app's model writes; Grimoire guides it, then checks, converts and saves (no Claude API call, no tokens paid).

- **Endpoint**: `supabase/functions/mcp` (remote MCP, Streamable HTTP, stateless, JSON responses; official SDK's low-level `Server` + `WebStandardStreamableHTTPServerTransport`). Public address `https://www.legrimoire.quest/mcp` (`vercel.json` rewrites it, and its `.well-known/oauth-protected-resource`, to the function); locally `http://127.0.0.1:54321/functions/v1/mcp`. `verify_jwt = false` in `config.toml`: it answers discovery without a token and checks the token itself.
- **Sign-in**: OAuth 2.1 with Supabase Auth's OAuth server (dynamic client registration on). A request without a token gets `401` + `WWW-Authenticate: Bearer resource_metadata=…`; the metadata names `<supabase>/auth/v1`. The keeper approves the client on **`/oauth/consent`** (`src/auth/OAuthConsentPage.tsx`, supabase-js `auth.oauth.*`; `/login?next=` brings a signed-out keeper back there; Google sign-in and the sign-up confirmation e-mail return to the site's root, so `rememberNext` in `src/auth/oauth.ts` keeps that page for 30 min and `AppLayout` resumes it). The access token is an ordinary user JWT: stories and pack files are read and written with it (RLS), the service role only writes `story_creations` and `ai_usage`. Supabase doesn't support resource indicators (RFC 8707), so any valid session token works: the tools can do nothing the keeper's own session can't.
- **Tools** (`_shared/story-mcp.ts`: definitions, `normalizeDraft`, `applyEdits`, `forbiddenNamesIn`, guide): `grimoire_guide` (workflow, rules, format, sounds, example; same sections as the creator prompt), `save_outline` (brief + approved outline → a `story_creations` row with `source: 'mcp'`; replaceable until the first scene is written), `write_scenes` (1–4 scenes of the outline as an `ImportDraft`, coerced, merged, saved each call like the web creator; `succeeded` when the last scene is in, then closed), `list_my_stories`, `get_story` (story.json parts + `version` = `updated_at`, and `images`: each pack picture with the scenes and handouts using it), `edit_story` (story.json operations: put/remove scene, act, NPC, handout, `set_screen` (a scene's ambiance screen alone; keeps the scene's `image` and `fire` unless named, `""` removes them), set overview/info; all or none; conditional update on `version` → `conflict`; refused while a creation is still writing the story; must not add schema errors), `save_image` (an SVG the model draws → `images/<name>.svg` in the pack and `pack_files`, optionally `screen.image` of a scene or `image` of a handout; same name replaces, `attach` without `svg` reuses, `remove: true` deletes the file and every reference; conditional on `version`, refused while a creation writes the story; returns the new version). `grimoire_guide` has a topic `images` (backgrounds, paper handouts, maps and floor plans).
- **SVG safety**: `_shared/svg-safe.ts` `sanitizeSvg`, a strict allowlist parser that rebuilds the file and refuses rather than repairs: no scripts, handlers, foreignObject, image/feImage, links, animation, DOCTYPE or entities, editor namespaces; href and `url()` only to `#id`; plain CSS without @import, @font-face or backslashes; root needs a viewBox (width and height are set from it); ≤ 300 KB, 20k elements, depth 48, ≤ 100k elements after `<use>` expansion. Tests in `svg-safe.test.ts`. Keep the guide's rules (`IMAGES_GUIDE`) in step with it.
- **Server-side rules**: names from `FORBIDDEN_NAMES` are refused (in edits, only names the story didn't already have: private stories converted from books may carry them); only the keeper's private stories; ≤ 512 KB requests, ≤ 2 MB stories, 20 operations per edit. Limits: `MCP_STORIES_MONTHLY_LIMIT` (30 new stories, counted apart from the web creator's 10 via `story_creations.source`), `MCP_EDITS_DAILY_LIMIT` (500, `ai_usage` kind `mcp-edit`), `MCP_IMAGES_DAILY_LIMIT` (100: every `save_image` call is an `mcp-edit` row, one that stores an SVG writes its byte size in `ai_usage.input_tokens` and the cap counts those rows; no new `ai_usage` kind, it is a DB constraint), 40 pictures per story (`MCP_LIMITS.imagesPerStory`). Admins unlimited. Env also: `MCP_PUBLIC_URL`, `MCP_AUTH_SERVER` (local values in `supabase/tests/functions.env`), `APP_URL` (story links).
- **Keeper UI**: Réglages → "ChatGPT et Claude" (`src/settings/ChatConnectors.tsx`): "Ajouter à Claude" (claude.ai's documented install link, add-connector dialog prefilled: `claudeAddLink` in `src/settings/connectorUrl.ts`), "Ouvrir ChatGPT" (chatgpt.com/plugins: ChatGPT has no prefill link, the keeper pastes the address, which the help page `/aide` gives), the optional Claude skill (`skills/grimoire-story/SKILL.md`, zipped in the browser), connected apps (`listGrants` / `revokeGrant`). The creator's step list links there.
- **Tests**: `story-mcp.test.ts`, `svg-safe.test.ts` (unit), `supabase/tests/mcp.test.ts` (`pnpm test:import`: discovery, every tool through the official MCP client including `save_image`, isolation, limits), `e2e/mcp.spec.ts` (project `mcp`: registration → authorize → login → consent → PKCE code exchange → tool call with the OAuth token; deny; English; disconnect). Local Auth sends the keeper to its `site_url` (`127.0.0.1:5173`) while `pnpm dev` answers on `localhost`: the e2e test rewrites that redirect; to try the connector by hand (e.g. `npx @modelcontextprotocol/inspector`), run `pnpm dev --host 127.0.0.1`.
- **Deploying**: merging to `main` ships the migration (`20261107090000_mcp_connector.sql`), the function and the rewrites in order. Manual prerequisites on the hosted project, before the merge: Dashboard → Authentication → OAuth Server → enable, allow dynamic OAuth apps, authorization path `/oauth/consent`; function secret `MCP_PUBLIC_URL=https://www.legrimoire.quest/mcp`. Then add the connector in claude.ai and in ChatGPT (developer mode) and create one short story in each.

## Privacy, terms, help, and the ChatGPT / Claude directories

- Public pages, no account, one address per language (the page's language comes from its address): `/confidentialite` `/privacy`, `/conditions` `/terms`, `/aide` `/help` (connector documentation + support contact). `src/legal/`: `LegalPage.tsx`, the texts in `privacy.ts`, `terms.ts`, `help.ts`, publisher/contact/date in `info.ts`, addresses in `paths.ts`. `LegalLinks` sits under the login form, the app and the OAuth consent page.
- These long texts are written whole in each language (`fr` and `en` objects), not through `t()`; `legal.test.ts` keeps both outlines aligned and the links valid. **Update them** (and `LEGAL.updated`) when Grimoire collects new data, adds a provider or an AI feature, or changes the connector's tools or limits.
- Directory submission: `directory/README.md` (checklist, reviewer account, form texts), `directory/chatgpt/` (OpenAI plugin package: `plugin.json`, `mcp.json`, logo), `pnpm directory:package` (renders the icons, checks OpenAI's limits, writes the gitignored `directory/grimoire-chatgpt.zip`). Both directories require a `title` and explicit `readOnlyHint`/`destructiveHint`/`openWorldHint` booleans on every tool (`story-mcp.test.ts`).
- Once listed, put the listing links in `DIRECTORY_LISTING` (`src/legal/info.ts`): the Réglages buttons then go to the directory pages ("Ouvrir ChatGPT" becomes "Ajouter à ChatGPT").

## Landing page

Signed-out visitors at `/` get `src/landing/LandingPage.tsx` (signed-in keepers get the home menu; every other signed-out address still goes to `/login`, and so does `/` when Google sent back an error). It shows the real pieces, each a small demo on the app's own engine functions (`src/landing/*Demo.tsx`, shared layout in `parts.tsx`): the ambiance screen's drawn décor (`Stage`, its `.scr-root` kept inside a frame), a phone sheet rolling the 3D dice with bonus/penalty dice, the combat helper (`applyDamage`), the creation wizard's characteristics (`rollCharacteristic`, `derivedValues`), the improvement phase between games, and the sound panel (files from `public/sons`, played only on a tap). The story section is text only (creator, AI import, MCP connector): nothing on this page calls a server. Keep its claims true when a feature changes. "Créer un compte" goes to `/login?mode=signup` (sign-up tab). Its own language switch writes the app's `gardien-lang`. Calls to action are links styled as buttons (`LinkButton`). e2e: the "landing page" test; `signUp` in `e2e/helpers.ts` goes through it.

## Main menu

Reprendre la partie · Nouvelle partie (→ library) · **Histoires** (`/stories`: tabs Bibliothèque, Mes histoires `/stories/mine`, Créer `/stories/create`, Importer `/stories/import`) · **Investigateurs** (`/characters`: tabs Investigateurs, Joueurs `/characters/joueurs`) · **Réglages** (`/settings`: theme, language, ChatGPT and Claude connector). Sections share `src/theme/Section.tsx` (title + tab nav + Outlet). `/marketplace` and `/import` redirect to their new place.

- **Investigateurs**: `/characters/:id` is the presentation sheet (`CharacterSheetPage`, `CharacterSheet`: identity, characteristics, derived values, skills, profile, progression from play; also shown above the game screen), `/characters/:id/edit` the wizard, `/characters/new` a new one.
- **Players** (`players` table): a first name, owned by the keeper. `characters.player_id` (FK on `(player_id, owner_id)`, so only your own players; deleting a player sets it to null). Investigators' progression stays in `characters.data.progress`; the Joueurs page reads it with `progressSummary`. The engine gets the player's name via `NewGame.party[].player`.
- **Language** (`src/settings/lang.ts`) is the `gardien-lang` key the game engine also reads: one setting for the app, the game screen, the default AI-import language and the AI profile suggestions.

## Translations (French source, English dictionary)

- The code is written in French and every visible text goes through `t()` (`src/i18n/t.ts`, `useT()` in components): the French text is the key, `src/i18n/en.ts` its English version. `t('Bonsoir, {name}', { name })`, plurals `t.n(n, '{n} joueur', '{n} joueurs')`, dates `t.date()`, sentences with bold parts `<Rich text={t('… **gras** …')} />`.
- Rules data (`src/rules/d100.ts`) stays French and is translated where shown. Skills have their own entries (`compétence:…`, via `skillName`/`skillText`) because some labels are also ordinary words (Bibliothèque, Lancer).
- `src/i18n/en.test.ts` scans the code for `t('…')` literals (+ `dataKeys()` in `keys.ts` for texts that come from data or props) and fails on a missing, unused or placeholder-mismatched English entry. When you add a text: wrap it in `t()`, add its English line.
- Story content is never translated: a story keeps its own language.

## Production

- Site: https://www.legrimoire.quest (Vercel project `grimoire`). Domain and DNS on Vercel.
- **Deploys run from GitHub Actions** (`.github/workflows/deploy.yml`, every push to `main` or by hand): checks (typecheck, lint, unit tests) → `supabase db push --remote` (dry run printed first; CLI 3 targets the local stack without `--remote`) → `supabase functions deploy` (all functions) → Vercel production deploy. Vercel's own deploy of `main` is off (`vercel.json`, `git.deploymentEnabled`) so the site never ships before the database and functions it calls; other branches still get Vercel preview deploys, against the production Supabase. A failed step stops the rest. Secrets and variables live in the GitHub `production` environment (see the workflow header). E-mail templates are not deployed by CI (`pnpm emails:push`).
- Migrations must be safe to run on a live database (the site keeps serving the old code until the last step): add, don't rename or drop in the same deploy as the code that stops using it.
- Supabase project `fovyhcbasmmstkocavlp` (linked). Vercel's Supabase integration provides `NEXT_PUBLIC_SUPABASE_*`; `vite.config.ts` uses them when `VITE_SUPABASE_*` aren't set.
- Hosted Auth requires e-mail confirmation (local doesn't). E-mails go through Resend (SMTP, sender on legrimoire.quest; DKIM/SPF/DMARC records on Vercel DNS).
- E-mail templates: `pnpm emails` (`scripts/gen-email-templates.mjs`) writes `supabase/templates/*.html`, used locally via `config.toml`. To update the hosted project: `pnpm emails:push --diff` (preview), then `pnpm emails:push` (asks before writing; `--yes` in agent runs). It pushes only the `[auth.email.template.*]` sections, never the local settings of `config.toml`. French or English from `user_metadata.lang`, set at sign-up.
- Test e-mail addresses use `@example.com`: Supabase Auth rejects `.local` domains.
- **Deploying the player companion**: merging to `main` does it in the right order (deploy workflow above): the companion migrations (`20261106090000` to `20261106090500`), then `suggest-profile`, which now takes `storyLink` for the investigator's link with the story and `link` for the companion token, then the site. One manual prerequisite: hosted Realtime must allow public broadcast channels (the companion topics are public, `private: false`).

## Google sign-in

- Login page (`src/auth/LoginPage.tsx`, `src/auth/oauth.ts`): "Continuer avec Google" above the e-mail form, shown only when Google is enabled in Supabase Auth (read from Auth's public `/auth/v1/settings`), so switching it on or off in the dashboard needs no deploy. Locally it is off (`[auth.external.google]` in `config.toml`, ids from `supabase/.env`). Hosted: on. No Apple sign-in (it needs the paid Apple Developer Program).
- Return: Google sends the keeper back to `window.location.origin`, which must be in Auth's redirect allow-list (Vercel previews too, if wanted: `https://*-<team>.vercel.app/**`). Errors come back in the URL (`error_description`) and show on the login page (`returnedOAuthError`, read at start-up because the redirect to `/login` drops it).
- Accounts: Supabase links Google to an existing account with the same verified e-mail. A new account gets its profile name from Google (`full_name`/`name`, migration `20261106130000`) and its language (`user_metadata.lang`, for the e-mails) on first sign-in (`AuthProvider`).
- Setup (hosted): Google Cloud Console → OAuth consent screen (Grimoire, scopes openid/email/profile, published) → Credentials → OAuth client ID, type Web: JavaScript origin `https://www.legrimoire.quest`, redirect URI `https://fovyhcbasmmstkocavlp.supabase.co/auth/v1/callback`. Client ID + secret → Supabase Dashboard → Authentication → Providers → Google.

## Accounts, marketplace, import (Supabase)

- **Only the keeper has an account.** Investigators belong to the keeper's account; players don't log in.
- **Marketplace is curated:** only admins (`profiles.is_admin`) create/edit marketplace stories (`owner_id` null). Promote someone from SQL only: `update profiles set is_admin = true where id = '…'` (the API can't change `is_admin`).
- **Private stories** are visible to their owner only, admins included. A story whose `meta.license` is `private` (every AI import) can never be marketplace: enforced by a DB constraint.
- **AI import:** the browser uploads pages to `import-pages/<user id>/…`, then calls `import-story` 2 pages at a time (Edge Function wall-clock limit). Each call: quota check (`IMPORT_MONTHLY_PAGE_LIMIT` pages/month, admins unlimited) → Claude (`claude-opus-5-5`, structured output, cached instructions, server-side fallbacks) → merge into `story_imports.draft` → `draftToStory` → validate against `spec/story.schema.json` → save as private story. Pages are deleted after every call, success or not.
- **AI profile help** (wizard step 6): `suggest-profile` Edge Function, logic in `_shared/profile.ts`. Fills only empty fields (or one field with ↻), never overwrites the keeper's text (`pickSuggestions`). `claude-opus-5-5`, effort low, structured output. Limit `PROFILE_MONTHLY_LIMIT` (50) per account, counted in `ai_usage` (service role writes only).
- **Why a draft schema:** structured outputs allow ≤ 24 optional fields, ≤ 16 unions, no free-form maps; `story.schema.json` exceeds that. `import-draft.ts` has every field required (`""`/`[]` = absent); a test enforces this.
- After editing `spec/`: `pnpm spec:bundle`. After editing `stories/`: `pnpm db:seed-gen`. Unit tests fail if the bundle is stale.
- `stories/` are original marketplace stories (The Silent Light, La Dame de trois heures dix). The seed inserts each one unless a marketplace story with its `meta.id` exists; the hosted library gets them through a migration of the same shape (`20261107120000_marketplace_dame.sql`), since the seed never runs there. A new story for the hosted library needs such a migration. The library lists the app's language first (a French keeper sees French stories; e2e tests open The Silent Light with `/stories?lang=en`).
- Scene flow steps can be choices (`step.branch`, spec §4.1): the creator prompt, the import draft (`branch`, `""` = none) and the MCP draft pass it through.
- Deno blocks npm packages published < 24 h ago: pin a version that's at least a day old in the function imports.

## Engine conventions

- Engine functions are pure and take an injectable `Rng` (`src/engine/random.ts`); tests use `scriptedRng`.
- Engine returns codes (`'extreme'`, `'majorWound'`…), never display strings. Translation lives in the UI.
- Port behaviour exactly first, improve later (e.g. legacy has no critical/fumble: `successLevel` doesn't either).
- Committed tests and code must never contain scenario text or names (copyright, see below). Use structural selectors.

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

**Open question before publishing:** `src/rules/d100.ts` (skill list with base values, the 9 occupations with their skills, the 40–80 / 70–40 value arrays) ports the legacy wizard's creation rules, which follow the Starter Set's simplified creation. Game mechanics are generally not protected, but decide (or check) before the repo goes public; page references and Starter Set wording were deliberately left out.

`ACTS`, `LIVRES_ACTS`, `PROFILES`, `INV0`, `WHO`, `BEASTS`, `RULES`, `FLOWS`, page refs and `frontiere_en.json` are **derived from Chaosium's Call of Cthulhu Starter Set** (paraphrased, but still derivative). Keep them out of any public repo: convert them to *private* story packs on your own machine. Publish only the engine, the spec, the sound library (respect CC BY credits) and original content (e.g. the sample story, the READS ambience texts if you rewrite them as generic).

## Suggested migration plan

1. ~~Create repo `grimoire/` with `grimoire-spec/` as `spec/`.~~ Done (Vite + React scaffold, legacy smoke tests).
2. Split `index.html` into modules; keep behaviour identical (Playwright smoke tests: home, new game, scene, dice, combat, sounds, FR/EN).
3. Write a converter: current `SCENARIOS` data → `story.json` packs (private), validate against `spec/story.schema.json`.
4. Make the engine load packs instead of constants; map skill ids ↔ display names per language.
5. Replace `window.claude` capabilities (narrator via Anthropic API, local persistence).
6. Story editor + AI import (screenshots/PDF/text → draft pack).
7. Tauri macOS wrapper.
