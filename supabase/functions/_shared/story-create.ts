// The story creator: the keeper's answers (brief) → an outline Claude writes and the keeper
// reviews → scenes written a few at a time into the same ImportDraft the AI import uses, then
// draftToStory() + schema validation like any import.
//
// Pure TypeScript, no Deno or browser APIs: used by the create-story Edge Function and unit-tested
// with Vitest. Prompts live in create-prompt.ts (they need the spec bundle).
import { draftToStory, emptyDraft, type DraftOverview, type ImportDraft } from './import-draft.ts'

// ------------------------------------------------------------------ the questionnaire

/** Same ids as TONES in src/stories/create/brief.ts (a unit test keeps them in sync). */
export const TONES = [
  { id: 'classic', prompt: 'Classic investigative horror: slow-building dread, interviews, archives, clues that fit together, fragile sanity.' },
  { id: 'pulp', prompt: 'Pulp horror: bold investigators, chases and fights, exotic places, still deadly.' },
  { id: 'gothic', prompt: 'Gothic horror: an old house or estate, family secrets, decay, inheritance, the weight of the past.' },
  { id: 'cosmic', prompt: 'Cosmic horror: humanity is small, the truth is vast and indifferent, knowledge itself is the danger.' },
  { id: 'folk', prompt: 'Folk horror: an isolated rural community, old customs and rituals, the land itself is part of the threat.' },
  { id: 'noir', prompt: 'Noir horror: crime, corruption, moral compromise, rain-slicked streets, nobody is clean.' },
] as const

/** Same ids as THREATS in src/stories/create/brief.ts. */
export const THREATS = [
  { id: 'cult', prompt: 'A secret cult or society with a plan.' },
  { id: 'creature', prompt: 'A creature or entity that hunts, hides or waits.' },
  { id: 'haunting', prompt: 'A haunting: a restless dead, a cursed place.' },
  { id: 'sorcerer', prompt: 'A single sorcerer, scholar or collector meddling with forbidden knowledge.' },
  { id: 'human', prompt: 'A human evil: a murderer, a family, a town hiding something; the supernatural is only hinted at.' },
] as const

/** Same ids as LENGTHS in src/stories/create/brief.ts. */
export const LENGTHS = [
  { id: 'short', scenes: [4, 6], duration: '2 hours', prompt: 'a short evening (about 2 hours of play)' },
  { id: 'oneshot', scenes: [6, 9], duration: '3-4 hours', prompt: 'one full session (3 to 4 hours of play)' },
  { id: 'multi', scenes: [10, 14], duration: '2-3 sessions', prompt: 'two or three sessions' },
] as const

export type ToneId = (typeof TONES)[number]['id']
export type ThreatId = (typeof THREATS)[number]['id']
export type LengthId = (typeof LENGTHS)[number]['id']

/** The keeper's answers. Every text is optional: what's empty is Claude's to decide. */
export interface StoryBrief {
  lang: 'fr' | 'en'
  era: string
  place: string
  tone: ToneId | ''
  threat: ThreatId | ''
  hook: string
  ideas: string
  avoid: string
  investigators: number
  length: LengthId
}

/** Free-text fields "Inspire me" can fill. */
export const IDEA_FIELDS = ['era', 'place', 'hook', 'ideas'] as const
export type IdeaField = (typeof IDEA_FIELDS)[number]

export const BRIEF_LIMITS = { era: 120, place: 160, hook: 600, ideas: 1500, avoid: 600 } as const

const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '')
const oneOf = <T extends string>(v: unknown, ids: readonly T[], fallback: T | ''): T | '' =>
  typeof v === 'string' && (ids as readonly string[]).includes(v) ? (v as T) : fallback

