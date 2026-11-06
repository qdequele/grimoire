// The AI import's intermediate format.
//
// Claude's structured outputs allow at most 24 optional fields and 16 union types per schema, and
// no free-form maps. story.schema.json has far more, so the model fills this simpler "draft" shape
// instead: every field required, "absent" written as "" / [] / an unlisted stat. draftToStory()
// turns it into a real story.json, which is then validated against spec/story.schema.json.
//
// Pure TypeScript, no Deno or browser APIs: used by the import-story Edge Function and unit-tested
// with Vitest.

export const ROLL_TYPES = ['skill', 'characteristic', 'luck', 'san', 'damage', 'opposed', 'group'] as const
export const DIFFICULTIES = ['regular', 'hard', 'extreme'] as const
export const STAT_KEYS = [
  'STR', 'CON', 'SIZ', 'DEX', 'APP', 'INT', 'POW', 'EDU',
  'hp', 'mp', 'san', 'move', 'build', 'armor', 'dodge', 'attacksPerRound',
] as const
const CHARACTERISTICS = ['STR', 'CON', 'SIZ', 'DEX', 'APP', 'INT', 'POW', 'EDU'] as const

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
  next: string[]
}

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

/** The sound ids the model may use (only the files that exist, not the "planned" ones). */
export interface SoundIds {
  ambience: string[]
  sfx: string[]
}

const ref = (name: string): JsonSchema => ({ $ref: `#/$defs/${name}` })

/**
 * The schema sent as output_config.format.
 *
 * Kept small on purpose: Anthropic compiles it into a grammar and refuses the request ("The compiled
 * grammar is too large") past a size it doesn't publish. So each object is defined once in $defs and
 * referenced (roll appears in steps and in scenes), and the long id lists (sounds, stat keys) are
 * plain strings listed in the description. normalizeDraft() drops any value outside those lists.
 */
export function importDraftSchema(sounds: SoundIds): JsonSchema {
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
    text,
    roll: arr(ref('roll'), 'Zero or one roll for this step.'),
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
    flow: arr(ref('step'), 'The scene in play order: one step per decision or roll.'),
    notes: arr(obj({ title: str(), items: arr(text) }), 'Reference blocks: room contents, timelines.'),
    npcs: arr(id, 'NPC ids present.'),
    handouts: arr(id),
    rolls: arr(ref('roll'), 'Quick rolls not tied to a step (damage, SAN).'),
    ambience: arr(str(), `Up to 3 ambience sound ids, only from: ${sounds.ambience.join(', ')}.`),
    sfx: arr(str(), `Sound effect ids, only from: ${sounds.sfx.join(', ')}.`),
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
    stats: arr(obj({ key: str(`One of: ${STAT_KEYS.join(', ')}.`), value: int() }), 'Only the stats the source gives.'),
    damageBonus: str('e.g. "+1D4", or "".'),
    attacks: arr(obj({ name: str(), skill: int('Percent.'), damage: str('Dice.'), note: str() })),
    skills: arr(obj({ id: str('Skill id.'), value: int() })),
    sanLoss: str('SAN loss for seeing them, e.g. "0/1D6", or "".'),
    special: arr(text, 'Powers, immunities, weaknesses.'),
  })
  return {
    ...obj({
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
      acts: arr(obj({ id, title: str(), scenes: arr(ref('scene')) }), 'Acts found in THESE pages only.'),
      npcs: arr(ref('npc'), 'NPCs and creatures first described in THESE pages.'),
      handouts: arr(obj({ id, title: str(), text, scene: str('Scene id where found, or "".') })),
    }),
    $defs: { roll, step, scene, npc },
  }
}

// ------------------------------------------------------------------ reading the model's answer

type Raw = Record<string, unknown>
const asObj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {})
const asStr = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const asInt = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.round(n) : 0
}
const asArr = <T>(v: unknown, f: (x: unknown) => T): T[] => (Array.isArray(v) ? v.map(f) : [])
const strs = (v: unknown): string[] => asArr(v, asStr).filter((x) => x !== '')
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(asStr(v)) ? (asStr(v) as T) : fallback

function toDraftRoll(v: unknown): DraftRoll {
  const r = asObj(v)
  return {
    type: oneOf(r.type, ROLL_TYPES, 'skill'),
    options: strs(r.options),
    difficulty: oneOf(r.difficulty, DIFFICULTIES, 'regular'),
    bonus: asInt(r.bonus),
    san: asStr(r.san),
    dice: asStr(r.dice),
    label: asStr(r.label),
    againstNpc: asStr(r.againstNpc),
    againstSkill: asStr(r.againstSkill),
  }
}

