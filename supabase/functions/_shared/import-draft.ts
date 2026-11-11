// The intermediate format of the AI import, the story creator and the MCP connector.
//
// story.schema.json is too large and too loose for a model to fill reliably, so the model writes
// this simpler "draft" shape instead: every field present, "absent" written as "" / [] / an
// unlisted stat. draftToStory() turns it into a real story.json, which is then validated against
// spec/story.schema.json.
//
// The draft schema is NOT sent as a structured output (output_config.format): its compiled grammar
// is too large for the API ("The compiled grammar is too large"). The model gets the schema as text
// (draftAnswerFormat), answers with plain JSON, and normalizeDraft() coerces whatever it sent into a
// well-typed ImportDraft (unknown enum values dropped, sizes capped).
//
// Pure TypeScript, no Deno or browser APIs: used by the Edge Functions and unit-tested with Vitest.
import { SOUNDS, STORY_SCHEMA } from './spec-bundle.ts'

export const ROLL_TYPES = ['skill', 'characteristic', 'luck', 'san', 'damage', 'opposed', 'group'] as const
export const DIFFICULTIES = ['regular', 'hard', 'extreme'] as const
export const STAT_KEYS = [
  'STR', 'CON', 'SIZ', 'DEX', 'APP', 'INT', 'POW', 'EDU',
  'hp', 'mp', 'san', 'move', 'build', 'armor', 'dodge', 'attacksPerRound',
] as const
const CHARACTERISTICS = ['STR', 'CON', 'SIZ', 'DEX', 'APP', 'INT', 'POW', 'EDU'] as const

/** The allowed values of a scene's `screen.<field>`, read from spec/story.schema.json (one source of truth). */
function screenEnum(field: 'place' | 'preset' | 'time'): string[] {
  let found: string[] = []
  const walk = (v: unknown): void => {
    if (found.length || !v || typeof v !== 'object') return
    const o = v as Record<string, unknown>
    const screen = o.screen as { properties?: Record<string, { enum?: unknown }> } | undefined
    const values = screen?.properties?.[field]?.enum
    if (Array.isArray(values)) found = values.filter((x): x is string => typeof x === 'string')
    else Object.values(o).forEach(walk)
  }
  walk(STORY_SCHEMA)
  return found
}

/** Drawn décors of the ambiance screen (church, graveyard…), shown when a scene has no picture. */
export const SCREEN_PLACES: readonly string[] = screenEnum('place')
/** Atmospheres of the ambiance screen (fog, rain, ritual…). */
export const SCREEN_PRESETS: readonly string[] = screenEnum('preset')
/** Time of day on the ambiance screen (day, dusk, night). */
export const SCREEN_TIMES: readonly string[] = screenEnum('time')

/** The allowed values of an item field, read from spec/story.schema.json ($defs.item). */
function itemEnum(path: string[]): string[] {
  let v: unknown = (STORY_SCHEMA as { $defs?: { item?: unknown } }).$defs?.item
  for (const k of path) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined
  const values = (v as { enum?: unknown } | undefined)?.enum
  return Array.isArray(values) ? values.filter((x): x is string => typeof x === 'string') : []
}
/** Item kinds (weapon, ammo, light…), illustrations, weapon skills and use units. */
export const ITEM_KINDS: readonly string[] = itemEnum(['properties', 'kind'])
export const ITEM_ARTS: readonly string[] = itemEnum(['properties', 'art'])
export const ITEM_WEAPON_SKILLS: readonly string[] = itemEnum(['properties', 'weapon', 'properties', 'skill'])
export const ITEM_UNITS: readonly string[] = itemEnum(['properties', 'unit'])

export interface DraftRoll {
  type: (typeof ROLL_TYPES)[number]
  options: string[]
  difficulty: (typeof DIFFICULTIES)[number]
  bonus: number
  san: string
  dice: string
  label: string
  againstNpc: string
  againstSkill: string
}

export interface DraftStep {
  title: string
  /** One of several choices of the step before it: the choice ("If she burns the letters"), else "". */
  branch: string
  text: string
  /** Zero or one roll (an array instead of an optional field). */
  roll: DraftRoll[]
  success: string
  failure: string
  pushed: string
  extra: string
  goto: string[]
}