/** Validate and cap untrusted answers from the browser. */
export function parseBrief(body: unknown): StoryBrief | string {
  if (!body || typeof body !== 'object') return 'brief must be an object.'
  const b = body as Record<string, unknown>
  const n = Number(b.investigators ?? 4)
  return {
    lang: b.lang === 'en' ? 'en' : 'fr',
    era: clip(b.era, BRIEF_LIMITS.era),
    place: clip(b.place, BRIEF_LIMITS.place),
    tone: oneOf(b.tone, TONES.map((x) => x.id), ''),
    threat: oneOf(b.threat, THREATS.map((x) => x.id), ''),
    hook: clip(b.hook, BRIEF_LIMITS.hook),
    ideas: clip(b.ideas, BRIEF_LIMITS.ideas),
    avoid: clip(b.avoid, BRIEF_LIMITS.avoid),
    investigators: Number.isFinite(n) ? Math.max(1, Math.min(8, Math.round(n))) : 4,
    length: (oneOf(b.length, LENGTHS.map((x) => x.id), 'oneshot') || 'oneshot') as LengthId,
  }
}

export const lengthOf = (id: LengthId) => LENGTHS.find((l) => l.id === id) ?? LENGTHS[1]

/** Players range shown on the story card, around the number the keeper plans for. */
export const playersFor = (n: number) => ({ min: Math.max(1, n - 1), max: n + 1 })

// ------------------------------------------------------------------ "Inspire me"

export function ideasSchema(): Record<string, unknown> {
  const hints: Record<IdeaField, string> = {
    era: 'A period, e.g. "1923, prohibition".',
    place: 'A precise place: a town, a building, a landscape.',
    hook: 'The central mystery in two sentences: what the investigators are asked to look into.',
    ideas: 'Two or three memorable images or set pieces, one sentence each.',
  }
  return {
    type: 'object',
    properties: Object.fromEntries(IDEA_FIELDS.map((f) => [f, { type: 'string', description: hints[f] }])),
    required: [...IDEA_FIELDS],
    additionalProperties: false,
  }
}

/** Fill only the empty fields (or the single field asked for). The keeper's text is never replaced. */
export function pickIdeas(brief: StoryBrief, output: Partial<Record<IdeaField, unknown>>, field?: IdeaField) {
  const wanted = field ? [field] : IDEA_FIELDS.filter((f) => !brief[f])
  const out: Partial<Record<IdeaField, string>> = {}
  for (const f of wanted) {
    const v = clip(output[f], BRIEF_LIMITS[f])
    if (v) out[f] = v
  }
  return out
}

// ------------------------------------------------------------------ the outline (phase 1)

export interface OutlineScene {
  id: string
  title: string
  /** What happens, for the keeper: two or three sentences. */
  summary: string
  /** Clues found here. */
  clues: string[]
  npcs: string[]
  next: string[]
}

export interface OutlineAct {
  id: string
  title: string
  scenes: OutlineScene[]
}

export interface OutlineNpc {
  id: string
  name: string
  kind: 'person' | 'creature'
  role: string
  description: string
}

export interface StoryOutline {
  title: string
  summary: string
  era: string
  setting: string
  contentWarnings: string[]
  overview: DraftOverview
  acts: OutlineAct[]
  npcs: OutlineNpc[]
}

export const OUTLINE_MAX = { acts: 6, scenes: 16, npcs: 20 } as const

type JsonSchema = Record<string, unknown>
const str = (description?: string): JsonSchema => (description ? { type: 'string', description } : { type: 'string' })
const arr = (items: JsonSchema, description?: string): JsonSchema =>
  description ? { type: 'array', items, description } : { type: 'array', items }
const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

/** Structured output for phase 1. Every field required (structured outputs limits, see import-draft.ts). */
export function outlineSchema(): JsonSchema {
  const id = str('kebab-case id, unique in its list, e.g. "the-chapel".')
  const text = str('Rich text: **bold**, *italic*, [[scene-id]] links, {{npc:id}} refs.')
  return obj({
    title: str('An original, evocative title.'),
    summary: str('The pitch read on the story card: 2 or 3 sentences, no spoilers.'),
    era: str(),
    setting: str(),
    contentWarnings: arr(str(), 'Short themes players may want to know about, e.g. "drowning".'),
    overview: obj({
      secret: str('The full truth behind the mystery, for the keeper: who, what, why, and what happens if nobody intervenes.'),
      steps: arr(text, 'The usual path through the story, one line per scene with [[scene-id]].'),
      mustNotMiss: arr(text, 'Clues the investigators must find, and where.'),
      branches: arr(text),
      ifStuck: arr(text, 'How to get stuck players moving again.'),
      keeperTips: arr(text),
    }),
    acts: arr(
      obj({
        id,
        title: str(),
        scenes: arr(
          obj({
            id,
            title: str(),
            summary: str('What happens here, for the keeper: 2 or 3 sentences.'),
            clues: arr(str(), 'Clues found in this scene.'),
            npcs: arr(id, 'Ids of NPCs present.'),
            next: arr(id, 'Scene ids this scene can lead to.'),
          }),
        ),
      }),
    ),
    npcs: arr(obj({ id, name: str(), kind: { enum: ['person', 'creature'] }, role: str(), description: text })),
  })
}

