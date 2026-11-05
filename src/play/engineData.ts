// Builds what the legacy engine needs for one game: its data (from the story), its state (saved
// game, or a fresh one with the chosen investigators) and the keeper's characters in its format.
import type { CharacterData } from '@/characters/character'
import { skillKeyLabel } from '@/characters/character'
import {
  CHARACTERISTIC_INFO,
  CHARACTERISTICS,
  NAME_ORIGINS,
  OCCUPATIONS,
  PROFILE_FIELDS,
  SKILL_BY_ID,
  SKILLS,
  skillLabel,
} from '@/rules/d100'
import { storyToEngine, type StoryForEngine } from './legacy/adapter.ts'
import type { EngineFactories, EngineGlobals, LegacyState } from './host'

// ------------------------------------------------------------------ rules content

/**
 * Rules texts, glossary, bouts of madness, narrator instructions and translations come from the
 * rulebook: they live in private/engine-data.json (gitignored) on machines that have them.
 * Elsewhere the engine runs with the neutral fallbacks below.
 */
const privateFiles = import.meta.glob<{ default: Partial<EngineGlobals> }>('/private/engine-data.json', { eager: true })
const PRIVATE: Partial<EngineGlobals> = Object.values(privateFiles)[0]?.default ?? {}

const baseFor = (b: number | string): number | string => (b === 'EDU' ? 'ÉDU' : b)

const FALLBACK: Pick<EngineGlobals, 'I18N' | 'RULES' | 'GLOSS' | 'FOLIES' | 'NARR_RULES' | 'NARR_QUICK' | 'NAMES' | 'OCCS' | 'SKILLS' | 'CARS'> = {
  I18N: { ui: {}, pat: [], sk: {}, data: {} },
  RULES: [],
  // One entry keeps the glossary's pattern from matching everything.
  GLOSS: [['SAN', 'Santé mentale', "Résistance de l'investigateur face à l'horreur.", 'SAN']],
  FOLIES: Array.from({ length: 10 }, (_, i) => `Folie passagère ${i + 1} : voir les règles`),
  NARR_RULES: '',
  NARR_QUICK: [],
  NAMES: Object.fromEntries(Object.entries(NAME_ORIGINS).map(([k, o]) => [k, { n: o.label, f: o.f, h: o.m, s: o.surnames }])),
  OCCS: OCCUPATIONS.map((o) => ({
    n: o.label,
    sk: o.skills.map((s) => skillLabel(s)),
    social: o.social ? 1 : 0,
    free: 8 - o.skills.length - (o.social ? 1 : 0),
    spec: o.specialties ? Object.fromEntries(Object.entries(o.specialties).map(([k, v]) => [skillLabel(k), v])) : undefined,
    hint: o.hint,
  })),
  SKILLS: SKILLS.map((s) => [s.label, baseFor(s.base)]),
  CARS: CHARACTERISTICS.map((k) => {
    const c = CHARACTERISTIC_INFO[k]
    return [c.short, c.name, c.dice === '3D6' ? '3D6×5' : '(2D6+6)×5', c.what]
  }),
}

/** English for the labels the app adds to the game screen (scripts/extract-engine.mjs). */
const APP_UI_EN: Record<string, string> = {
  Narrateur: 'Narrator',
  'Narrateur (A)': 'Narrator (A)',
  'Fermer le narrateur': 'Close narrator',
  'PNJ de la scène': 'Scene NPCs',
  Investigateurs: 'Investigators',
}
const I18N: EngineGlobals['I18N'] = {
  ...(PRIVATE.I18N ?? FALLBACK.I18N),
  ui: { ...APP_UI_EN, ...PRIVATE.I18N?.ui },
}

export const hasPrivateRules = Object.keys(PRIVATE).length > 0

// ------------------------------------------------------------------ story

const labelOf = (id: string) => SKILL_BY_ID.get(id)?.label ?? skillKeyLabel(id)

