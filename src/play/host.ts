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
  /** Set live values of the party slot of this investigator (current story); also S.prog[cid].san. Saves and re-renders. */
  setPoints(cid: string, v: { pv: number; san: number; chance: number; pm: number }): void
  /** Add an account investigator (legacy character from toLegacyCharacter) to the current party, if not there. `progress` is the account's characters.data.progress; the player is found or created in S.players. */
  addMember(c: unknown, player: string, progress?: Record<string, unknown>): void
  /** Notebooks shown on the investigator cards, by character id. */
  setNotebooks(n: Record<string, NotebookEntry[]>): void
}

export interface PlayHost {
  data: EngineGlobals
  /** Called once by the engine at startup to get its state. */
  loadState: (f: EngineFactories) => LegacyState
  /** Called by the engine's save() on every change. */
  save: (state: LegacyState) => void
  /** Back to the app's menu. */
  quit: () => void
  /** The narrator's text generation (what claude.use("sample") gave in claude.ai). */
  /** Open the "players at the table" dialog. */
  openTable?: () => void
  sample?: (messages: SampleMessage[], opts?: SampleOptions) => Promise<{ text: string }>
}

declare global {
  interface Window {
    __grimoirePlay?: PlayHost
    GRIMOIRE_DATA?: EngineGlobals & { NPCS?: Record<string, unknown> }
    GRIMOIRE_HOST?: PlayHost
    GRIMOIRE_ENGINE?: EngineApi
  }
}