const kebab = (s: unknown) =>
  clip(s, 60)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const texts = (v: unknown, max: number, len = 400) =>
  Array.isArray(v) ? v.map((x) => clip(x, len)).filter(Boolean).slice(0, max) : []

/** Make an id unique in `taken` (adds -2, -3…) and record it. */
function uniqueId(raw: unknown, taken: Set<string>, fallback: string): string {
  const base = kebab(raw) || fallback
  let id = base
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`
  taken.add(id)
  return id
}

/**
 * Validate an outline: the model's answer, or the keeper's edited version sent back by the browser.
 * Caps sizes, makes ids unique kebab-case, drops links to scenes or NPCs that don't exist.
 */
export function parseOutline(input: unknown): StoryOutline | string {
  if (!input || typeof input !== 'object') return 'outline must be an object.'
  const o = input as Record<string, unknown>
  const ov = (o.overview && typeof o.overview === 'object' ? o.overview : {}) as Record<string, unknown>
  const npcIds = new Set<string>()
  const npcs: OutlineNpc[] = (Array.isArray(o.npcs) ? o.npcs : []).slice(0, OUTLINE_MAX.npcs).flatMap((n, i) => {
    if (!n || typeof n !== 'object') return []
    const x = n as Record<string, unknown>
    const name = clip(x.name, 80)
    if (!name) return []
    return [{
      id: uniqueId(x.id || name, npcIds, `npc-${i + 1}`),
      name,
      kind: x.kind === 'creature' ? ('creature' as const) : ('person' as const),
      role: clip(x.role, 120),
      description: clip(x.description, 600),
    }]
  })
  const actIds = new Set<string>()
  const sceneIds = new Set<string>()
  let sceneCount = 0
  const acts: OutlineAct[] = (Array.isArray(o.acts) ? o.acts : []).slice(0, OUTLINE_MAX.acts).flatMap((a, i) => {
    if (!a || typeof a !== 'object') return []
    const x = a as Record<string, unknown>
    const scenes: OutlineScene[] = (Array.isArray(x.scenes) ? x.scenes : []).flatMap((s, j) => {
      if (!s || typeof s !== 'object' || sceneCount >= OUTLINE_MAX.scenes) return []
      const y = s as Record<string, unknown>
      const title = clip(y.title, 120)
      if (!title) return []
      sceneCount++
      return [{
        id: uniqueId(y.id || title, sceneIds, `scene-${i + 1}-${j + 1}`),
        title,
        summary: clip(y.summary, 800),
        clues: texts(y.clues, 8),
        npcs: texts(y.npcs, 12, 60),
        next: texts(y.next, 6, 60),
      }]
    })
    if (!scenes.length) return []
    return [{ id: uniqueId(x.id || x.title, actIds, `act-${i + 1}`), title: clip(x.title, 120) || `Act ${i + 1}`, scenes }]
  })
  if (!acts.length) return 'The outline has no scene.'
  for (const s of acts.flatMap((a) => a.scenes)) {
    s.npcs = s.npcs.filter((id) => npcIds.has(id))
    s.next = s.next.filter((id) => sceneIds.has(id) && id !== s.id)
  }
  const secret = Array.isArray(ov.secret) ? texts(ov.secret, 3, 2000).join('\n\n') : clip(ov.secret, 2000)
  return {
    title: clip(o.title, 120) || 'Untitled',
    summary: clip(o.summary, 600),
    era: clip(o.era, 120),
    setting: clip(o.setting, 200),
    contentWarnings: texts(o.contentWarnings, 8, 60),
    overview: {
      secret,
      steps: texts(ov.steps, 20),
      mustNotMiss: texts(ov.mustNotMiss, 12),
      branches: texts(ov.branches, 12),
      ifStuck: texts(ov.ifStuck, 12),
      keeperTips: texts(ov.keeperTips, 12),
    },
    acts,
    npcs,
  }
}

export const outlineScenes = (o: StoryOutline) => o.acts.flatMap((a) => a.scenes)

// ------------------------------------------------------------------ writing the scenes (phase 2)

/** The draft before any scene is written: the outline's acts (empty) and NPCs (no stats yet). */
export function outlineToDraft(o: StoryOutline, brief: StoryBrief): ImportDraft {
  return {
    ...emptyDraft(),
    title: o.title,
    summary: o.summary,
    era: o.era,
    setting: o.setting,
    duration: lengthOf(brief.length).duration,
    overview: o.overview,
    acts: o.acts.map((a) => ({ id: a.id, title: a.title, scenes: [] })),
    npcs: o.npcs.map((n) => ({
      id: n.id, name: n.name, kind: n.kind, role: n.role, description: n.description,
      personality: '', knows: [], stats: [], damageBonus: '', attacks: [], skills: [], sanLoss: '', special: [],
    })),
  }
}

export const writtenSceneIds = (d: ImportDraft) => new Set(d.acts.flatMap((a) => a.scenes.map((s) => s.id)))

/** The next scenes to write, in outline order. */
export function nextBatch(o: StoryOutline, d: ImportDraft, size: number): string[] {
  const done = writtenSceneIds(d)
  return outlineScenes(o).map((s) => s.id).filter((id) => !done.has(id)).slice(0, size)
}

/** An NPC is "detailed" once a batch gave them more than the outline had. */
export const npcDetailed = (n: ImportDraft['npcs'][number]) =>
  n.stats.length > 0 || n.attacks.length > 0 || n.skills.length > 0 || n.knows.length > 0 || !!n.personality

/** Keep only the scenes this batch was asked for (a model rewriting other scenes would loop). */
export function onlyScenes(batch: ImportDraft, ids: string[]): ImportDraft {
  return {
    ...batch,
    acts: batch.acts.map((a) => ({ ...a, scenes: a.scenes.filter((s) => ids.includes(s.id)) })).filter((a) => a.scenes.length),
  }
}

/** Put acts and scenes back in outline order, each scene in its outline act, whatever the model did. */
export function orderLikeOutline(d: ImportDraft, o: StoryOutline): ImportDraft {
  const scenes = new Map(d.acts.flatMap((a) => a.scenes.map((s) => [s.id, s] as const)))
  const placed = new Set<string>()
  const acts = o.acts.map((a) => {
    const own = a.scenes.flatMap((s) => (scenes.has(s.id) ? [scenes.get(s.id)!] : []))
    own.forEach((s) => placed.add(s.id))
    return { id: a.id, title: a.title, scenes: own }
  })
  // Extra scenes (not in the outline) stay after the last scene of their act, or at the end.
  for (const a of d.acts) {
    for (const s of a.scenes) {
      if (placed.has(s.id)) continue
      const target = acts.find((x) => x.id === a.id) ?? acts[acts.length - 1]
      target.scenes.push(s)
      placed.add(s.id)
    }
  }
  return { ...d, acts }
}

/** Story id in meta.id: readable, unique enough per account. */
export const storyMetaId = (title: string, creationId: string) => {
  const slug = kebab(title).slice(0, 48) || 'story'
  return `${slug}-${creationId.slice(0, 6)}`
}

/** The story.json of a creation so far (the web creator and the MCP connector save the same shape). */
export const createdStory = (draft: ImportDraft, outline: StoryOutline, brief: StoryBrief, metaId: string) =>
  draftToStory(draft, {
    id: metaId,
    lang: brief.lang,
    players: playersFor(brief.investigators),
    contentWarnings: outline.contentWarnings,
    tags: ['grimoire-creator'],
  })
