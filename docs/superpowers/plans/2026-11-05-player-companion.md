# Player Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players open a link / QR code from the keeper's game and get their investigator's sheet (live HP/SAN/Luck/MP, both ways) and notebook on their phone, without an account; they can also create an investigator that joins the game.

**Architecture:** Anonymous access goes through `security definer` Postgres RPCs keyed by a random link token (`table_links`). Live values live in a side table `game_points` (never inside the engine's saved blob) and are pushed to every screen with Supabase Realtime *broadcast from the database* on a per-game unguessable topic. The keeper's game screen writes its changes to `game_points` as diffs and applies phone changes to the running engine through a small API added by extraction patches. Notebooks are a `character_notes` table attached to the investigator.

**Tech Stack:** Supabase (Postgres RPCs, RLS, Realtime broadcast), Vite + React 19 + TS strict, TanStack Query, shadcn/ui (base-nova), Tailwind v4, Vitest, Playwright, `qrcode.react` for QR codes.

**Spec:** `docs/superpowers/specs/2026-11-05-player-companion-design.md`

## Global Constraints

- Every visible text goes through `t()` with its English line in `src/i18n/en.ts` (the `en.test.ts` scan must pass). French source.
- Look matches the legacy app (Art Deco / Classic skins via `html[data-skin]`, `Masthead`, eyebrow labels, diamond bullets, gold double rules), not default shadcn. Match the mockups in `.superpowers/brainstorm/25102-1793877590/content/` (`player-phone.html` screens 1–2, `player-notes-v2.html`).
- `public/play/engine.js`, `legacy.css`, `play.html` are generated: change `scripts/extract-engine.mjs` (`patch()` with a reason) and run `pnpm engine:extract`.
- Never `any`; TanStack Query for server state; invalidate related caches after mutations; Sonner toasts; `cn()`; lucide-react icons.
- No scenario text or names in committed tests or code.
- After every migration: `pnpm db:types`.
- Phones may change only `pv`, `san`, `chance`, `pm`; never skills or characteristics. Phone −/+ sets the value only, no `applyDamage`.
- Bounds for phone-set values: `pv` 0..max HP (`data.hp`), `san` 0..99, `chance` 0..99, `pm` 0..99. Note body 1..2000 characters after trim. A game party holds at most 12 investigators.
- Token: ≥ 128 random bits, URL-safe. A revoked link, or one whose game is deleted, gives error code `link_invalid`.
- AI profile help from a link counts against the game owner's `PROFILE_MONTHLY_LIMIT`.
- Do not add `Co-Authored-By` lines to commits (user rule).

## Review Focus

1. **Echo loops.** A phone change applied in the engine triggers `save()` → keeper flush; it must not be written back as a `keeper` change or re-broadcast forever. Pinned in Task 5 (`diffPoints` after a recorded remote change).
2. **Keeper screen closed while phones change values.** When the keeper reopens the game, phone values newer than the saved state win. Pinned in Task 5 (`applyPoints` with `since`) and Task 9 (e2e).
3. **Revoked link on an open phone.** The phone shows "Ce lien n'est plus valide" instead of crashing or showing stale data. Pinned in Task 9 (e2e) and Task 2 (`link_invalid`).
4. **Investigator deleted from the account while in a game.** It disappears from the companion; RPCs reject it. Pinned in Task 2.
5. **A phone-created investigator while the keeper's tab is closed.** It's in the party the next time the game opens, and the keeper's save doesn't drop it. Pinned in Task 5 (`addMissingMembers`), Task 6 (party from engine) and Task 9 (e2e).

## File Structure

```
supabase/migrations/20261106090000_companion.sql   tables, RLS, RPCs, broadcast triggers
supabase/tests/companion.test.ts                    RLS + RPC security tests (added to pnpm test:db)
supabase/functions/suggest-profile/index.ts         accepts a link token instead of a session
src/play/companion.ts (+ .test.ts)                  pure: points ↔ engine state, missing members
src/play/host.ts                                    PlayHost.openTable, EngineApi type
scripts/extract-engine.mjs                          engine API, notebook in investigator cards, toolbar button
src/games/GamePage.tsx                              points diff writes, live channel, party from engine
src/games/links.ts, TableLinksDialog.tsx            keeper: create / show QR / copy / revoke links
src/characters/notes.ts                             keeper notebook hooks
src/characters/NotebookDialog.tsx                   keeper reads / edits notebooks (Investigateurs page)
src/characters/wizard/host.tsx                      wizard dependencies (player field, AI help, draft key)
src/characters/wizard/CharacterWizard.tsx           wizard body extracted from CharacterWizardPage
src/companion/api.ts                                companion RPC hooks + live subscription
src/companion/sheet.ts (+ .test.ts)                 pure: skill rows (regular/hard/extreme), clamping
src/companion/CompanionLayout.tsx                   public shell, manifest, error states
src/companion/PickPage.tsx, SheetPage.tsx, Notebook.tsx, NewInvestigatorPage.tsx
e2e/companion.spec.ts                               keeper + phone in two browser contexts
```

---

### Task 1: Schema and keeper-side rules

**Files:**
- Create: `supabase/migrations/20261106090000_companion.sql`
- Create: `supabase/tests/companion.test.ts`
- Modify: `package.json` (`test:db` runs both `rls.test.ts` and `companion.test.ts`)

**Interfaces:**
- Produces tables (all with `owner_id uuid not null default auth.uid() references profiles on delete cascade`, RLS `owner_id = auth.uid()` for all ops, like `players`):
  - `characters`: add `constraint characters_id_owner_key unique (id, owner_id)`.
  - `games`: add `channel uuid not null default gen_random_uuid()` (realtime topic is `companion:<channel>`).
  - `table_links(id uuid pk, owner_id, game_id uuid not null → games on delete cascade, character_id uuid null → characters on delete cascade, token text not null unique default <24 random bytes, base64url, no padding>, revoked_at timestamptz, created_at timestamptz default now())`. Partial unique indexes: one active table link per game (`character_id is null and revoked_at is null`), one active personal link per `(game_id, character_id)`.
  - `character_notes(id uuid pk, owner_id, character_id uuid not null, body text not null check (char_length(btrim(body)) between 1 and 2000), created_at, updated_at)`, FK `(character_id, owner_id) → characters (id, owner_id) on delete cascade`, `touch_updated_at` trigger.
  - `game_points(game_id uuid → games on delete cascade, character_id uuid → characters on delete cascade, owner_id, pv int, san int, chance int, pm int, checks text[] not null default '{}', source text not null check (source in ('keeper','phone')), updated_at timestamptz not null default now(), primary key (game_id, character_id))`.
  - `revoke_table_link(p_link uuid) returns void` (security invoker): sets `revoked_at = now()` and rotates `games.channel` of that link's game.

- [ ] **Step 1: Write failing tests** in `companion.test.ts` (reuse the `signUp` helper pattern from `rls.test.ts`; copy it, don't import):
  - `keeper rows: links, notes and points are readable by their owner only` (alice inserts one of each; bob selects → `[]`).
  - `a note can't point at someone else's investigator` (alice inserts a note on bob's character → error).
  - `tokens are long and URL-safe` (`expect(token).toMatch(/^[A-Za-z0-9_-]{32,}$/)`).
  - `only one active table link per game` (second insert → error code `23505`; after `revoke_table_link` a new one succeeds).
  - `revoking rotates the game channel` (channel before ≠ after).
- [ ] **Step 2:** `pnpm db:reset && pnpm test:db` → the new tests FAIL (relations don't exist).
- [ ] **Step 3:** Write the migration (tables, indexes, RLS, `revoke_table_link`). Enable `pgcrypto` if `gen_random_bytes` isn't available.
- [ ] **Step 4:** `pnpm db:reset && pnpm db:types && pnpm test:db` → PASS (old and new).
- [ ] **Step 5:** Commit `Add companion tables: links, notebooks, live points`.

### Task 2: Anonymous RPCs (open, points, notes)

**Files:**
- Modify: `supabase/migrations/20261106090000_companion.sql`
- Modify: `supabase/tests/companion.test.ts`

**Interfaces:**
- All `security definer`, `set search_path = ''`, `grant execute … to anon, authenticated`. Errors are raised as `raise exception 'link_invalid'` / `'not_in_game'` / `'bad_value'` / `'party_full'` (the message is the code).
- Internal helper `companion_link(p_token text) returns table_links` (not granted): active link whose game exists, else `link_invalid`.
- Internal helper `companion_party(p_game uuid) returns setof uuid`: character ids from `games.state->'party'[*]->>'characterId'` that exist in `characters` with the game's owner.
- `companion_open(p_token text) returns jsonb`:
  ```
  { game: { id, channel, title },            -- title = stories.content->meta->>title
    focus: uuid | null,                      -- personal link's character
    canCreate: boolean,                      -- table links only
    party: [{ id, data, player }],           -- data = characters.data minus 'creation'; player = players.name or null
    points: [{ characterId, pv, san, chance, pm, checks, updatedAt }],
    notes: [{ id, characterId, body, createdAt }] }   -- notes of every party member, newest first
  ```
  `party` is always the whole party, even for a personal link (notebooks are readable by all).
- `companion_set_points(p_token text, p_character uuid, p_pv int, p_san int, p_chance int, p_pm int) returns void`: character must be in `companion_party` (and `= focus` for a personal link) else `not_in_game`; values out of the Global Constraints bounds → `bad_value`; upsert `game_points` with `source = 'phone'`, `updated_at = now()`, keep `checks`. When the character's `data.progress` exists, set `progress.san = p_san` (persisted SAN, spec "Calls").
- `companion_add_note(p_token text, p_character uuid, p_body text) returns uuid`: same membership rule; inserts with the character's owner.
- `companion_owner(p_token text) returns uuid`: game owner for an active link; **not** granted to anon/authenticated (service role only, used by Task 8).

- [ ] **Step 1: Write failing tests** (anonymous client = `createClient(url, anonKey)` without sign-up):
  - `opening a table link returns the party, its points and notes, without creation data` (party ids equal the game's `state.party`; no `creation` key; `canCreate` true).
  - `a personal link focuses its investigator but still lists the party` (`canCreate` false).
  - `a revoked link, or a deleted game, gives link_invalid` (both cases; `error.message` contains `link_invalid`).
  - `a link can't reach another game's investigators` (set_points / add_note on alice's character from a game link where it's not in the party → `not_in_game`).
  - `a personal link can't write to another party member` → `not_in_game`.
  - `points are bounded` (`p_san = 100` → `bad_value`; `p_pv` above `data.hp` → `bad_value`).
  - `a deleted investigator disappears from the companion` (delete character → absent from `party`; set_points → `not_in_game`).
  - `phone points are stored with source phone and update persisted SAN`.
  - `anonymous visitors can't call companion_owner or read the tables directly`.
- [ ] **Step 2:** `pnpm test:db` → FAIL.
- [ ] **Step 3:** Implement the functions.
- [ ] **Step 4:** `pnpm db:reset && pnpm db:types && pnpm test:db` → PASS.
- [ ] **Step 5:** Commit `Companion RPCs: open a link, set points, add notes`.

### Task 3: Create an investigator from a link, and live broadcast

**Files:**
- Modify: `supabase/migrations/20261106090000_companion.sql`
- Modify: `supabase/tests/companion.test.ts`

**Interfaces:**
- `companion_create_character(p_token text, p_data jsonb, p_player_name text) returns uuid`: table links only (else `not_in_game`); `p_data->>'name'` non-empty; party size < 12 else `party_full`. Player: the keeper's player whose `lower(btrim(name)) = lower(btrim(p_player_name))` (matches the existing unique index), else insert a new `players` row; empty name → no player. Inserts the character (owner = game owner), appends `{"characterId": id}` to `games.state->'party'`, inserts its `game_points` row from `data.hp/san/luck/mp` with `source = 'phone'`.
- Broadcast triggers (`security definer`), using `realtime.send(payload jsonb, event text, topic text, private boolean)` with `private = false` and topic `'companion:' || games.channel`:
  - after insert/update on `game_points` → event `points`, payload `{ characterId, pv, san, chance, pm, checks, source, updatedAt }`.
  - after insert/update/delete on `character_notes` → event `notes`, payload `{ characterId }`, sent to every unfinished game whose party contains the character.
  - in `companion_create_character` → event `member`, payload `{ characterId }`.

- [ ] **Step 1: Write failing tests:**
  - `a player creates an investigator that joins the game` (new id in `games.state.party`, row owned by the keeper, `game_points` row exists).
  - `the player's typed name reuses the keeper's player, case-insensitively` (keeper has "Léa"; create with " léa " → same `player_id`, no new player).
  - `personal links can't create` → `not_in_game`; `a 13th investigator` → `party_full`.
  - `points changes are broadcast on the game's topic` (subscribe an anon client to `companion:<channel>` broadcast `points`; call set_points; expect the payload within 5 s).
- [ ] **Step 2:** `pnpm test:db` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `pnpm db:reset && pnpm db:types && pnpm test:db` → PASS.
- [ ] **Step 5:** Commit `Companion: create an investigator from a table link, live broadcast`.

### Task 4: Engine API and notebooks in the game screen

**Files:**
- Modify: `scripts/extract-engine.mjs` (regenerates `public/play/engine.js`, `play.html`)
- Modify: `src/play/host.ts`
- Modify: `src/play/engineData.ts` (`APP_UI_EN` entries for the new labels)

**Interfaces:**
- `src/play/host.ts` adds:
  ```ts
  export interface NotebookEntry { id: string; body: string; createdAt: string }
  /** What the engine exposes to the app, as window.GRIMOIRE_ENGINE inside the iframe. */
  export interface EngineApi {
    /** Set live values of the party slot of this investigator (current story); also S.prog[cid].san. Saves and re-renders. */
    setPoints(cid: string, v: { pv: number; san: number; chance: number; pm: number }): void
    /** Add an account investigator (legacy character from toLegacyCharacter) to the current party, if not there. */
    addMember(c: unknown, player: string): void
    /** Notebooks shown on the investigator cards, by character id. */
    setNotebooks(n: Record<string, NotebookEntry[]>): void
  }
  ```
  and `PlayHost.openTable?: () => void`.
- Engine patches (each with a reason):
  1. Define `window.GRIMOIRE_ENGINE` at the end of the script implementing `EngineApi`. `setPoints` re-renders `renderInv()` and, in combat mode, `renderCombat()`. `addMember` pushes into `S.chars`, initialises `S.prog[c.id]` like `freshState` does, pushes `mkSlot(c)` with `player` into `ST().party`, then `save(); renderPlay();`.
  2. Investigator cards in the "Investigateurs" panel get a folded "Carnet (n)" section listing that investigator's notes (newest first, date + text, escaped with `esc`). Use the wrapper pattern (`const _riN=renderInv;renderInv=function(){_riN();…}`).
  3. Toolbar button "Joueurs à la table" (lucide-like inline SVG, like `NARR_ICON`) calling `GRIMOIRE_HOST.openTable&&GRIMOIRE_HOST.openTable()`.
  4. Narrator context (line with `NOTES DU GARDIEN`) gets `CARNETS DES INVESTIGATEURS : <name>: <last 5 notes joined by " | "> …`, capped to 1500 characters, `aucun` when empty.

- [ ] **Step 1:** Add the patches; run `pnpm engine:extract` → script succeeds (every patch matched once).
- [ ] **Step 2:** `pnpm typecheck && pnpm test && pnpm e2e` → PASS (game-screen test and parity unaffected; run `pnpm e2e:parity` when `legacy/index.html` is present and accept only differences caused by the new button/section — update the parity normalisation for them, with a comment).
- [ ] **Step 3:** Commit `Game screen: engine API for live changes, notebooks on investigator cards`.

### Task 5: Pure helpers: points ↔ engine state

**Files:**
- Create: `src/play/companion.ts`, `src/play/companion.test.ts`

**Interfaces:**
```ts
export interface Points { pv: number; san: number; chance: number; pm: number }
export interface PointsRow extends Points { characterId: string; checks: string[]; source: 'keeper' | 'phone'; updatedAt: string }
/** Current party values and checks of the account investigators in the engine state. */
export function pointsFromState(S: LegacyState, storyId: string): Map<string, Points & { checks: string[] }>
/** Rows to write: entries of `now` that differ from `last` (values or checks). */
export function diffPoints(now: ReturnType<typeof pointsFromState>, last: ReturnType<typeof pointsFromState>): Array<{ characterId: string } & Points & { checks: string[] }>
/** Phone rows newer than `since` (ms) applied to the party slots (and S.prog[cid].san). Returns a new state. */
export function applyPoints(S: LegacyState, storyId: string, rows: PointsRow[], since: number): LegacyState
/** Account investigators listed in the game but missing from the engine party, added like freshState does. */
export function addMissingMembers(S: LegacyState, f: Pick<EngineFactories, 'mkSlot'>, storyId: string, members: Array<{ id: string; data: CharacterData; player?: string }>): LegacyState
/** Character ids of the engine party (current story) that are account investigators. */
export function partyIds(S: LegacyState, storyId: string, accountIds: Set<string>): string[]
```

- [ ] **Step 1: Write failing tests** (structural fixtures, no scenario text):
  - `pointsFromState reads pv/san/chance/pm and prog checks per slot`.
  - `diffPoints returns only changed investigators` and `returns nothing after a remote change was recorded in last` (Review Focus 1: the caller sets `last` to the applied values).
  - `applyPoints ignores keeper rows and rows older than since` and `applies newer phone rows to slot and prog.san` (Review Focus 2).
  - `addMissingMembers adds a listed investigator once` (idempotent) (Review Focus 5).
  - `partyIds skips in-game investigators that aren't account ones`.
- [ ] **Step 2:** `pnpm test src/play/companion.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `pnpm test` → PASS.
- [ ] **Step 5:** Commit `Pure helpers for live points between the engine and the account`.

### Task 6: Keeper's game screen: live sync, party, notebooks, links dialog

**Files:**
- Modify: `src/games/GamePage.tsx`
- Create: `src/games/links.ts`, `src/games/TableLinksDialog.tsx`
- Modify: `src/i18n/en.ts`
- Add dependency: `qrcode.react` (version published ≥ 1 day ago)

**Interfaces:**
- Consumes Task 1–5 names.
- `src/games/links.ts`: `linkKeys`, `useGameLinks(gameId)` (active links, `revoked_at is null`), `useCreateLink()` (`{ gameId, characterId?: string }` → row), `useRevokeLink()` (calls `revoke_table_link`; invalidates links and `gameKeys.one(gameId)`), `linkUrl(token: string): string` = `${location.origin}/t/${token}`.
- `TableLinksDialog({ gameId, party: Array<{ id: string; name: string; player?: string }>, open, onOpenChange })`: table link section (QR via `QRCodeSVG`, URL, Copier, Révoquer et remplacer, Créer if none) and one row per party member (Créer / show QR / copy / revoke personal link). shadcn `Dialog`; legacy look.
- GamePage changes:
  - On load: fetch `game_points` and `character_notes` for the party; `withAccountProgress` → `addMissingMembers` (members = characters listed in `state.party`) → `applyPoints(…, since = saved.savedAt ?? 0)`.
  - `flush()`: `state.party` = `partyIds(legacy, storyId, accountIds).map(characterId => ({ characterId }))` instead of the stale `g.state.party`; upsert `diffPoints(now, lastWritten)` rows with `source: 'keeper'`; then `lastWritten = now`.
  - Subscribe `supabase.channel('companion:' + g.channel)` broadcast: `points` with `source === 'phone'` → `iframe.contentWindow.GRIMOIRE_ENGINE.setPoints(…)` and record the values in `lastWritten`; `notes` → refetch that character's notes → `setNotebooks`; `member` → fetch the character → `addMember(toLegacyCharacter(id, data), playerName)` and add it to the characters used by `saveProgress`. Unsubscribe on unmount; resubscribe when `g.channel` changes (after a revoke).
  - `PlayHost.openTable` opens `TableLinksDialog` rendered above the iframe.

- [ ] **Step 1:** Implement links hooks + dialog; wire `openTable`.
- [ ] **Step 2:** Implement load merge, flush changes and channel subscription.
- [ ] **Step 3:** `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` → PASS (existing game-screen test still saves and returns).
- [ ] **Step 4:** Commit `Game screen: table links with QR codes, live points and notebooks`.

(End-to-end proof is Task 9.)

### Task 7: Companion app: open a link, pick, sheet, notebook

**Files:**
- Create: `src/companion/api.ts`, `sheet.ts`, `sheet.test.ts`, `CompanionLayout.tsx`, `PickPage.tsx`, `SheetPage.tsx`, `Notebook.tsx`
- Modify: `src/App.tsx` (public routes, outside `RequireAuth` and `AppLayout`), `src/i18n/en.ts`, `src/i18n/keys.ts` if texts come from data

**Interfaces:**
- Routes: `/t/:token` (PickPage, or redirect to `c/:focus` for a personal link, or to the investigator remembered in `localStorage` key `grimoire-companion-<token>`), `/t/:token/c/:characterId` (SheetPage, tabs Fiche · Carnet · Profil), `/t/:token/nouveau` (Task 8).
- `src/companion/api.ts`:
  ```ts
  export interface CompanionView { game: { id: string; channel: string; title: string }; focus: string | null; canCreate: boolean
    party: Array<{ id: string; data: CharacterData; player: string | null }>
    points: PointsRow[]; notes: Array<{ id: string; characterId: string; body: string; createdAt: string }> }
  export const companionKeys: { one: (token: string) => readonly unknown[] }
  export function useCompanion(token: string): UseQueryResult<CompanionView, CompanionError>
  export function useSetPoints(token: string)   // optimistic update of points in the cache, rollback on error
  export function useAddNote(token: string)     // invalidates companionKeys.one(token)
  export function useCompanionLive(token: string, channel: string | undefined): void  // points → setQueryData; notes/member → invalidate
  export class CompanionError extends Error { code: 'link_invalid' | 'not_in_game' | 'bad_value' | 'party_full' | 'network' }
  ```
- `src/companion/sheet.ts`: `skillRows(data: CharacterData): Array<{ key: string; label: string; value: number; hard: number; extreme: number; checked: boolean }>` (sheet skills, `hard = floor(v/2)`, `extreme = floor(v/5)`, `checked` from `data.progress.checks` and live `checks`, labels via `skillKeyLabel`, sorted by label); `clampPoints(p: Points, maxHp: number): Points`.
- CompanionLayout: Grimoire masthead (compact), skin from `gardien-skin`, injects `<link rel="manifest">` (data-URL manifest with `start_url` = current URL, name "Grimoire", existing icons), states: loading, `link_invalid` → "Ce lien n'est plus valide. Demande un nouveau code au gardien.", network error with retry.
- SheetPage: four stat tiles with − / + (calls `useSetPoints` with `clampPoints`), "En direct avec le gardien" badge (subscribed state), characteristics, skill rows, Profil tab (profile fields + link). Notebook: own notebook editable (add note), "Lire les carnets" switcher over party members, read-only for others.

- [ ] **Step 1: Write failing tests** `sheet.test.ts`: `skillRows computes hard and extreme values and marks checked skills`; `clampPoints keeps values within 0..maxHp and 0..99`.
- [ ] **Step 2:** `pnpm test src/companion` → FAIL; implement `sheet.ts`; → PASS.
- [ ] **Step 3:** Implement api, layout, pages, routes. Check at 375 px width and on desktop in both skins against the mockups.
- [ ] **Step 4:** `pnpm typecheck && pnpm lint && pnpm test` → PASS (including `en.test.ts`).
- [ ] **Step 5:** Commit `Player companion: sheet, live points and notebooks from a link`.

### Task 8: Create an investigator from the phone (wizard reuse, AI help)

**Files:**
- Create: `src/characters/wizard/host.tsx`, `src/characters/wizard/CharacterWizard.tsx`, `src/companion/NewInvestigatorPage.tsx`
- Modify: `src/characters/wizard/CharacterWizardPage.tsx`, `steps.tsx`, `ProfileStep.tsx`, `supabase/functions/suggest-profile/index.ts`, `supabase/tests/suggest-profile.test.ts`

**Interfaces:**
- `host.tsx`:
  ```ts
  export interface WizardHost {
    PlayerInput: ComponentType<{ value: string; onChange: (playerId: string) => void }>
    playerName: (playerId: string | undefined) => string | undefined
    suggestProfile: (body: ProfileRequest) => Promise<Partial<Record<ProfileField, string>>>
    draftKey: string   // localStorage key of the unsaved draft
  }
  export const WizardHostProvider; export function useWizardHost(): WizardHost
  export const keeperWizardHost: WizardHost // PlayerField, usePlayers, supabase.functions.invoke('suggest-profile'), current key
  ```
  `steps.tsx` (`ConceptStep`, `SummaryStep`) and `ProfileStep.tsx` use `useWizardHost()` instead of `PlayerField` / `usePlayers` / direct invoke. `loadLocalDraft`/`saveLocalDraft` take the key.
- `CharacterWizard({ initial: CreationDraft, editing: boolean, onSave: (d: CreationDraft) => Promise<void>, extraActions?: ReactNode })`: step nav, steps, save button — the body of today's page. `CharacterWizardPage` keeps loading/routing/delete and renders it inside `WizardHostProvider value={keeperWizardHost}`.
- Companion host: `PlayerInput` = a plain first-name text input (the typed name held in page state, `playerId` unused); `suggestProfile` posts to `suggest-profile` with body `{ ...request, link: token }` and no session; `draftKey = 'grimoire-companion-draft-' + token`. `onSave` → `companion_create_character(token, toCharacterData(draft), name)` → store id in `grimoire-companion-<token>` → navigate to `/t/:token/c/:id`.
- `suggest-profile`: when there's no signed-in user and `body.link` is a string, resolve the owner with the service client `rpc('companion_owner', { p_token })` (null → 401 `link_invalid`) and use that id for the quota and `ai_usage`. `parseProfileRequest` ignores `link`.

- [ ] **Step 1: Write failing test** in `supabase/tests/suggest-profile.test.ts`: `a table link uses the game owner's quota` (call with `link` and no session → 200 with the fake API; an `ai_usage` row for the owner); `a revoked link is refused` → 401.
- [ ] **Step 2:** `pnpm test:import` → FAIL; implement function change; → PASS.
- [ ] **Step 3:** Extract `CharacterWizard` + `WizardHost`; keeper flow unchanged: `pnpm e2e` (the creation tests) → PASS.
- [ ] **Step 4:** Implement `NewInvestigatorPage` (`canCreate` false → back to the sheet with a toast).
- [ ] **Step 5:** `pnpm typecheck && pnpm lint && pnpm test` → PASS. Commit `Players create their investigator from the table link`.

### Task 9: Keeper notebooks page, end-to-end tests, docs

**Files:**
- Create: `src/characters/notes.ts`, `src/characters/NotebookDialog.tsx`, `e2e/companion.spec.ts`
- Modify: `src/characters/CharactersPage.tsx`, `src/i18n/en.ts`, `CLAUDE.md`

**Interfaces:**
- `notes.ts`: `noteKeys`, `useNotes(characterId)`, `useUpdateNote()`, `useDeleteNote()` (RLS owner; invalidate `noteKeys`).
- CharactersPage card: "Carnet (n)" button → `NotebookDialog` (list newest first, edit / delete each note).

- [ ] **Step 1: Write the e2e tests** (`e2e/companion.spec.ts`, keeper and phone as two browser contexts, phone at 390×844; structural selectors only):
  - `keeper shows the table link; a player picks an investigator and sees their sheet`.
  - `SAN removed on the game screen shows on the phone, and HP changed on the phone shows on the game screen` (each within 5 s).
  - `a note written on the phone appears on the investigator card of the game screen and on the Investigateurs page`.
  - `a player creates an investigator from the phone; it joins the keeper's game without reload, and is still there after the keeper reloads`.
  - `revoking the link shows "link no longer valid" on the phone after reload` (Review Focus 3).
  - `phone changes made while the keeper's tab is closed are there when the game reopens` (Review Focus 2).
- [ ] **Step 2:** `pnpm e2e e2e/companion.spec.ts` → failures only where Task 9 UI is missing; implement `notes.ts` + `NotebookDialog`; → PASS.
- [ ] **Step 3:** Update `CLAUDE.md`: a "Player companion" section (routes, tables, RPCs, realtime topic, engine API, what's not wired: in-game-created investigators don't appear), and remove nothing else. Mintlify docs don't exist in this repo yet: out of scope, mention it to the user.
- [ ] **Step 4:** Full check: `pnpm typecheck && pnpm lint && pnpm build && pnpm test && pnpm test:db && pnpm test:import && pnpm e2e` → PASS.
- [ ] **Step 5:** Commit `Keeper reads players' notebooks; companion end-to-end tests and notes`.
