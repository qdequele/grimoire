# Player companion: design

Date: 2026-11-05 · Status: awaiting approval

## Intent

At the table, players currently have nothing in hand: the keeper's screen holds every sheet. The
companion gives each player their investigator on their own phone (or laptop), opened from a link
or a QR code the keeper shows, with no account and no install. During play they see their sheet
change live as the keeper applies damage or sanity loss, adjust their own points, and write notes in
their investigator's notebook. Between sessions they can come back to reread it all.

Success: a player scans the QR code at the start of a session and is on their sheet in seconds;
when the keeper removes 3 SAN on the game screen, the phone shows it within a couple of seconds, and
the reverse.

## Goals

1. **Access by link, no login.** Two kinds of links, each shown as a QR code + copyable URL:
   - **Table link**, one per game: lists the game's investigators (with their player's name) and
     offers "Créer mon investigateur".
   - **Personal link**, one per investigator in a game: opens that sheet directly.
2. **Links belong to one game; investigators outlive it.** A link works for as long as its game
   exists, across all its sessions, until the keeper revokes it (a new one replaces it) or deletes
   the game. Players can use it between sessions. A new story means a new game and new links: there
   is no campaign concept. What must persist from game to game is the **investigator**: sheet,
   progression and notebook are saved in the keeper's account and come back whenever that
   investigator joins another game.
3. **Sheet**, mobile-first: name, occupation, age, HP / SAN / Luck / MP with − / + buttons,
   characteristics, skills with regular · hard · extreme values, skills ticked in play, profile
   (backstory, description).
4. **Live, both ways.** HP, SAN, Luck, MP changed on the game screen show on the phone; changed on
   the phone, they show on the game screen. Skill ticks from rolls show on the phone live.
5. **Notebook per investigator.** Each investigator has a notebook of timestamped notes. It is
   stored on the investigator (in the keeper's account, like progression), so it follows them into
   later games and campaigns.
6. **Everything is public at the table.** From the companion, anyone holding the game's link can
   read every investigator's notebook in that game (a "Lire les carnets" switcher, see mockup). The
   keeper sees each notebook on the investigator's card in the game screen's "Investigateurs" panel
   and on the Investigateurs page.
7. **Create from the phone.** From the table link, a player runs the same creation wizard as the
   keeper's, including AI profile help (counted against the keeper's `PROFILE_MONTHLY_LIMIT`). The
   new investigator is saved in the keeper's account and **joins the game straight away**: it
   appears on the keeper's game screen without reload.
8. Same look as the rest of the app (Art Deco / Classic skins, `gardien-skin`), same language
   setting logic (FR source + English dictionary via `t()`).

## Non-goals

- Player accounts or passwords.
- Players rolling dice or running the scene from the phone. Rolls stay on the keeper's screen.
- Players editing skills or characteristics (they only change through the keeper's progression
  flow / improvement phase).
- Showing scene content, NPCs, handouts, story text or keeper notes on the phone.
- A native app. One responsive web page, installable to the home screen (web app manifest); Tauri
  or native comes later.
- Offline play.

## Anti-goals (would make it a failure even if it works)

- A phone change silently lost or overwritten because the engine saved its whole state over it.
- The keeper's game screen getting slower, flickering or losing focus (e.g. in the notes box) when
  phones update.
- A link that exposes anything outside its game: other games, other investigators of the keeper's
  account, the keeper's private stories, the keeper's e-mail.
- A screen that looks like default shadcn instead of the Grimoire look.

## Decisions taken with the keeper (Quentin)

- Sheet first, notes second; notes written during play.
- Both a table link (choose or create) and personal links.
- HP / SAN / Luck / MP synced live, both directions.
- Notes are public, attached to the investigator's profile (not a table-wide timeline).
- Links per game, revocable. No campaign concept; what matters is that players' investigators stay
  saved (sheet, progression, notebook) from one game to the next.
- A player-created investigator joins the game immediately, no keeper approval.

## Calls made by Claude (check these)

- Players may change HP / SAN / Luck / MP but not skills or characteristics.
- Picking from the table link is open: any device holding it can pick any investigator of the game
  and then edit that investigator's points and notebook (no device claim). A personal link gives the
  same rights, restricted to one investigator. Other notebooks are read-only *in the UI* only; the
  server allows writes to any investigator of the token's game. The keeper can edit any notebook.
- Phone −/+ taps set the value only (a correction), they don't run `applyDamage` / sanity-loss
  rules: those stay on the keeper's screen. A phone SAN change also updates the investigator's
  persisted SAN (`S.prog[cid].san` → `characters.data.progress`), as the engine does.