export interface DraftScene {
  id: string
  title: string
  ref: string
  lead: string
  readAloud: string[]
  flow: DraftStep[]
  notes: Array<{ title: string; items: string[] }>
  npcs: string[]
  handouts: string[]
  rolls: DraftRoll[]
  ambience: string[]
  sfx: string[]
  /** Ambiance screen: drawn décor (one of SCREEN_PLACES) and atmosphere (one of SCREEN_PRESETS), "" = let the app choose. */
  place: string
  preset: string
  /** Time of day (one of SCREEN_TIMES), "" = let the app choose. */
  time: string
  /** Story creator: the map the scene needs (a place explored room by room), "" = none. */
  mapKind: string
  /** What that map shows, secrets included. */
  mapDescription: string
  next: string[]
}

/** Kinds of map a scene can ask for (the map kit's MAP_KINDS). */
export const DRAFT_MAP_KINDS = ['building', 'underground', 'outdoor'] as const

export interface DraftAct {
  id: string
  title: string
  scenes: DraftScene[]
}

export interface DraftNpc {
  id: string
  name: string
  kind: 'person' | 'creature'
  role: string
  description: string
  personality: string
  knows: string[]
  stats: Array<{ key: (typeof STAT_KEYS)[number]; value: number }>
  damageBonus: string
  attacks: Array<{ name: string; skill: number; damage: string; note: string }>
  skills: Array<{ id: string; value: number }>
  sanLoss: string
  special: string[]
}

export interface DraftHandout {
  id: string
  title: string
  text: string
  scene: string
  /** A picture in the pack (`images/…`), set by the server (the story creator's maps), never by a model. */
  image?: string
}

/** An object the investigators can find and keep (a card): every field present, "" / 0 / false = absent. */
export interface DraftItem {
  id: string
  name: string
  /** One of ITEM_KINDS. */
  kind: string
  /** One of ITEM_ARTS, "" = the kind's picture. */
  art: string
  text: string
  /** Scene id where it is found, or "". */
  scene: string
  /** A weapon: its skill (ITEM_WEAPON_SKILLS) and damage dice; "" when it isn't one. */
  weaponSkill: string
  damage: string
  addsDamageBonus: boolean
  range: string
  rate: string
  /** Uses a full item holds (rounds, doses…), 0 = none, and what they count (ITEM_UNITS). */
  uses: number
  unit: string
  /** Calibre: weapons reload from ammunition with the same one. */
  ammo: string
  /** A skill it helps with (id), and how, or "". */
  helpsSkill: string
  helpsNote: string
}

export interface DraftOverview {
  secret: string
  steps: string[]
  mustNotMiss: string[]
  branches: string[]
  ifStuck: string[]
  keeperTips: string[]
}

export interface ImportDraft {
  title: string
  summary: string
  era: string
  setting: string
  duration: string
  overview: DraftOverview
  acts: DraftAct[]
  npcs: DraftNpc[]
  handouts: DraftHandout[]
  items: DraftItem[]
}

// ------------------------------------------------------------------ JSON Schema for the model

type JsonSchema = Record<string, unknown>

const str = (description?: string): JsonSchema => (description ? { type: 'string', description } : { type: 'string' })
const int = (description?: string): JsonSchema => (description ? { type: 'integer', description } : { type: 'integer' })
const arr = (items: JsonSchema, description?: string): JsonSchema =>
  description ? { type: 'array', items, description } : { type: 'array', items }
