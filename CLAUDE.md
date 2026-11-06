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
- Known, intended differences: in English the new app translates the ritual panel and rules sheet (the original left them in French until the language was switched by hand); the English glossary/translation race is normalised in the parity test.
- Narrator: the engine's `claude.use("sample")` call is patched to `GRIMOIRE_HOST.sample` (`src/play/narrator.ts`, same contract: streaming `onText`, abort, error codes), backed by the `narrate` Edge Function (`_shared/narrate.ts`: validation, prompt-cache split at "CONTEXTE ACTUEL DE LA PARTIE"). `NARRATOR_MONTHLY_LIMIT` (300) per account in `ai_usage`. No global `window.claude` shim: the engine's saves list only loads when `window.claude` is absent.
- Not wired yet: "Sauvegarder la partie" snapshots (still browser-only), and investigators created or edited from inside a game (they stay in that game, not in the account, and don't appear on players' phones).

## Player companion (players' phones)

Players open a link or QR code from the keeper on their phone, with no account: they follow and change their investigator's live points, keep a notebook, or create an investigator.

- **Routes** (`src/companion/`, public, no app chrome): `/t/:token` picks an investigator (or redirects to the remembered one, `grimoire-companion-<token>`, or to a personal link's), `/t/:token/c/:id` Fiche (HP/SAN/Luck/MP − +, characteristics, skills), `…/carnet`, `…/profil`, `/t/:token/nouveau` (the keeper's `CharacterWizard` with a first-name field). A revoked link shows "Ce lien n'est plus valide…".
- **Keeper side**: the engine toolbar's "Joueurs à la table" opens `TableLinksDialog` (`src/games/`, above the iframe): one table link (anyone joins or creates an investigator) and per-investigator personal links; create, QR, copy, revoke. Investigateurs page: "Carnet (n)" on each card opens `NotebookDialog` (`src/characters/notes.ts`: read, edit, delete the players' notes; owner RLS).
- **Tables**: `table_links` (token, game, `character_id` null = table link, `revoked_at`), `character_notes` (1..2000 chars, owner RLS for all operations), `game_points` (live pv/san/chance/pm/checks per game and investigator, `source` keeper|phone, server `updated_at`). `games.channel` is the realtime topic id; revoking rotates it. Link tokens are stored in plain text (the keeper's dialog re-shows their QR codes; owner-only RLS).
- **RPCs**: phones call security-definer RPCs with the token (`companion_open`, `companion_set_point` (one field), `companion_add_note`, `companion_create_character`; errors `link_invalid`, `not_in_game`, `bad_value`, `party_full`). Keeper: `revoke_table_link`, and `save_game_state` (the game screen's save: keeps investigators a phone added since the last load unless the keeper removed them; stamps `state.serverSavedAt`, the server's time). `companion_owner` is service-role only (suggest-profile charges the game owner's quota for a table link).
- **Phone sheets are untrusted**: `companion_create_character` rebuilds the sheet with `companion_clean_character` (only `CharacterData`'s keys, typed and bounded values, < 64 KB, `progress` dropped; anything else is `bad_value`). Skill keys must look like the app's (`id` or `id:specialty`), and `< > & "` are refused in the name, skill keys and the player's first name. The game screen also coerces values (`toLegacyCharacter`) and the extraction escapes them where the engine renders them, skill and player names included (dice result line, roll picker results, "Modifier la partie" warnings). The phone's wizard applies the same limits (`SHEET_LIMITS` in `src/characters/character.ts`, `maxLength` and a message under the field; `companionSheetProblems` names the field before sending). Keep all layers in step when adding a field. The typed first name reuses any of the keeper's players with that name, case-insensitively.
- **Realtime**: broadcast topic `companion:<games.channel>`, sent by DB triggers: `points` (full row, camelCase), `notes`, `member` and `roll` (`{ characterId }`), and `rotate` (empty, from `revoke_table_link` on the old topic just before the channel changes). The topic is public: anyone with a link can send on it. The game screen (`GamePage.tsx`) treats every event as a hint and re-reads the database under its RLS (`game_points` row, `games.state.party`, notes; `rotate` refetches the game). Phones apply `points` payloads for display only, clamped to the server's bounds, and refetch `companion_open` on `notes`, `member`, `rotate`. Both refetch on (re)subscribe to catch up.
- **Engine API**: `window.GRIMOIRE_ENGINE` (extraction patch, type `EngineApi` in `src/play/host.ts`): `setPoints(cid, v)`, `addMember(c, player, progress?)`, `setNotebooks(map)` (the folded "Carnet (n)" on investigator cards). The game screen writes the keeper's point changes to `game_points` (`source: 'keeper'`) and applies phone rows on load, so changes made while its tab is closed show when it reopens.
- **Skill help and dice rolls** (Fiche and Dés tabs): tapping a skill, a characteristic, SAN or Luck opens `RollDialog` (`src/companion/Dice.tsx`): what it is for (`SkillDef.what` in `src/rules/d100.ts`, original texts, English in `en.ts`), thresholds, bonus/penalty dice (±2), then a d100. The Dés tab rolls 1–10 dice of D3…D100 ± 20 and lists this phone's last rolls (memory only). The **server rolls** (`companion_roll_check`, `companion_roll_dice`, `random()`); the phone sends what is rolled (`subject`: `skill:<key>`, `char:<STR…>`, `san`, `luck`) and the value it shows, which the keeper sees next to the result. Rows in `game_rolls` (owner RLS, 100 newest per game), a `roll` hint `{ characterId }` on the game's topic; the game screen reads new rows (`src/games/rolls.ts`, `rollFeed`) and shows a toast per roll (`rollMessage` in `src/companion/rolls.ts`). Rolls are not written into the engine's journal and a success doesn't tick the skill: the keeper does that, as before.
- **Tests**: `supabase/tests/companion.test.ts` (`pnpm test:db`), `e2e/companion.spec.ts` (keeper + 390×844 phone contexts; shared flows in `e2e/helpers.ts`), `src/companion/rolls.test.ts`.
- **Not wired / known limits**: investigators created inside the game screen don't appear on phones; two writers on the same field: last writer wins; no rate limit on notes or rolls (anyone with a link can write many; rolls are pruned to 100 per game); any active link, personal links included, lets its holder spend the keeper's AI profile-suggestion quota (`PROFILE_MONTHLY_LIMIT`).

## Story packs in Storage

Every story also exists as a story pack (spec/STORY_FORMAT.md) in the private `story-packs` bucket: `<owner id>/<story id>/story.json`, `images/…`, `sounds/…` (`marketplace/<story id>/…` for marketplace stories, writable by admins only). `stories.content` stays what the app reads; `stories.pack_files` lists the pack's other files.

- Import: Importer → "Packs Grimoire" (`src/import/PackImport.tsx`): one or more .zip, or a folder (a folder of pack folders imports them all; `splitPacks`). `src/stories/pack.ts` reads and checks packs (blocking errors vs schema warnings), `useImportPack` creates the private story, or updates the one with the same `meta.id` (its games keep working), then `writePack` uploads every file.
- Kept in sync: pack import, copy (`copyPackFiles`), delete (`deletePack`), AI import (the function writes story.json), the legacy converter. Any new code path that saves `stories.content` must also write the pack's story.json (`writeStoryJson`).
- Download: story page → "Télécharger le pack (.zip)" (`downloadPack`).
- `pnpm packs:sync` writes story.json for every story (backfill; `pnpm db:reset` runs it, the seed can't write Storage).
- The game engine doesn't show pack images or story sounds yet: they are stored and downloadable.

## Ambiance screen (TV / tablet at the table)

- `/screen/:token` (`src/screen/`): full-screen, no account. A slowly living background for the current scene (still picture with slow pan and zoom, or a generated gradient) plus preset layers (`fog`, `rain`, `candle`, `hearth`, `night`, `storm`, `dust`: fog bands, grain, vignette, flicker, one small particle canvas, lightning; `hearth` draws a live fire with its flickering light, `src/screen/Hearth.tsx`, at the scene's `screen.fire` place inside the pan-and-zoom), crossfade between scenes, handouts on "paper" over a dimmed scene. Transforms and opacity only; `prefers-reduced-motion` stops the motion. A tap starts full screen, sound and the Wake Lock; the cursor hides when idle.
- Same mechanism as the player companion, separate pieces: `screen_links` (one active per game, revocable), anonymous `screen_open(token)` → `{ channel, screen }` only, Realtime broadcast of `games.screen` on `screen:<games.screen_channel>` (trigger). Revoking rotates `screen_channel` only, so phones stay connected. A screen token is not a companion token.
- `games.screen` is `ScreenState` (`src/screen/state.ts`: pure reducer, follow vs pinned, preset override, handout). The keeper's game screen owns it: `ScreenControl` (`src/games/screen.ts`) follows the engine's scene through `PlayHost.save`/`loadState` (no engine patch for that), signs picture URLs (8 h, renewed hourly while the game is open) and writes `games.screen`. The screen never reads Storage itself.
- Scene → ambiance: `sceneAmbiance` (`src/screen/ambiance.ts`): the scene's `screen: { image, preset, fire }` (spec §4.5), else a preset from its `ambience` sounds and its first `images` entry with `keeperOnly: false`. Pictures missing from `pack_files` are ignored.
- Keeper UI: toolbar button `#qaScreen` (extraction patch) → `ScreenDialog` (link + QR, follow, preset, sound, push/clear handouts: story handouts, scene images, pictures uploaded to the private `screen-images` bucket, `<owner>/<game>/…`).
- Tests: `src/screen/*.test.ts`, `supabase/tests/screen.test.ts` (`pnpm test:db`), "ambiance screen" in `e2e/app.spec.ts` (two pages).

## Story creator (AI)

Histoires → **Créer** (`/stories/create`, `src/stories/create/`): a questionnaire, then Claude writes an original private story.

- Steps: Cadre (story language, era, place) · Ambiance (tone, threat) · Intrigue (mystery, ideas) · Table (investigators, length, content to avoid) · Plan · Écriture. react-hook-form + zod (`brief.ts`); everything empty is left to Claude. Progress (answers, creation id, edited outline) is kept in `localStorage` (`grimoire-story-creator`).
- `create-story` Edge Function, one function with three actions (shared auth, quotas, cached system prompt): `ideas` ("Inspire-moi" / ↻: fills only empty fields, effort low, `STORY_IDEAS_MONTHLY_LIMIT` 50 in `ai_usage` kind `story-ideas`); `outline` (phase 1: secret, acts, scenes, NPCs; a new creation counts against `STORY_CREATE_MONTHLY_LIMIT` 10/month, rewrites with the keeper's notes are capped by `STORY_OUTLINES_PER_STORY` 5); `write` (phase 2: the next `STORY_SCENES_PER_CALL` (2) scenes as an `ImportDraft`, merged, `draftToStory`, validated, saved as a private story + pack story.json; the browser loops until `remaining` is 0, and can resume after an error or a reload). Admins are unlimited.
- The keeper reviews the outline before any scene is written: rename, rewrite summaries/secret, remove scenes, or ask for a new outline with notes. The edited outline goes with the first `write` call and is frozen after.
- State: `story_creations` (brief, outline, accumulated draft, story id, tokens; read own, function writes). Created stories carry `meta.tags: ['grimoire-creator']` (badge "Création privée") and `license: private`.
- Pure logic in `_shared/story-create.ts` (brief/outline parsing, batching, ordering, `createdStory`), prompts in `_shared/create-prompt.ts` (originality rules + `FORBIDDEN_NAMES`, lines and veils; exported section by section, the MCP guide serves the same text). Saving (story row + pack story.json) is `_shared/story-save.ts`, shared with the MCP connector. Forbidden names found in a created story are reported in `validationErrors` (not refused). Presets (tones, threats, lengths) exist in both `src/stories/create/brief.ts` (French labels) and `_shared/story-create.ts` (English prompt text); a unit test keeps the ids in sync.
- Tests: `story-create.test.ts` (unit), `supabase/tests/create-story.test.ts` (function, fake Claude answers from `supabase/tests/fake-creator.ts`, also used by the e2e test; set `FUNCTIONS_URL` to test a function served elsewhere, e.g. `deno run` of `index.ts` with `DENO_SERVE_ADDRESS`), e2e "keeper creates an original story".

## MCP connector (ChatGPT and Claude)

Keepers create and revise stories from ChatGPT or Claude. The chat app's model writes; Grimoire guides it, then checks, converts and saves (no Claude API call, no tokens paid).

- **Endpoint**: `supabase/functions/mcp` (remote MCP, Streamable HTTP, stateless, JSON responses; official SDK's low-level `Server` + `WebStandardStreamableHTTPServerTransport`). Public address `https://www.legrimoire.quest/mcp` (`vercel.json` rewrites it, and its `.well-known/oauth-protected-resource`, to the function); locally `http://127.0.0.1:54321/functions/v1/mcp`. `verify_jwt = false` in `config.toml`: it answers discovery without a token and checks the token itself.
- **Sign-in**: OAuth 2.1 with Supabase Auth's OAuth server (dynamic client registration on). A request without a token gets `401` + `WWW-Authenticate: Bearer resource_metadata=…`; the metadata names `<supabase>/auth/v1`. The keeper approves the client on **`/oauth/consent`** (`src/auth/OAuthConsentPage.tsx`, supabase-js `auth.oauth.*`; `/login?next=` brings a signed-out keeper back there). The access token is an ordinary user JWT: stories and pack files are read and written with it (RLS), the service role only writes `story_creations` and `ai_usage`. Supabase doesn't support resource indicators (RFC 8707), so any valid session token works: the tools can do nothing the keeper's own session can't.
- **Tools** (`_shared/story-mcp.ts`: definitions, `normalizeDraft`, `applyEdits`, `forbiddenNamesIn`, guide): `grimoire_guide` (workflow, rules, format, sounds, example; same sections as the creator prompt), `save_outline` (brief + approved outline → a `story_creations` row with `source: 'mcp'`; replaceable until the first scene is written), `write_scenes` (1–4 scenes of the outline as an `ImportDraft`, coerced, merged, saved each call like the web creator; `succeeded` when the last scene is in, then closed), `list_my_stories`, `get_story` (story.json parts + `version` = `updated_at`), `edit_story` (story.json operations: put/remove scene, act, NPC, handout, set overview/info; all or none; conditional update on `version` → `conflict`; refused while a creation is still writing the story; must not add schema errors).
- **Server-side rules**: names from `FORBIDDEN_NAMES` are refused (in edits, only names the story didn't already have: private stories converted from books may carry them); only the keeper's private stories; ≤ 512 KB requests, ≤ 2 MB stories, 20 operations per edit. Limits: `MCP_STORIES_MONTHLY_LIMIT` (30 new stories, counted apart from the web creator's 10 via `story_creations.source`), `MCP_EDITS_DAILY_LIMIT` (500, `ai_usage` kind `mcp-edit`). Admins unlimited. Env also: `MCP_PUBLIC_URL`, `MCP_AUTH_SERVER` (local values in `supabase/tests/functions.env`), `APP_URL` (story links).
- **Keeper UI**: Réglages → "ChatGPT et Claude" (`src/settings/ChatConnectors.tsx`): connector address + copy, steps for each app, the optional Claude skill (`skills/grimoire-story/SKILL.md`, zipped in the browser), connected apps (`listGrants` / `revokeGrant`). The creator's step list links there.
- **Tests**: `story-mcp.test.ts` (unit), `supabase/tests/mcp.test.ts` (`pnpm test:import`: discovery, every tool through the official MCP client, isolation, limits), `e2e/mcp.spec.ts` (project `mcp`: registration → authorize → login → consent → PKCE code exchange → tool call with the OAuth token; deny; English; disconnect). Local Auth sends the keeper to its `site_url` (`127.0.0.1:5173`) while `pnpm dev` answers on `localhost`: the e2e test rewrites that redirect; to try the connector by hand (e.g. `npx @modelcontextprotocol/inspector`), run `pnpm dev --host 127.0.0.1`.
- **Deploying**: merging to `main` ships the migration (`20261107090000_mcp_connector.sql`), the function and the rewrites in order. Manual prerequisites on the hosted project, before the merge: Dashboard → Authentication → OAuth Server → enable, allow dynamic OAuth apps, authorization path `/oauth/consent`; function secret `MCP_PUBLIC_URL=https://www.legrimoire.quest/mcp`. Then add the connector in claude.ai and in ChatGPT (developer mode) and create one short story in each.

## Main menu

Reprendre la partie · Nouvelle partie (→ library) · **Histoires** (`/stories`: tabs Bibliothèque, Mes histoires `/stories/mine`, Créer `/stories/create`, Importer `/stories/import`) · **Investigateurs** (`/characters`: tabs Investigateurs, Joueurs `/characters/joueurs`) · **Réglages** (`/settings`: theme, language, ChatGPT and Claude connector). Sections share `src/theme/Section.tsx` (title + tab nav + Outlet). `/marketplace` and `/import` redirect to their new place.

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