- Only party members backed by an account investigator (`characters` row) appear in the companion.
  Investigators created inside the game screen (`newChar`) don't, until that path is wired to the
  account (out of scope).
- A player creating an investigator on the phone types their first name; it is matched (case- and
  accent-insensitive) to the keeper's players already in this game, else a new `players` row is
  created. The keeper's other players are never listed to the visitor.
- The narrator gets the notebooks of the game's investigators in its context (a few recent notes
  each, size-capped like `NOTES DU GARDIEN`).
- AI profile help on the phone counts against the keeper's limit.
- Delivery as a responsive web page + manifest, no store app.
- Holding the link = access. Anyone the link is forwarded to has the same rights; revocation is the
  remedy. Links are random, unguessable tokens (≥ 128 bits).

## Existing system the builder must know

- **Keeper-only accounts** (`profiles`), RLS everywhere: `characters`, `games`, `players` are
  `owner_id = auth.uid()`. Companion visitors are anonymous, so they cannot use these policies.
- **Game state** lives in `games.state.legacy`: the legacy engine's whole `S`, saved debounced by
  `PlayHost.save` (`src/play/host.ts`, `src/games/GamePage.tsx`), plus a browser copy, newest wins.
  The party is `S.scen[S.cur].party[]`, slots built by `mkSlot`: `{cid, player, pv, san, chance, pm,
  state, note}`. Progression per investigator is `S.prog[cid]` and is written back to
  `characters.data.progress`.
- **The engine is generated.** `public/play/engine.js` comes from `pnpm engine:extract`
  (`scripts/extract-engine.mjs`); every engine change is a `patch()` there with a reason. Anything the
  engine needs (receiving a remote change, adding an investigator mid-game, showing a notebook) goes
  through new patches and new `PlayHost` hooks.
- **Investigators created inside a game are not wired to the account today** (CLAUDE.md, "Not wired
  yet"). Goal 7 needs that path for companion-created investigators at least.
- **Characters**: `CharacterData` (`src/characters/character.ts`), creation wizard
  `src/characters/wizard/` (keeper-only today), `toLegacyCharacter` (`src/play/engineData.ts`) maps
  an account investigator to an engine character. AI help is the `suggest-profile` Edge Function.
- No Supabase Realtime is used anywhere yet.
- Tests: RLS tests (`pnpm test:db`), Playwright (`e2e/app.spec.ts`), i18n completeness test
  (`src/i18n/en.test.ts`). No scenario text in committed tests.

## Shape of the solution (constraints, not a prescription)

- **Access tokens**: a table storing link tokens (hashed) → game, kind (table / personal), optional
  investigator, revoked flag. Anonymous requests go through Edge Functions or `security definer`
  RPCs that resolve the token and touch only that game and its investigators. RLS tests must prove a
  token can't read or write outside its game.
- **Who's in the game** for the companion is the engine's party (`party[].cid`). The server side
  needs a reliable way to know that list without parsing ad hoc, e.g. the keeper's save also
  writes the party's character ids somewhere queryable.
- **Live sync**: some channel both the game screen and phones listen to (Supabase Realtime broadcast
  or postgres changes, scoped by game). Phone changes must reach the running engine as small
  operations (`set pv of cid X to 7`) applied to `S` and re-rendered, never as a whole-state
  overwrite; and the engine's own debounced save must not clobber them (anti-goal 1). When the game
  screen isn't open, phone changes still persist (e.g. to `games.state.legacy` slot fields or a
  side table the engine merges on load).
- **Notebook storage**: on the investigator (e.g. `characters.data.notebook` or a `character_notes`
  table). A separate table is likely easier for concurrent appends and realtime; builder's call.
- **Route**: a public route outside the auth guard, e.g. `/t/:token`, reusing the theme
  (`Masthead`, skins) and `t()`.
- **Keeper side**: a "Joueurs à la table" / QR control in the game screen toolbar and on the game
  page (generate, show QR, copy, revoke; one personal link per party slot).

## Left to the builder

Table and function names, realtime mechanism, conflict rules beyond anti-goal 1, QR library choice,
notebook entry format (dated entries vs free text: the mockup shows dated entries), exact mobile
layout within the Grimoire look, how the keeper edits a notebook.

## References

- Mockups (brainstorm session): `.superpowers/brainstorm/25102-1793877590/content/player-phone.html`
  (entry, sheet; its shared-timeline notes screen is superseded) and `player-notes-v2.html`
  (per-investigator notebook).