const obj = (properties: Record<string, JsonSchema>, description?: string): JsonSchema => ({
  type: 'object',
  ...(description ? { description } : {}),
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

/** The schema sent as output_config.format. Sound ids are passed in so only real ids can be chosen. */
export function importDraftSchema(sounds: { ambience: string[]; sfx: string[] }): JsonSchema {
  const id = str('kebab-case id, unique in its list, e.g. "the-lamp". Reuse existing ids for links.')
  const text = str('Rich text: **bold**, *italic*, [[scene-id]] links, {{npc:id}} refs. "" if none.')
  const roll = obj({
    type: { enum: [...ROLL_TYPES] },
    options: arr(str(), 'Skill ids (e.g. "spot-hidden") or characteristic codes (e.g. "STR"). Alternatives.'),
    difficulty: { enum: [...DIFFICULTIES] },
    bonus: int('Bonus dice (1, 2) or penalty dice (-1, -2). 0 if none.'),
    san: str('SAN loss "success/failure" like "0/1D6" for type san, else "".'),
    dice: str('Dice like "1D8+1D4" for type damage, else "".'),
    label: str('Short button label, or "".'),
    againstNpc: str('Opposed rolls: the NPC id, else "".'),
    againstSkill: str('Opposed rolls: the NPC skill id, else "".'),
  })
  const step = obj({
    title: str('What this step is, e.g. "Search the keeper\'s room".'),
    branch: str('When the players can go several ways at this point: one step per choice right after the step that sets it up, each naming its choice here ("If she burns the letters"). Else "".'),
    text,
    roll: arr(roll, 'Zero or one roll for this step.'),
    success: text,
    failure: text,
    pushed: text,
    extra: text,
    goto: arr(id, 'Scene ids this step can lead to.'),
  })
  const scene = obj({
    id,
    title: str(),
    ref: str('Source page, e.g. "p. 12", or "".'),
    lead: text,
    readAloud: arr(text, 'Paragraphs to read to the players, REWORDED from the source.'),
    flow: arr(step, 'The scene in play order: one step per decision or roll.'),
    notes: arr(obj({ title: str(), items: arr(text) }), 'Reference blocks: room contents, timelines.'),
    npcs: arr(id, 'NPC ids present.'),
    handouts: arr(id),
    rolls: arr(roll, 'Quick rolls not tied to a step (damage, SAN).'),
    ambience: arr({ enum: sounds.ambience }, 'Up to 3 ambience sounds.'),
    sfx: arr({ enum: sounds.sfx }),
    place: { enum: ['', ...SCREEN_PLACES], description: 'Ambiance screen: the drawn décor that matches where the scene happens, or "" if none fits.' },
    preset: { enum: ['', ...SCREEN_PRESETS], description: 'Ambiance screen: the atmosphere (weather, light, mood) of the scene, or "" to let the app pick one from the sounds.' },
    time: { enum: ['', ...SCREEN_TIMES], description: 'Ambiance screen: time of day of the scene, or "" if it doesn\'t matter.' },
    mapKind: { enum: ['', ...DRAFT_MAP_KINDS], description: 'When the investigators explore this place room by room or part by part (a house, a crypt, a village), the kind of map that would help the keeper; else "". At most a few scenes of a story.' },
    mapDescription: str('If mapKind is set: what the map shows, in a few sentences (rooms or parts, what is in them, what is secret). Else "".'),
    next: arr(id, 'Likely next scenes, or [] for the following one.'),
  })
  const npc = obj({
    id,
    name: str(),
    kind: { enum: ['person', 'creature'] },
    role: str(),
    description: text,
    personality: text,
    knows: arr(text, 'What they can reveal.'),
    stats: arr(obj({ key: { enum: [...STAT_KEYS] }, value: int() }), 'Only the stats the source gives.'),
    damageBonus: str('e.g. "+1D4", or "".'),
    attacks: arr(obj({ name: str(), skill: int('Percent.'), damage: str('Dice.'), note: str() })),
    skills: arr(obj({ id: str('Skill id.'), value: int() })),
    sanLoss: str('SAN loss for seeing them, e.g. "0/1D6", or "".'),
    special: arr(text, 'Powers, immunities, weaknesses.'),
  })
  return obj({
    title: str('Story title (keep the existing one if already known).'),
    summary: text,
    era: str(),
    setting: str(),
    duration: str(),
    overview: obj({
      secret: text,
      steps: arr(text),
      mustNotMiss: arr(text),
      branches: arr(text),
      ifStuck: arr(text),
      keeperTips: arr(text),
    }),
    acts: arr(obj({ id, title: str(), scenes: arr(scene) }), 'Acts found in THESE pages only.'),
    npcs: arr(npc, 'NPCs and creatures first described in THESE pages.'),
    handouts: arr(obj({ id, title: str(), text, scene: str('Scene id where found, or "".') })),
    items: arr(obj({
      id,
      name: str('Short name printed on the card (max 60 characters, no < > & ").'),
      kind: { enum: [...ITEM_KINDS] },
      art: { enum: ['', ...ITEM_ARTS], description: 'Picture on the card, or "" for the kind\'s.' },
      text: str('One or two plain sentences printed on the card: what it does or what is said about it (max 400 characters).'),
      scene: str('Scene id where it is found, or "".'),
      weaponSkill: { enum: ['', ...ITEM_WEAPON_SKILLS], description: 'For a weapon: the skill it is used with, else "".' },
      damage: str('For a weapon: damage dice, e.g. "1D8", "2D6+4", else "".'),
      addsDamageBonus: { type: 'boolean', description: 'Melee or thrown weapon that adds the wielder\'s damage bonus.' },
      range: str('For a weapon, e.g. "15 m" or "contact", else "".'),
      rate: str('Attacks per round, e.g. "1" or "1 (3)", else "".'),
      uses: int('Uses a full item holds (rounds in a gun, doses, charges), or 0.'),
      unit: { enum: ['', ...ITEM_UNITS], description: 'What the uses count, or "".' },
      ammo: str('Calibre, e.g. ".38": a gun reloads from ammunition with the same one; else "".'),
      helpsSkill: str('Skill id the item helps with, or "".'),
      helpsNote: str('How it helps, e.g. "bonus die to climb down", or "".'),
    }), 'Objects worth keeping: a key, a weapon found or given, a talisman, a lamp the story needs. Only those that matter to the story.'),
  })
}

// ------------------------------------------------------------------ sounds

/** Sound ids the library really has (planned ones are left out). */
export const SOUND_IDS = {
  ambience: SOUNDS.ambience.filter((s) => s.status !== 'planned').map((s) => s.id),
  sfx: SOUNDS.sfx.filter((s) => s.status !== 'planned').map((s) => s.id),
}

// ------------------------------------------------------------------ untrusted drafts → ImportDraft

const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '')
const texts = (v: unknown, max: number, len = 4000) =>
  (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).map((x) => text(x, len)).filter(Boolean).slice(0, max)
const objs = (v: unknown, max: number): Json[] => (Array.isArray(v) ? v.filter(isObj).slice(0, max) : isObj(v) ? [v] : [])
const toInt = (v: unknown, lo: number, hi: number, fallback = 0) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback
}
const oneOf = <T extends string>(v: unknown, ids: readonly T[], fallback: T): T =>
  typeof v === 'string' && (ids as readonly string[]).includes(v) ? (v as T) : fallback