function toDraftScene(v: unknown, sounds: SoundIds): DraftScene {
  const s = asObj(v)
  return {
    id: asStr(s.id),
    title: asStr(s.title),
    ref: asStr(s.ref),
    lead: asStr(s.lead),
    readAloud: strs(s.readAloud),
    flow: asArr(s.flow, (x) => {
      const st = asObj(x)
      return {
        title: asStr(st.title),
        text: asStr(st.text),
        roll: asArr(st.roll, toDraftRoll).slice(0, 1),
        success: asStr(st.success),
        failure: asStr(st.failure),
        pushed: asStr(st.pushed),
        extra: asStr(st.extra),
        goto: strs(st.goto),
      }
    }),
    notes: asArr(s.notes, (x) => ({ title: asStr(asObj(x).title), items: strs(asObj(x).items) })),
    npcs: strs(s.npcs),
    handouts: strs(s.handouts),
    rolls: asArr(s.rolls, toDraftRoll),
    ambience: strs(s.ambience).filter((x) => sounds.ambience.includes(x)),
    sfx: strs(s.sfx).filter((x) => sounds.sfx.includes(x)),
    next: strs(s.next),
  }
}

function toDraftNpc(v: unknown): DraftNpc {
  const n = asObj(v)
  return {
    id: asStr(n.id),
    name: asStr(n.name),
    kind: oneOf(n.kind, ['person', 'creature'] as const, 'person'),
    role: asStr(n.role),
    description: asStr(n.description),
    personality: asStr(n.personality),
    knows: strs(n.knows),
    stats: asArr(n.stats, asObj).flatMap((x) =>
      (STAT_KEYS as readonly string[]).includes(asStr(x.key))
        ? [{ key: asStr(x.key) as (typeof STAT_KEYS)[number], value: asInt(x.value) }]
        : [],
    ),
    damageBonus: asStr(n.damageBonus),
    attacks: asArr(n.attacks, (x) => {
      const a = asObj(x)
      return { name: asStr(a.name), skill: asInt(a.skill), damage: asStr(a.damage), note: asStr(a.note) }
    }),
    skills: asArr(n.skills, asObj).flatMap((x) => (asStr(x.id) ? [{ id: asStr(x.id), value: asInt(x.value) }] : [])),
    sanLoss: asStr(n.sanLoss),
    special: strs(n.special),
  }
}

/**
 * The model's answer as a well-formed draft: missing fields get their "absent" value, values of the
 * wrong type are dropped, sound ids and stat keys outside their lists are removed. Items without an id
 * are dropped. Needed because the schema no longer lists those ids, and because the fallback without
 * structured outputs (see json-answer.ts) gives no guarantee at all.
 */
export function normalizeDraft(raw: unknown, sounds: SoundIds): ImportDraft {
  const d = asObj(raw)
  const o = asObj(d.overview)
  const hasId = <T extends { id: string }>(x: T) => x.id !== ''
  return {
    title: asStr(d.title),
    summary: asStr(d.summary),
    era: asStr(d.era),
    setting: asStr(d.setting),
    duration: asStr(d.duration),
    overview: {
      secret: asStr(o.secret),
      steps: strs(o.steps),
      mustNotMiss: strs(o.mustNotMiss),
      branches: strs(o.branches),
      ifStuck: strs(o.ifStuck),
      keeperTips: strs(o.keeperTips),
    },
    acts: asArr(d.acts, (x) => {
      const a = asObj(x)
      return { id: asStr(a.id), title: asStr(a.title), scenes: asArr(a.scenes, (s) => toDraftScene(s, sounds)).filter(hasId) }
    }).filter(hasId),
    npcs: asArr(d.npcs, toDraftNpc).filter(hasId),
    handouts: asArr(d.handouts, (x) => {
      const h = asObj(x)
      return { id: asStr(h.id), title: asStr(h.title), text: asStr(h.text), scene: asStr(h.scene) }
    }).filter(hasId),
  }
}

// ------------------------------------------------------------------ merging batches

export function emptyDraft(): ImportDraft {
  return {
    title: '', summary: '', era: '', setting: '', duration: '',
    overview: { secret: '', steps: [], mustNotMiss: [], branches: [], ifStuck: [], keeperTips: [] },
    acts: [], npcs: [], handouts: [],
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
  return [
    `Story so far: "${d.title}".`,
    'Acts and scenes already imported (reuse these ids; to continue a scene cut by a page break, output it again with the same id and its full content):',
    acts,
    `NPCs already imported: ${npcs || 'none'}.`,
    `Handouts already imported: ${handouts || 'none'}.`,
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
            next: s.next,
          }),
        ),
      })),
    npcs: d.npcs.map(toNpc),
    handouts: d.handouts.map((h) => compact({ id: h.id, title: h.title, text: h.text, scene: h.scene })),
  })
}
