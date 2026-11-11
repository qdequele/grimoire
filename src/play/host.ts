import type { EngineDice } from './dice'
import type { SampleMessage, SampleOptions } from './narrator'

// Contract between the app (GamePage) and the game screen iframe (play.html + boot.ts).
// The app puts a PlayHost on its window before loading the iframe; the iframe reads it from
// window.parent (same origin), sets GRIMOIRE_DATA / GRIMOIRE_HOST and starts the legacy engine.

/** Everything the legacy engine reads as GRIMOIRE_DATA.<NAME> (see scripts/extract-engine.mjs). */
export interface EngineGlobals {
  SCENARIOS: unknown[]
  BEASTS: Record<string, unknown[]>
  INV0: unknown[]
  WEAPONS: Record<string, unknown>
  AMB_FOR: Record<string, string[]>
  SFX_FOR: Record<string, string[]>
  NPC_X: Record<string, unknown>
  SCENE_NPC: Record<string, string[]>
  NPC_ROWS: string[][]
  /** Built in the iframe: { [storyId]: { p, note, rows: () => NPC_ROWS } }. */
  NPC_TABLE: { p: string; note: string; rows: string[][] } | null
  WHO: string[][]
  WHO_NOTE: string
  RITUAL: unknown
  NPC_WORDS: string[]
  /** The story's documents, by id (see LegacyHandout). */
  HANDOUTS: Record<string, unknown>
  /** The story's items, by id (see LegacyItem): listed in their scenes, given through PlayHost.giveItem. */
  ITEMS: Record<string, unknown>
  // Rules content (private when available, neutral fallbacks otherwise)
  I18N: { ui: Record<string, string>; pat: Array<[string, string]>; sk: Record<string, string>; data: Record<string, unknown> }
  RULES: unknown[]
  GLOSS: unknown[]
  FOLIES: string[]
  NARR_RULES: string
  NARR_QUICK: Array<[string, string]>
  NAMES: Record<string, unknown>
  OCCS: unknown[]
  SKILLS: Array<[string, number | string]>
  CARS: Array<[string, string, string, string]>
  /** Originals of the texts neutralised in the public engine (book references…), private. */
  TEXTS?: Record<string, string>
}

/** The legacy engine's state object S (opaque to the app, stored as is in games.state.legacy). */
export type LegacyState = Record<string, unknown>

export interface EngineFactories {
  fresh: () => LegacyState
  mkSlot: (c: unknown) => unknown
  newScenState: (sc: unknown) => unknown
}

export interface NotebookEntry { id: string; body: string; createdAt: string }

/** What the engine exposes to the app, as window.GRIMOIRE_ENGINE inside the iframe. */
export interface EngineApi {
  /** Set live values of the party slot of this investigator (current story); also S.prog[cid].san. Each value that changes gets a Journal line ("Name : PV 13 → 12"). Saves and re-renders. */
  setPoints(cid: string, v: { pv: number; san: number; chance: number; pm: number }): void
  /** Add an account investigator (legacy character from toLegacyCharacter) to the current party, if not there. `progress` is the account's characters.data.progress; the player is found or created in S.players. */
  addMember(c: unknown, player: string, progress?: Record<string, unknown>): void
  /** Notebooks shown on the investigator cards, by character id. */
  setNotebooks(n: Record<string, NotebookEntry[]>): void
  /** Photos (data URLs, by character id) shown in the investigators' round heads instead of their initials. Not saved in the state. Re-renders. */
  setPhotos(p: Record<string, string>): void
  /** A roll made on a phone, as a Journal line (plain text, escaped by the engine) under Dés, Tests or Santé mentale. Saves. */
  logRoll(text: string, kind: 'de' | 'test' | 'san'): void
  /** Account investigators' cards (src/items), by character id (every account investigator has a key). Not saved in the state. Re-renders. */
  setItems(items: Record<string, EngineItem[]>): void
}

/** A held card as the engine shows it (investigator cards, combat). */
export interface EngineItem {
  id: string
  /** Name, in the reader's language for catalogue cards. */
  n: string
  /** Kind (ItemKind). */
  k: string
  /** Uses left, and how many a full card holds (absent: none). */
  uses?: number
  cap?: number
  /** A weapon: skill id, the investigator's value in it, damage, adds the damage bonus, impales. */
  w?: { sk: string; v: number; dmg: string; db: boolean; imp: boolean }
}

export interface PlayHost {
  data: EngineGlobals
  /** Called once by the engine at startup to get its state. */
  loadState: (f: EngineFactories) => LegacyState
  /** Called by the engine's save() on every change. */
  save: (state: LegacyState) => void
  /** Back to the app's menu. */
  quit: () => void
  /** Open the "players at the table" dialog. */
  openTable?: () => void
  /** Open the ambiance screen dialog (link for the TV, handouts to push). */
  openScreen?: () => void
  /** What the ambiance screen shows for a scene: a page drawing it (/screen-preview…) and its description. */
  screenPreview?: (sceneId: string) => Promise<{ src: string; label: string } | null>
  /** A signed URL of a document's picture, if it has one in the story pack. */
  handoutImage?: (handoutId: string) => Promise<string | null>
  /** Show a document on the ambiance screen; false if the story has nothing to show for it. */
  showHandout?: (handoutId: string) => boolean
  /** Open an account investigator's full sheet above the game; false if the id isn't one. */
  openSheet?: (characterId: string) => boolean
  /** Open an account investigator's item cards above the game; false if the id isn't one. */
  openItems?: (characterId: string) => boolean
  /** A use of a held card spent (−1, a shot in combat) or regained. */
  useItem?: (itemId: string, delta: number) => void
  /** Give one of the story's items (its id in the story) to an investigator: a dialog above the game. */
  giveItem?: (storyItemId: string) => boolean
  /** The narrator's text generation (what claude.use("sample") gave in claude.ai). */
  sample?: (messages: SampleMessage[], opts?: SampleOptions) => Promise<{ text: string }>
}

declare global {
  interface Window {
    __grimoirePlay?: PlayHost
    GRIMOIRE_DATA?: EngineGlobals & { NPCS?: Record<string, unknown> }
    GRIMOIRE_HOST?: PlayHost
    GRIMOIRE_ENGINE?: EngineApi
    /** 3D dice for the engine's rolls (src/play/dice.tsx). */
    GRIMOIRE_DICE?: EngineDice
  }
}