const id = (v: unknown) => text(v, 80)
const ids = (v: unknown, max: number) => texts(v, max, 80)

function roll(v: Json): DraftRoll {
  return {
    type: oneOf(v.type, ROLL_TYPES, 'skill'),
    options: ids(v.options, 6),
    difficulty: oneOf(v.difficulty, DIFFICULTIES, 'regular'),
    bonus: toInt(v.bonus, -2, 2),
    san: text(v.san, 20),
    dice: text(v.dice, 40),
    label: text(v.label, 80),
    againstNpc: id(v.againstNpc),
    againstSkill: id(v.againstSkill),
  }
}

function scene(v: Json, sounds: typeof SOUND_IDS): DraftScene | null {
  const sceneId = id(v.id)
  if (!sceneId) return null
  const screen = isObj(v.screen) ? v.screen : {}
  return {
    id: sceneId,
    title: text(v.title, 160) || sceneId,
    ref: text(v.ref, 40),
    lead: text(v.lead, 600),
    readAloud: texts(v.readAloud, 12),
    flow: objs(v.flow, 40).map((st) => ({
      title: text(st.title, 160),
      branch: text(st.branch, 160),
      text: text(st.text),
      roll: objs(st.roll, 1).map(roll),
      success: text(st.success),
      failure: text(st.failure),
      pushed: text(st.pushed),
      extra: text(st.extra),
      goto: ids(st.goto, 8),
    })),
    notes: objs(v.notes, 20).map((n) => ({ title: text(n.title, 160), items: texts(n.items, 40, 1000) })),
    npcs: ids(v.npcs, 20),
    handouts: ids(v.handouts, 12),
    rolls: objs(v.rolls, 12).map(roll),
    ambience: texts(v.ambience, 3, 60).filter((s) => sounds.ambience.includes(s)),
    sfx: texts(v.sfx, 12, 60).filter((s) => sounds.sfx.includes(s)),
    // The draft's place, preset and time, or story.json's screen: { place, preset, time }. Unknown values are dropped.
    place: oneOf(v.place ?? screen.place, SCREEN_PLACES, ''),
    preset: oneOf(v.preset ?? screen.preset, SCREEN_PRESETS, ''),
    time: oneOf(v.time ?? screen.time, SCREEN_TIMES, ''),
    mapKind: oneOf<string>(v.mapKind, ['', ...DRAFT_MAP_KINDS], ''),
    mapDescription: text(v.mapDescription, 800),
    next: ids(v.next, 8),
  }
}

