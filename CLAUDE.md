# Grimoire (ex « Écran du Gardien ») — handoff notes

Keeper's companion web app for d100 investigation/horror tabletop games. Built iteratively in a claude.ai conversation as a **single HTML file** published as a claude.ai Artifact. This folder is the full state at handoff, to be migrated into a real project (web engine + story packs + Tauri macOS app).

## Layout

```
src/                  NEW app: Vite + React 19 + TypeScript (strict) + Tailwind v4 + shadcn/ui (base-nova)
  engine/             pure game rules, no UI: dice, success levels, damage. Unit-tested (Vitest).
  auth/ characters/ stories/ games/ import/ home/   features, co-located (page + TanStack Query hooks in api.ts)
  lib/supabase.ts     typed client; lib/database.types.ts is generated (`pnpm db:types`)
  components/ui/      shadcn components (add with `pnpm dlx shadcn@latest add <name>`)
  App.tsx             router (React Router) + providers
supabase/
  migrations/         schema + RLS (profiles, stories, characters, games, story_imports, import-pages bucket)
  seed.sql            generated from stories/ (`pnpm db:seed-gen`): original stories → marketplace
  functions/import-story/   AI import Edge Function (Deno). Own deno.json.
  functions/_shared/  import-draft.ts (draft schema, merge, → story.json), import-prompt.ts,
                      spec-bundle.ts (generated from spec/: `pnpm spec:bundle`), database.types.ts (generated)
  tests/              rls.test.ts (security rules), import-story.test.ts (function, fake Claude API)
scripts/              gen-seed.mjs, gen-spec-bundle.mjs
public/sons/*.mp3     sound library (ambiences amb-*, effects fx-*), shared by both apps
spec/                 story-pack format (STORY_FORMAT.md, story.schema.json, sounds.json)
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
pnpm test:db        # RLS security tests against the local DB
pnpm test:import    # import function end-to-end with a fake Claude API; first run:
                    #   supabase functions serve --env-file supabase/tests/functions.env
pnpm db:reset       # re-apply migrations + seed (wipes local data)
pnpm db:types       # regenerate DB types after a migration (app + function copies)
pnpm legacy         # old app → http://localhost:8000 (must be served over HTTP: sounds use fetch)
pnpm test           # engine unit tests
pnpm e2e            # Playwright, both apps (legacy project is skipped when legacy/index.html is absent)
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
- Not wired yet: "Sauvegarder la partie" snapshots (still browser-only), and investigators created or edited from inside a game (they stay in that game, not in the account).

## Story packs in Storage

Every story also exists as a story pack (spec/STORY_FORMAT.md) in the private `story-packs` bucket: `<owner id>/<story id>/story.json`, `images/…`, `sounds/…` (`marketplace/<story id>/…` for marketplace stories, writable by admins only). `stories.content` stays what the app reads; `stories.pack_files` lists the pack's other files.

- Import: Importer → "Packs Grimoire" (`src/import/PackImport.tsx`): one or more .zip, or a folder (a folder of pack folders imports them all; `splitPacks`). `src/stories/pack.ts` reads and checks packs (blocking errors vs schema warnings), `useImportPack` creates the private story, or updates the one with the same `meta.id` (its games keep working), then `writePack` uploads every file.
- Kept in sync: pack import, copy (`copyPackFiles`), delete (`deletePack`), AI import (the function writes story.json), the legacy converter. Any new code path that saves `stories.content` must also write the pack's story.json (`writeStoryJson`).
- Download: story page → "Télécharger le pack (.zip)" (`downloadPack`).
- `pnpm packs:sync` writes story.json for every story (backfill; `pnpm db:reset` runs it, the seed can't write Storage).
- The game engine doesn't show pack images or story sounds yet: they are stored and downloadable.

## Main menu

Reprendre la partie · Nouvelle partie (→ library) · **Histoires** (`/stories`: tabs Bibliothèque, Mes histoires `/stories/mine`, Importer `/stories/import`) · **Investigateurs** (`/characters`: tabs Investigateurs, Joueurs `/characters/joueurs`) · **Réglages** (`/settings`: theme, language). Sections share `src/theme/Section.tsx` (title + tab nav + Outlet). `/marketplace` and `/import` redirect to their new place.

- **Players** (`players` table): a first name, owned by the keeper. `characters.player_id` (FK on `(player_id, owner_id)`, so only your own players; deleting a player sets it to null). Investigators' progression stays in `characters.data.progress`; the Joueurs page reads it with `progressSummary`. The engine gets the player's name via `NewGame.party[].player`.
- **Language** (`src/settings/lang.ts`) is the `gardien-lang` key the game engine also reads: one setting for the app, the game screen, the default AI-import language and the AI profile suggestions.

## Translations (French source, English dictionary)

- The code is written in French and every visible text goes through `t()` (`src/i18n/t.ts`, `useT()` in components): the French text is the key, `src/i18n/en.ts` its English version. `t('Bonsoir, {name}', { name })`, plurals `t.n(n, '{n} joueur', '{n} joueurs')`, dates `t.date()`, sentences with bold parts `<Rich text={t('… **gras** …')} />`.
- Rules data (`src/rules/d100.ts`) stays French and is translated where shown. Skills have their own entries (`compétence:…`, via `skillName`/`skillText`) because some labels are also ordinary words (Bibliothèque, Lancer).
- `src/i18n/en.test.ts` scans the code for `t('…')` literals (+ `dataKeys()` in `keys.ts` for texts that come from data or props) and fails on a missing, unused or placeholder-mismatched English entry. When you add a text: wrap it in `t()`, add its English line.
- Story content is never translated: a story keeps its own language.

## Production

- Site: https://www.legrimoire.quest (Vercel project `grimoire`, deploys every push to `main`). Domain and DNS on Vercel.
- Supabase project `fovyhcbasmmstkocavlp` (linked). Vercel's Supabase integration provides `NEXT_PUBLIC_SUPABASE_*`; `vite.config.ts` uses them when `VITE_SUPABASE_*` aren't set.
- Hosted Auth requires e-mail confirmation (local doesn't). E-mails go through Resend (SMTP, sender on legrimoire.quest; DKIM/SPF/DMARC records on Vercel DNS).
- E-mail templates: `pnpm emails` (`scripts/gen-email-templates.mjs`) writes `supabase/templates/*.html`, used locally via `config.toml`. The hosted project doesn't read them: paste each one (and its subject) in Authentication → Emails → Templates after a change. French or English from `user_metadata.lang`, set at sign-up.
- Test e-mail addresses use `@example.com`: Supabase Auth rejects `.local` domains.

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
