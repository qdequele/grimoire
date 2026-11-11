// Shapes of the legacy app's data constants (what its engine reads). Only types: no content.

/** [kind, label, value]: kind is "test" | "san" | "dmg". */
export type LegacyChip = [kind: string, label: string, value: string]

export interface LegacySec {
  h: string
  ul: string[]
}

export interface LegacyStep {
  h: string
  /** New-app: one of the choices of the step before (its condition, engine HTML). */
  br?: string
  txt?: string
  test?: string
  ok?: string
  ko?: string
  fail?: string
  extra?: string
}

export interface LegacyScene {
  id: string
  t: string
  p?: string
  lead?: string
  secs?: LegacySec[]
  read?: string[]
  flow?: LegacyStep[]
  after?: LegacySec[]
  note?: string
  chips?: LegacyChip[]
  table?: boolean
  lang?: string
  /** New-app flag: show secs before the read-aloud (the legacy app hard-coded one scene id). */
  secsFirst?: boolean
  /** New-app: ids of the scene's documents (GRIMOIRE_DATA.HANDOUTS). */
  hd?: string[]
  /** The story's items found in this scene (new-app addition): given to an investigator from there. */
  it?: string[]
}

/** New-app: a story document as the game screen shows it. */
/** A story item in the engine (new-app addition): its name and kind; the card itself is drawn by the app. */
export interface LegacyItem {
  t: string
  k: string
}

export interface LegacyHandout {
  /** Title, plain text. */
  t: string
  /** Text, engine HTML. */
  txt?: string
  /** Has a picture (asked from the host: GRIMOIRE_HOST.handoutImage). */
  img?: boolean
}

export interface LegacyAct {
  name: string
  scenes: LegacyScene[]
}

export interface LegacyScenario {
  id: string
  t: string
  players: string
  length: string
  status: string
  statusTxt: string
  desc: string
  party: string[]
  ritual: boolean
  who: boolean
  lang?: string
  acts?: LegacyAct[]
}

export interface LegacyBeast {
  id: string
  n: string
  pv: number
  dex: number
  arm: number
  esq: number
  san: string
  atk: Array<[name: string, skill: number, damage: string]>
  note?: string
}

export interface LegacyPregen {
  id: string
  n: string
  job: string
  pv: number
  san: number
  chance: number
  pm: number
  dex: number
  sk: string
}

/** The private dump (private/legacy-dump/*.json), one key per constant. */
export interface LegacyDump {
  SCENARIOS: LegacyScenario[]
  BEASTS: Record<string, LegacyBeast[]>
  NPCS: Record<string, { p: string; note: string }>
  NPC_X: Record<string, { n: string; d: string }>
  NPC_X_EN?: Record<string, { n: string; d: string }>
  SCENE_NPC: Record<string, string[]>
  PROFILES: string[][]
  LIVRES_PNJ: string[][]
  WHO: string[][]
  WHO_EN?: string[][]
  INV0: LegacyPregen[]
  WEAPONS: Record<string, { esq: number; atk: Array<[string, number, string]> }>
  AMB_FOR: Record<string, string[]>
  SFX_FOR: Record<string, string[]>
  /** English NPC table of the English scenario. */
  PROFILES_EN?: string[][]
  /** Footer of the "who knows what" tab (extracted from the engine code). */
  WHO_NOTE?: string
  /** Texts and numbers of the ritual panel (extracted from the engine markup and code). */
  RITUAL?: LegacyRitual
}

export interface LegacyRitual {
  title: string
  max: number
  step: number
  add: string
  sub: string
  start: string
  running: string
  full: string
  help: string
}