function npc(v: Json): DraftNpc | null {
  const npcId = id(v.id)
  const name = text(v.name, 120)
  if (!npcId || !name) return null
  // Skills as [{ id, value }] (the draft shape) or as a { id: value } map (story.json's shape).
  const skills = Array.isArray(v.skills)
    ? objs(v.skills, 40).map((s) => ({ id: id(s.id), value: toInt(s.value, 0, 100) }))
    : isObj(v.skills)
      ? Object.entries(v.skills).slice(0, 40).map(([k, x]) => ({ id: id(k), value: toInt(x, 0, 100) }))
      : []
  return {
    id: npcId,
    name,
    kind: v.kind === 'creature' ? 'creature' : 'person',
    role: text(v.role, 200),
    description: text(v.description, 2000),
    personality: text(v.personality, 2000),
    knows: texts(v.knows, 20, 1000),
    stats: objs(v.stats, STAT_KEYS.length)
      .filter((s) => (STAT_KEYS as readonly string[]).includes(s.key as string))
      .map((s) => ({ key: s.key as DraftNpc['stats'][number]['key'], value: toInt(s.value, 0, 999) })),
    damageBonus: text(v.damageBonus, 20),
    attacks: objs(v.attacks, 10).map((a) => ({ name: text(a.name, 80), skill: toInt(a.skill, 0, 100), damage: text(a.damage, 40), note: text(a.note, 400) })),
    skills: skills.filter((s) => s.id),
    sanLoss: text(v.sanLoss, 20),
    special: texts(v.special, 12, 1000),
  }
}