export function engineGlobals(story: StoryForEngine): EngineGlobals {
  const e = storyToEngine(story, labelOf)
  return {
    ...FALLBACK,
    ...PRIVATE,
    I18N,
    SCENARIOS: [e.SCENARIO],
    BEASTS: { [story.meta.id]: e.BEASTS },
    INV0: e.INV0,
    WEAPONS: e.WEAPONS,
    AMB_FOR: e.AMB_FOR,
    SFX_FOR: e.SFX_FOR,
    NPC_X: e.NPC_X,
    SCENE_NPC: e.SCENE_NPC,
    NPC_ROWS: e.NPC_TABLE?.rows ?? [],
    NPC_TABLE: e.NPC_TABLE,
    WHO: e.WHO,
    WHO_NOTE: e.WHO_NOTE,
    RITUAL: e.RITUAL,
    NPC_WORDS: e.NPC_WORDS,
  }
}

// ------------------------------------------------------------------ characters

const CHAR_FR: Record<string, string> = { STR: 'FOR', CON: 'CON', SIZ: 'TAI', DEX: 'DEX', APP: 'APP', INT: 'INT', POW: 'POU', EDU: 'ÉDU' }

/** A keeper's investigator in the legacy engine's character format. */
export function toLegacyCharacter(id: string, c: CharacterData) {
  const car = Object.fromEntries(Object.entries(c.characteristics).map(([k, v]) => [CHAR_FR[k] ?? k, v]))
  const sk = Object.entries(c.skills)
    .map(([key, v]) => `${skillKeyLabel(key)} ${v}`)
    .join(' · ')
  const bg = Object.fromEntries(
    PROFILE_FIELDS.map((f) => [f.label, c.profile?.[f.id] ?? '']).concat(c.link ? [['Lien', c.link]] : []),
  )
  return {
    id,
    custom: true,
    n: c.name,
    job: [c.occupation, c.age ? `${c.age} ans` : ''].filter(Boolean).join(', '),
    pv: c.hp ?? 10,
    san: c.san ?? 50,
    chance: c.luck ?? 50,
    pm: c.mp ?? 10,
    dex: c.characteristics.DEX ?? 50,
    imp: c.damageBonus,
    car,
    sk,
    bg,
  }
}

// ------------------------------------------------------------------ state

/**
 * Investigators' progression lives on the investigator (the account), not in one game: when a saved
 * game is reopened, take the account's version, which may have moved on in another story.
 */
export function withAccountProgress(S: LegacyState, party: Array<{ id: string; data: CharacterData }>): LegacyState {
  const prog = (S.prog ?? {}) as Record<string, Record<string, unknown>>
  for (const c of party) {
    if (c.data.progress) prog[c.id] = { ...prog[c.id], ...c.data.progress, player: prog[c.id]?.player, owner: prog[c.id]?.owner }
  }
  return { ...S, prog }
}

export interface NewGame {
  storyId: string
  /** player: the name of who plays them, if anyone. */
  party: Array<{ id: string; data: CharacterData; player?: string }>
}

/** A fresh legacy state, straight into the game with the chosen investigators. */
export function freshState(f: EngineFactories, game: NewGame): LegacyState {
  const S = f.fresh() as {
    view: string; hv: string; cur: string; chars: unknown[]; players: Array<{ id: string; name: string }>
    prog: Record<string, Record<string, unknown>>; scen: Record<string, { party: unknown[] }>
  }
  S.view = 'jouer'
  S.hv = 'menu'
  S.cur = game.storyId
  S.chars = game.party.map((c) => toLegacyCharacter(c.id, c.data))
  S.players = []
  S.prog = S.prog ?? {}
  for (const c of game.party) {
    const name = c.player?.trim()
    let owner: string | null = null
    if (name) {
      let p = S.players.find((x) => x.name.toLowerCase() === name.toLowerCase())
      if (!p) S.players.push((p = { id: `p-${S.players.length + 1}`, name }))
      owner = p.id
    }
    S.prog[c.id] = { skills: {}, checks: [], hist: [], ...(c.data.progress ?? {}), player: name ?? '', owner }
  }
  // mkSlot reads the player from the engine's state, which doesn't exist yet: set it here.
  S.scen[game.storyId].party = S.chars.map((c) => ({
    ...(f.mkSlot(c) as object),
    player: S.prog[(c as { id: string }).id]?.player ?? '',
  }))
  return S as unknown as LegacyState
}