/** A draft item, from the draft's shape or story.json's (weapon {…}, bonus {…}); null without id, name or a known kind. */
function item(v: Json): DraftItem | null {
  const itemId = id(v.id)
  // Card names are put in HTML by the game screen: the characters it would have to escape are dropped.
  const name = text(v.name, 60).replace(/[<>&"]/g, '').trim()
  const kind = oneOf(v.kind, ITEM_KINDS, '')
  if (!itemId || !name || !kind) return null
  const w = isObj(v.weapon) ? v.weapon : {}
  const bonus = isObj(v.bonus) ? v.bonus : {}
  const weaponSkill = oneOf(v.weaponSkill ?? w.skill, ITEM_WEAPON_SKILLS, '')
  // The dice expression in what was written ("1d10 dmg" → "1D10", "4D6 / 2D6 / 1D6" → "4D6/2D6/1D6").
  const dice = text(v.damage ?? w.damage, 40).toUpperCase().match(/\d*D\d+(?:\s*[+-]\s*\d*D?\d+)*(?:\s*\/\s*\d*D\d+(?:\s*[+-]\s*\d*D?\d+)*)*/)
  const damage = dice ? dice[0].replace(/\s+/g, '').slice(0, 24) : ''
  const uses = toInt(v.uses, 0, 99)
  return {
    id: itemId,
    name,
    kind,
    art: oneOf(v.art, ITEM_ARTS, ''),
    text: text(v.text, 400),
    scene: id(v.scene),
    weaponSkill: weaponSkill && /\d/.test(damage) ? weaponSkill : '',
    damage: weaponSkill && /\d/.test(damage) ? damage : '',
    addsDamageBonus: (v.addsDamageBonus ?? w.db) === true,
    range: text(v.range ?? w.range, 20).replace(/[<>&"]/g, ''),
    rate: text(v.rate ?? w.rate, 12).replace(/[<>&"]/g, ''),
    uses: uses > 0 ? uses : 0,
    unit: uses > 0 ? oneOf(v.unit, ITEM_UNITS, '') : '',
    ammo: text(v.ammo, 16).replace(/[^\p{L}\p{N} .-]/gu, ''),
    helpsSkill: id(v.helpsSkill ?? bonus.skill),
    helpsNote: text(v.helpsNote ?? bonus.note, 120).replace(/[<>&"]/g, ''),
  }
}

/** Coerce a draft sent by a chat app into a well-typed ImportDraft: wrong types become "" / [], sizes are capped. */
export function normalizeDraft(input: unknown, sounds = SOUND_IDS): ImportDraft {
  const d = isObj(input) ? input : {}
  const ov = isObj(d.overview) ? d.overview : {}
  return {
    title: text(d.title, 160),
    summary: text(d.summary, 1000),
    era: text(d.era, 120),
    setting: text(d.setting, 200),
    duration: text(d.duration, 60),
    overview: {
      secret: text(ov.secret),
      steps: texts(ov.steps, 20, 1000),
      mustNotMiss: texts(ov.mustNotMiss, 12, 1000),
      branches: texts(ov.branches, 12, 1000),
      ifStuck: texts(ov.ifStuck, 12, 1000),
      keeperTips: texts(ov.keeperTips, 12, 1000),
    },
    acts: objs(d.acts, 8).flatMap((a) => {
      const actId = id(a.id)
      if (!actId) return []
      return [{ id: actId, title: text(a.title, 160), scenes: objs(a.scenes, 20).flatMap((s) => scene(s, sounds) ?? []) }]
    }),
    npcs: objs(d.npcs, 30).flatMap((n) => npc(n) ?? []),
    handouts: objs(d.handouts, 20).flatMap((h) => (id(h.id) ? [{ id: id(h.id), title: text(h.title, 160), text: text(h.text, 8000), scene: id(h.scene) }] : [])),
    items: objs(d.items, 20).flatMap((x) => item(x) ?? []),
  }
}

/** Heading of the answer-format instructions (the e2e fake Claude recognises draft requests by it). */
export const DRAFT_FORMAT_HEADING = 'ANSWER FORMAT'

/** Tells the model to answer with one JSON object following the draft schema (sent as text, see the top). */
export function draftAnswerFormat(sounds: { ambience: string[]; sfx: string[] }): string {
  return [
    `${DRAFT_FORMAT_HEADING}: answer with ONE JSON object and nothing else (no prose, no code fence). It follows this JSON Schema; use "" or [] for what you have nothing for, and only the listed values where a field has an "enum":`,
    JSON.stringify(importDraftSchema(sounds)),
  ].join('\n')
}

/** The JSON object in a model's text answer (tolerates a code fence or a sentence around it), or null. */
export function parseJsonAnswer(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

// ------------------------------------------------------------------ merging batches

export function emptyDraft(): ImportDraft {
  return {
    title: '', summary: '', era: '', setting: '', duration: '',
    overview: { secret: '', steps: [], mustNotMiss: [], branches: [], ifStuck: [], keeperTips: [] },
    acts: [], npcs: [], handouts: [], items: [],
  }
}

const keepOrNew = (old: string, next: string) => (old.trim() ? old : next)
const union = (a: string[], b: string[]) => [...a, ...b.filter((x) => !a.includes(x))]

function mergeById<T extends { id: string }>(old: T[], next: T[], merge: (a: T, b: T) => T): T[] {
  const out = [...old]
  for (const item of next) {
    const i = out.findIndex((x) => x.id === item.id)
    if (i === -1) out.push(item)
    else out[i] = merge(out[i], item)
  }
  return out
}

/** Merge the draft from one batch of pages into the accumulated draft. Later pages extend earlier ones. */
export function mergeDraft(acc: ImportDraft, batch: ImportDraft): ImportDraft {
  return {
    title: keepOrNew(acc.title, batch.title),
    summary: keepOrNew(acc.summary, batch.summary),
    era: keepOrNew(acc.era, batch.era),
    setting: keepOrNew(acc.setting, batch.setting),
    duration: keepOrNew(acc.duration, batch.duration),
    overview: {
      secret: keepOrNew(acc.overview.secret, batch.overview.secret),
      steps: union(acc.overview.steps, batch.overview.steps),
      mustNotMiss: union(acc.overview.mustNotMiss, batch.overview.mustNotMiss),
      branches: union(acc.overview.branches, batch.overview.branches),
      ifStuck: union(acc.overview.ifStuck, batch.overview.ifStuck),
      keeperTips: union(acc.overview.keeperTips, batch.overview.keeperTips),
    },
    acts: mergeById(acc.acts, batch.acts, (a, b) => ({
      ...a,
      // a scene that continues across pages: the later batch's version is more complete
      scenes: mergeById(a.scenes, b.scenes, (_old, newer) => newer),
    })),
    npcs: mergeById(acc.npcs, batch.npcs, (a, b) => ({ ...a, ...b, stats: b.stats.length ? b.stats : a.stats })),
    handouts: mergeById(acc.handouts, batch.handouts, (_a, b) => b),
    items: mergeById(acc.items ?? [], batch.items ?? [], (_a, b) => b),
  }
}

/** Short summary of what exists so far, sent with the next batch so ids stay consistent. */
export function draftContext(d: ImportDraft): string {
  if (!d.acts.length && !d.npcs.length) return 'Nothing imported yet: these are the first pages.'
  const acts = d.acts
    .map((a) => `- act "${a.id}" (${a.title}): ${a.scenes.map((s) => `"${s.id}" (${s.title})`).join(', ')}`)
    .join('\n')
  const npcs = d.npcs.map((n) => `"${n.id}" (${n.name})`).join(', ')
  const handouts = d.handouts.map((h) => `"${h.id}"`).join(', ')
  const items = (d.items ?? []).map((x) => `"${x.id}"`).join(', ')
  return [
    `Story so far: "${d.title}".`,
    'Acts and scenes already imported (reuse these ids; to continue a scene cut by a page break, output it again with the same id and its full content):',
    acts,
    `NPCs already imported: ${npcs || 'none'}.`,
    `Handouts already imported: ${handouts || 'none'}.`,
    `Items already imported: ${items || 'none'}.`,
  ].join('\n')
}

// ------------------------------------------------------------------ draft → story.json

type Json = Record<string, unknown>

/** Drop empty strings, empty arrays and empty objects so the story only has what the source gave. */
function compact<T extends Json>(o: T): Json {
  const out: Json = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === '' || v === undefined || v === null) continue
    if (Array.isArray(v) && v.length === 0) continue
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as Json).length === 0) continue
    out[k] = v
  }
  return out
}

function toRoll(r: DraftRoll): Json {
  return compact({
    type: r.type,
    options: r.options,
    difficulty: r.difficulty === 'regular' ? '' : r.difficulty,
    bonus: r.bonus ? Math.max(-2, Math.min(2, r.bonus)) : undefined,
    san: r.type === 'san' ? r.san : '',
    dice: r.type === 'damage' ? r.dice : '',
    label: r.label,
    against: r.type === 'opposed' && r.againstNpc ? compact({ npc: r.againstNpc, skill: r.againstSkill }) : undefined,
  })
}

function toNpc(n: DraftNpc): Json {
  const stat = (k: string) => n.stats.find((s) => s.key === k)?.value
  const characteristics = compact(Object.fromEntries(CHARACTERISTICS.map((k) => [k, stat(k)])))
  return compact({
    id: n.id,
    name: n.name,
    kind: n.kind === 'person' ? '' : n.kind,
    role: n.role,
    description: n.description,
    personality: n.personality,
    knows: n.knows,
    characteristics,
    hp: stat('hp'), mp: stat('mp'), san: stat('san'), move: stat('move'), build: stat('build'),
    damageBonus: n.damageBonus,
    armor: stat('armor'), dodge: stat('dodge'), attacksPerRound: stat('attacksPerRound'),
    attacks: n.attacks.map((a) => compact({ name: a.name, skill: Math.max(0, Math.min(100, a.skill)), damage: a.damage, note: a.note })),
    skills: Object.fromEntries(n.skills.map((s) => [s.id, s.value])),
    sanLoss: n.sanLoss,
    special: n.special,
  })
}

/** A story item (spec §6) from a draft item. */
function toItem(x: DraftItem): Json {
  const firearm = x.weaponSkill.startsWith('firearms')
  return compact({
    id: x.id,
    name: x.name,
    kind: x.kind,
    art: x.art,
    text: x.text,
    weapon: x.weaponSkill
      ? compact({
        skill: x.weaponSkill,
        damage: x.damage,
        db: x.addsDamageBonus && !firearm ? true : undefined,
        range: x.range,
        rate: x.rate,
        impale: firearm ? true : undefined,
      })
      : undefined,
    uses: x.uses > 0 ? x.uses : undefined,
    unit: x.uses > 0 ? x.unit : '',
    ammo: x.ammo,
    bonus: x.helpsSkill ? compact({ skill: x.helpsSkill, note: x.helpsNote }) : undefined,
    scene: x.scene,
  })
}

/** A scene's `screen` field from its draft place, preset and time; values the format doesn't know are dropped. */
function screenOf(s: DraftScene): Json | undefined {
  const place = SCREEN_PLACES.includes(s.place) ? s.place : ''
  const preset = SCREEN_PRESETS.includes(s.preset) ? s.preset : ''
  const time = SCREEN_TIMES.includes(s.time) ? s.time : ''
  return compact({ place, preset, time })
}

export interface StoryMetaInput {
  id: string
  lang: string
  source?: string
  /** Set by the story creator (the import leaves them out). */
  players?: { min: number; max: number }
  contentWarnings?: string[]
  tags?: string[]
  /** Title when the draft has none. */
  fallbackTitle?: string
}

/** Build a story.json (format grimoire-story/1) from a draft. Imported and created stories are always private. */
export function draftToStory(d: ImportDraft, meta: StoryMetaInput): Json {
  return compact({
    format: 'grimoire-story/1',
    meta: compact({
      id: meta.id,
      title: d.title || meta.fallbackTitle || 'Imported story',
      lang: meta.lang,
      summary: d.summary,
      players: meta.players,
      era: d.era,
      setting: d.setting,
      duration: d.duration,
      system: 'd100',
      source: meta.source,
      license: 'private',
      tags: meta.tags,
      contentWarnings: meta.contentWarnings,
    }),
    overview: compact(d.overview as unknown as Json),
    acts: d.acts
      .filter((a) => a.scenes.length)
      .map((a) => ({
        id: a.id,
        title: a.title,
        scenes: a.scenes.map((s) =>
          compact({
            id: s.id,
            title: s.title,
            ref: s.ref,
            lead: s.lead,
            readAloud: s.readAloud,
            flow: s.flow.map((st) =>
              compact({
                title: st.title,
                branch: st.branch,
                text: st.text,
                roll: st.roll[0] ? toRoll(st.roll[0]) : undefined,
                success: st.success,
                failure: st.failure,
                pushed: st.pushed,
                extra: st.extra,
                goto: st.goto,
              }),
            ),
            notes: s.notes,
            npcs: s.npcs,
            handouts: s.handouts,
            rolls: s.rolls.map(toRoll),
            ambience: s.ambience.slice(0, 3),
            sfx: s.sfx,
            screen: screenOf(s),
            next: s.next,
          }),
        ),
      })),
    npcs: d.npcs.map(toNpc),
    handouts: d.handouts.map((h) => compact({ id: h.id, title: h.title, text: h.text, image: h.image, scene: h.scene })),
    items: (d.items ?? []).map(toItem),
  })
}
