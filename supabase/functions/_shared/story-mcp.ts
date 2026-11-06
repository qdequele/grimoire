// The MCP connector's logic: ChatGPT or Claude write a story (or revise one of the keeper's private
// stories) and Grimoire checks, converts and saves what they send.
//
// The chat app's model does the writing, so everything that arrives here is untrusted: drafts are
// coerced field by field (normalizeDraft), edits are applied to a copy and the result must pass the
// story schema, and texts must not use the names the creator forbids (forbiddenNamesIn).
//
// Pure TypeScript, no Deno or browser APIs: used by the mcp Edge Function and unit-tested with Vitest.
import { CRAFT_RULES, EXAMPLE_INTRO, FORBIDDEN_NAMES, ORIGINALITY_RULES, SOUND_RULES } from './create-prompt.ts'
import { DIFFICULTIES, importDraftSchema, ROLL_TYPES, STAT_KEYS, type DraftNpc, type DraftRoll, type DraftScene, type ImportDraft } from './import-draft.ts'
import { SAMPLE_STORY, SOUNDS, STORY_FORMAT_MD } from './spec-bundle.ts'
import { BRIEF_LIMITS, LENGTHS, outlineSchema, THREATS, TONES } from './story-create.ts'

type Json = Record<string, unknown>

export const MCP_LIMITS = {
  /** Scenes accepted in one write_scenes call (a model sending a whole story at once tends to cut it short). */
  scenesPerCall: 4,
  /** Request body, in bytes. */
  body: 512 * 1024,
  /** A story's story.json, in bytes. */
  story: 2 * 1024 * 1024,
  /** Operations in one edit_story call. */
  opsPerCall: 20,
} as const

/** A failure the tool reports back to the model as is: a code and what to do about it. */
export class ToolError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
  }
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
const int = (v: unknown, lo: number, hi: number, fallback = 0) => {
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
    bonus: int(v.bonus, -2, 2),
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
  return {
    id: sceneId,
    title: text(v.title, 160) || sceneId,
    ref: text(v.ref, 40),
    lead: text(v.lead, 600),
    readAloud: texts(v.readAloud, 12),
    flow: objs(v.flow, 40).map((st) => ({
      title: text(st.title, 160),
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
    next: ids(v.next, 8),
  }
}

function npc(v: Json): DraftNpc | null {
  const npcId = id(v.id)
  const name = text(v.name, 120)
  if (!npcId || !name) return null
  // Skills as [{ id, value }] (the draft shape) or as a { id: value } map (story.json's shape).
  const skills = Array.isArray(v.skills)
    ? objs(v.skills, 40).map((s) => ({ id: id(s.id), value: int(s.value, 0, 100) }))
    : isObj(v.skills)
      ? Object.entries(v.skills).slice(0, 40).map(([k, x]) => ({ id: id(k), value: int(x, 0, 100) }))
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
      .map((s) => ({ key: s.key as DraftNpc['stats'][number]['key'], value: int(s.value, 0, 999) })),
    damageBonus: text(v.damageBonus, 20),
    attacks: objs(v.attacks, 10).map((a) => ({ name: text(a.name, 80), skill: int(a.skill, 0, 100), damage: text(a.damage, 40), note: text(a.note, 400) })),
    skills: skills.filter((s) => s.id),
    sanLoss: text(v.sanLoss, 20),
    special: texts(v.special, 12, 1000),
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
  }
}

// ------------------------------------------------------------------ forbidden names

/** Strings under these keys are skill ids ("cthulhu-mythos" is a technical id the format allows in rolls). */
const SKILL_ID_KEYS = new Set(['options', 'skill', 'againstSkill'])

const NAME_PATTERNS = FORBIDDEN_NAMES.map((name) => {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Proper nouns: as written or in capitals, not inside another word ("Dagonet" is fine).
  return { name, re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${esc}|${esc.toUpperCase()})(?![\\p{L}\\p{N}])`, 'u') }
})

/** Forbidden names (published games and fiction) found anywhere in a story or draft's texts. */
export function forbiddenNamesIn(value: unknown): string[] {
  const found = new Set<string>()
  const walk = (v: unknown, key: string, parentKey: string) => {
    if (typeof v === 'string') {
      if (SKILL_ID_KEYS.has(key) || (key === 'id' && parentKey === 'skills')) return
      const s = v.replace(/[’‘]/g, "'")
      for (const p of NAME_PATTERNS) if (p.re.test(s)) found.add(p.name)
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x, key, parentKey)
    } else if (isObj(v)) {
      for (const [k, x] of Object.entries(v)) {
        // npc.skills in story.json is a { "skill-id": value } map: its keys are ids, not text.
        walk(x, k, key)
      }
    }
  }
  walk(value, '', '')
  return [...found]
}

// ------------------------------------------------------------------ reading a story

interface StoryLike {
  meta: Json
  overview?: Json
  acts: Array<{ id: string; title?: string; scenes: Array<Json & { id: string; title?: string }> }>
  npcs?: Array<Json & { id: string; name?: string }>
  handouts?: Array<Json & { id: string; title?: string }>
  [key: string]: unknown
}

const asStory = (content: unknown): StoryLike => {
  const s = (isObj(content) ? content : {}) as Partial<StoryLike>
  return { ...s, meta: isObj(s.meta) ? s.meta : {}, acts: Array.isArray(s.acts) ? s.acts : [] } as StoryLike
}

/** What a model needs to find its way in a story: meta, the secret, every act, scene, NPC and handout by id. */
export function storySummary(content: unknown) {
  const s = asStory(content)
  const m = s.meta
  return {
    meta: Object.fromEntries(
      ['id', 'title', 'lang', 'summary', 'era', 'setting', 'duration', 'players', 'contentWarnings', 'tags'].flatMap((k) =>
        m[k] === undefined ? [] : [[k, m[k]]],
      ),
    ),
    overview: s.overview ?? {},
    acts: s.acts.map((a) => ({ id: a.id, title: a.title ?? '', scenes: a.scenes.map((x) => ({ id: x.id, title: x.title ?? '' })) })),
    npcs: (s.npcs ?? []).map((n) => ({ id: n.id, name: n.name ?? '' })),
    handouts: (s.handouts ?? []).map((h) => ({ id: h.id, title: h.title ?? '' })),
  }
}

export const STORY_PARTS = ['summary', 'scenes', 'npcs', 'all'] as const
export type StoryPart = (typeof STORY_PARTS)[number]

/** One part of a story, for get_story. Scenes can be limited to some ids. */
export function storyPart(content: unknown, part: StoryPart, sceneIds: string[] = []): Json {
  const s = asStory(content)
  if (part === 'all') return s as Json
  if (part === 'npcs') return { npcs: s.npcs ?? [], handouts: s.handouts ?? [] }
  if (part === 'scenes') {
    const want = new Set(sceneIds)
    return {
      acts: s.acts
        .map((a) => ({ id: a.id, title: a.title ?? '', scenes: a.scenes.filter((x) => !want.size || want.has(x.id)) }))
        .filter((a) => a.scenes.length),
    }
  }
  return storySummary(content)
}

export const sceneCount = (content: unknown) => asStory(content).acts.reduce((n, a) => n + a.scenes.length, 0)

// ------------------------------------------------------------------ editing a story (story.json level)

export const EDIT_OPS = [
  'put_scene', 'remove_scene', 'put_act', 'remove_act', 'put_npc', 'remove_npc', 'put_handout', 'remove_handout', 'set_overview', 'set_info',
] as const
export type EditOp = { op: (typeof EDIT_OPS)[number] } & Json

/** Meta fields set_info may change. id, lang, format, license, source and tags stay as they are. */
export const INFO_FIELDS = ['title', 'summary', 'era', 'setting', 'duration', 'players', 'contentWarnings'] as const

const withoutId = <T extends { id: string }>(list: T[], gone: string) => list.filter((x) => x.id !== gone)
const scrub = (v: unknown, gone: string) => (Array.isArray(v) ? v.filter((x) => x !== gone) : v)

function insertAfter<T extends { id: string }>(list: T[], item: T, after: unknown): T[] {
  const i = typeof after === 'string' ? list.findIndex((x) => x.id === after) : -1
  if (i === -1) return [...list, item]
  return [...list.slice(0, i + 1), item, ...list.slice(i + 1)]
}

function putById<T extends { id: string }>(list: T[], item: T, after: unknown): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return insertAfter(list, item, after)
  const out = [...list]
  out[i] = item
  return out
}

const needId = (v: unknown, what: string, n: number): string => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) throw new ToolError('bad_request', `ops[${n}]: ${what} is required.`)
  return s
}
const needObj = (v: unknown, what: string, n: number): Json & { id: string } => {
  if (!isObj(v)) throw new ToolError('bad_request', `ops[${n}]: ${what} must be an object.`)
  needId(v.id, `${what}.id`, n)
  return v as Json & { id: string }
}

/**
 * Apply edit operations to a copy of story.json. All of them or none: the first bad operation throws
 * a ToolError naming it. The result still has to pass the story schema (checked by the caller).
 */
export function applyEdits(content: unknown, ops: unknown): Json {
  if (!Array.isArray(ops) || !ops.length) throw new ToolError('bad_request', 'ops must be a non-empty array.')
  if (ops.length > MCP_LIMITS.opsPerCall) throw new ToolError('bad_request', `At most ${MCP_LIMITS.opsPerCall} operations per call.`)
  const s = structuredClone(asStory(content))
  ops.forEach((raw, n) => {
    if (!isObj(raw) || !(EDIT_OPS as readonly string[]).includes(raw.op as string)) {
      throw new ToolError('bad_request', `ops[${n}].op must be one of ${EDIT_OPS.join(', ')}.`)
    }
    const op = raw as EditOp
    switch (op.op) {
      case 'put_scene': {
        const sc = needObj(op.scene, 'scene', n)
        const from = s.acts.find((a) => a.scenes.some((x) => x.id === sc.id))
        const actId = typeof op.actId === 'string' && op.actId ? op.actId : from?.id
        const act = s.acts.find((a) => a.id === actId)
        if (!act) throw new ToolError('bad_request', `ops[${n}]: act "${actId ?? ''}" does not exist (add it first with put_act).`)
        if (from && from !== act) from.scenes = withoutId(from.scenes, sc.id)
        act.scenes = putById(act.scenes, sc, op.after)
        break
      }
      case 'remove_scene': {
        const gone = needId(op.id, 'id', n)
        const act = s.acts.find((a) => a.scenes.some((x) => x.id === gone))
        if (!act) throw new ToolError('not_found', `ops[${n}]: scene "${gone}" does not exist.`)
        act.scenes = withoutId(act.scenes, gone)
        for (const sc of s.acts.flatMap((a) => a.scenes)) {
          sc.next = scrub(sc.next, gone)
          if (Array.isArray(sc.flow)) sc.flow = sc.flow.map((st) => (isObj(st) ? { ...st, goto: scrub(st.goto, gone) } : st))
        }
        for (const h of s.handouts ?? []) if (h.scene === gone) delete h.scene
        break
      }
      case 'put_act': {
        const a = needObj(op.act, 'act', n)
        const old = s.acts.find((x) => x.id === a.id)
        // An act's scenes are edited with put_scene/remove_scene: put_act only names and places it.
        const act = { ...a, title: typeof a.title === 'string' ? a.title : old?.title ?? '', scenes: old?.scenes ?? [] }
        s.acts = old ? s.acts.map((x) => (x.id === a.id ? act : x)) : insertAfter(s.acts, act, op.after)
        break
      }
      case 'remove_act': {
        const gone = needId(op.id, 'id', n)
        const act = s.acts.find((a) => a.id === gone)
        if (!act) throw new ToolError('not_found', `ops[${n}]: act "${gone}" does not exist.`)
        if (act.scenes.length) throw new ToolError('bad_request', `ops[${n}]: act "${gone}" still has scenes: move or remove them first.`)
        s.acts = withoutId(s.acts, gone)
        break
      }
      case 'put_npc': {
        const x = needObj(op.npc, 'npc', n)
        s.npcs = putById(s.npcs ?? [], x, op.after)
        break
      }
      case 'remove_npc': {
        const gone = needId(op.id, 'id', n)
        if (!(s.npcs ?? []).some((x) => x.id === gone)) throw new ToolError('not_found', `ops[${n}]: NPC "${gone}" does not exist.`)
        s.npcs = withoutId(s.npcs ?? [], gone)
        for (const sc of s.acts.flatMap((a) => a.scenes)) sc.npcs = scrub(sc.npcs, gone)
        break
      }
      case 'put_handout': {
        const x = needObj(op.handout, 'handout', n)
        s.handouts = putById(s.handouts ?? [], x, op.after)
        break
      }
      case 'remove_handout': {
        const gone = needId(op.id, 'id', n)
        if (!(s.handouts ?? []).some((x) => x.id === gone)) throw new ToolError('not_found', `ops[${n}]: handout "${gone}" does not exist.`)
        s.handouts = withoutId(s.handouts ?? [], gone)
        for (const sc of s.acts.flatMap((a) => a.scenes)) sc.handouts = scrub(sc.handouts, gone)
        break
      }
      case 'set_overview': {
        if (!isObj(op.overview)) throw new ToolError('bad_request', `ops[${n}]: overview must be an object.`)
        s.overview = op.overview
        break
      }
      case 'set_info': {
        if (!isObj(op.info)) throw new ToolError('bad_request', `ops[${n}]: info must be an object.`)
        const refused = Object.keys(op.info).filter((k) => !(INFO_FIELDS as readonly string[]).includes(k))
        if (refused.length) throw new ToolError('bad_request', `ops[${n}]: set_info can change ${INFO_FIELDS.join(', ')} only (not ${refused.join(', ')}).`)
        s.meta = { ...s.meta, ...op.info }
        break
      }
    }
  })
  // Lists left empty are dropped, as draftToStory does (the schema wants non-empty arrays there).
  if (s.npcs && !s.npcs.length) delete s.npcs
  if (s.handouts && !s.handouts.length) delete s.handouts
  return s as Json
}

// ------------------------------------------------------------------ the guide

export const GUIDE_TOPICS = ['workflow', 'rules', 'format', 'sounds', 'example'] as const
export type GuideTopic = (typeof GUIDE_TOPICS)[number]

const presets = () =>
  [
    '# Brief presets',
    '',
    `- tone: ${TONES.map((t) => `"${t.id}" (${t.prompt})`).join('; ')}`,
    `- threat: ${THREATS.map((t) => `"${t.id}" (${t.prompt})`).join('; ')}`,
    `- length: ${LENGTHS.map((l) => `"${l.id}" (${l.prompt}, ${l.scenes[0]} to ${l.scenes[1]} scenes)`).join('; ')}`,
    `- lang: "fr" or "en". Every text of the story is in that language. investigators: 1 to 8.`,
    `- Text limits: era ${BRIEF_LIMITS.era}, place ${BRIEF_LIMITS.place}, hook ${BRIEF_LIMITS.hook}, ideas ${BRIEF_LIMITS.ideas}, avoid ${BRIEF_LIMITS.avoid} characters.`,
  ].join('\n')

export const WORKFLOW = `# Creating a Grimoire story

You write the story; Grimoire checks it, saves it as a private story in the keeper's library, and the keeper runs it at the table in the Grimoire app.

1. Read the rules first (grimoire_guide topic "rules"). If you have not seen the format, read topic "format" and topic "example" too.
2. Agree on the brief with the keeper: language (fr or en), era, place, tone, threat, the central mystery, number of investigators, length, and content to avoid (lines and veils). Ask only for what they care about; choose the rest yourself and say what you chose.
3. Write the OUTLINE: title, a spoiler-free pitch, the secret, the overview, the scenes grouped in acts (each with a short summary, its clues, NPC ids and next scene ids) and every NPC with a short description. Show it to the keeper as a readable list, not JSON, and revise it until they approve it.
4. Call save_outline with the brief and the approved outline. It returns a creationId and the scene ids to write, in order. You may call save_outline again with the same creationId to replace the outline, but only before the first scene is written.
5. Call write_scenes with 2 or 3 scenes at a time (${MCP_LIMITS.scenesPerCall} at most), in the order given by "next", until "remaining" is 0. Each call carries a draft: the acts holding these scenes (same act and scene ids as the outline), the full entry of every NPC who appears in them and is not detailed yet (personality, knows, stats, skills, attacks), and their handouts. Leave out what you have nothing for. The story is saved after every call, so the keeper can already open it.
6. If a call returns validationErrors, fix those scenes by sending them again with the same ids in the next call. When "remaining" is 0, give the keeper the story's link.

# Revising one of the keeper's stories

1. list_my_stories, then get_story (part "summary" first: ids of every act, scene, NPC and handout; then the scenes or NPCs you need).
2. edit_story with the "version" get_story returned and a list of operations. Scenes, NPCs and handouts are sent whole, in the story.json format of get_story (topic "format"): put_scene replaces the scene with the same id (or adds it to actId), put_npc and put_handout the same. remove_* also removes links to what is gone. All operations apply or none do; the result must pass the format's schema.
3. On "conflict", the story changed since you read it: call get_story again and redo the edit on the new version.

Stories being written by a creation can't be edited until their last scene is written. Marketplace stories can't be edited.`

export const SERVER_INSTRUCTIONS = `Grimoire is a keeper's companion app for d100 investigation and horror tabletop games. These tools let you write ORIGINAL stories into the keeper's Grimoire library and revise their private stories.

You do the writing; Grimoire checks and saves it. Before writing or editing, call grimoire_guide with topic "workflow", then topic "rules". Agree on the outline with the keeper before writing any scene. Never use names from published games or fiction: stories that do are refused.`

/** Text of one guide topic. Built from the same sections as Grimoire's own creator prompt. */
export function guideText(topic: GuideTopic): string {
  switch (topic) {
    case 'workflow':
      return WORKFLOW
    case 'rules':
      return [ORIGINALITY_RULES, CRAFT_RULES, presets()].join('\n\n')
    case 'format':
      return [
        '# Two shapes',
        '',
        'write_scenes takes a DRAFT: the simpler shape its input schema describes (rolls as objects in a list, NPC stats as { key, value } pairs). Grimoire converts it to story.json.',
        'get_story returns and edit_story takes story.json, the format below.',
        '',
        STORY_FORMAT_MD,
      ].join('\n')
    case 'sounds':
      return SOUND_RULES
    case 'example':
      return `${EXAMPLE_INTRO}\n\n${JSON.stringify(SAMPLE_STORY, null, 1)}`
  }
}

// ------------------------------------------------------------------ tool definitions

type JsonSchema = Record<string, unknown>

/** Every field optional: the model leaves out what it has nothing for and normalizeDraft fills the gaps. */
export function relax(schema: JsonSchema, keep: string[] = []): JsonSchema {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (!isObj(v)) return v
    const out: Json = {}
    for (const [k, x] of Object.entries(v)) {
      if (k === 'required' && Array.isArray(x)) {
        const req = x.filter((r) => keep.includes(r as string))
        if (req.length) out.required = req
      } else out[k] = walk(x)
    }
    return out
  }
  return walk(schema) as JsonSchema
}

const briefSchema = (): JsonSchema => ({
  type: 'object',
  description: 'The keeper\'s answers. Empty texts are yours to decide.',
  properties: {
    lang: { enum: ['fr', 'en'], description: 'Language of every text in the story.' },
    era: { type: 'string', maxLength: BRIEF_LIMITS.era },
    place: { type: 'string', maxLength: BRIEF_LIMITS.place },
    tone: { enum: [...TONES.map((t) => t.id), ''] },
    threat: { enum: [...THREATS.map((t) => t.id), ''] },
    hook: { type: 'string', maxLength: BRIEF_LIMITS.hook, description: 'The central mystery.' },
    ideas: { type: 'string', maxLength: BRIEF_LIMITS.ideas, description: 'The keeper\'s ideas and must-haves.' },
    avoid: { type: 'string', maxLength: BRIEF_LIMITS.avoid, description: 'Content to avoid entirely (lines and veils).' },
    investigators: { type: 'integer', minimum: 1, maximum: 8 },
    length: { enum: LENGTHS.map((l) => l.id) },
  },
  required: ['lang'],
  additionalProperties: false,
})

const anyObject = (description: string): JsonSchema => ({ type: 'object', description })

export interface ToolDef {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  annotations: { readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint: false }
}

export function toolDefinitions(): ToolDef[] {
  const draft = relax(importDraftSchema(SOUND_IDS), ['id', 'name'])
  return [
    {
      name: 'grimoire_guide',
      title: 'Grimoire guide',
      description:
        'How to write a Grimoire story: "workflow" (the steps and tools, read it first), "rules" (originality and what makes a good story, plus the brief presets), "format" (story.json), "sounds" (allowed sound ids), "example" (a complete story).',
      inputSchema: { type: 'object', properties: { topic: { enum: [...GUIDE_TOPICS] } }, required: ['topic'], additionalProperties: false },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
      name: 'save_outline',
      title: 'Save a story outline',
      description:
        'Start a new story from the brief and the outline the keeper approved (no creationId), or replace the outline of a creation whose scenes are not written yet (with its creationId). Returns the creationId and the scene ids to write next.',
      inputSchema: {
        type: 'object',
        properties: {
          creationId: { type: 'string', description: 'Only to replace the outline of an existing creation.' },
          brief: briefSchema(),
          outline: relax(outlineSchema(), ['id', 'title', 'name', 'acts', 'scenes']),
        },
        required: ['brief', 'outline'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    {
      name: 'write_scenes',
      title: 'Write scenes',
      description: `Write the next scenes of a creation in full (${MCP_LIMITS.scenesPerCall} at most per call, 2 or 3 is best), with the NPCs and handouts they need. The story is saved after every call. Returns how many scenes remain, the next ids to write and any validation errors to fix.`,
      inputSchema: {
        type: 'object',
        properties: { creationId: { type: 'string' }, draft },
        required: ['creationId', 'draft'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    {
      name: 'list_my_stories',
      title: 'List my stories',
      description: 'The keeper\'s private stories: id, title, language, number of scenes, last change, and whether a creation is still writing it.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
      name: 'get_story',
      title: 'Read a story',
      description:
        'Read one of the keeper\'s stories in the story.json format. part "summary" (default): meta, overview and the ids of every act, scene, NPC and handout; "scenes" (all, or only sceneIds); "npcs" (NPCs and handouts); "all". Returns the version edit_story needs.',
      inputSchema: {
        type: 'object',
        properties: {
          storyId: { type: 'string' },
          part: { enum: [...STORY_PARTS] },
          sceneIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['storyId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
      name: 'edit_story',
      title: 'Edit a story',
      description: `Change one of the keeper's private stories (story.json format, see grimoire_guide "format"). Operations, applied in order, all or none: put_scene {scene, actId?, after?} adds or replaces a whole scene; remove_scene {id}; put_act {act: {id, title}, after?}; remove_act {id} (empty acts only); put_npc {npc, after?}; remove_npc {id}; put_handout {handout, after?}; remove_handout {id}; set_overview {overview}; set_info {info: ${INFO_FIELDS.join(', ')}}. Needs the version from get_story.`,
      inputSchema: {
        type: 'object',
        properties: {
          storyId: { type: 'string' },
          version: { type: 'string', description: 'The version get_story returned.' },
          ops: {
            type: 'array',
            minItems: 1,
            maxItems: MCP_LIMITS.opsPerCall,
            items: {
              type: 'object',
              properties: {
                op: { enum: [...EDIT_OPS] },
                id: { type: 'string', description: 'For remove_* operations.' },
                actId: { type: 'string', description: 'put_scene: the act to put the scene in (default: where it is now).' },
                after: { type: 'string', description: 'put_*: id of the item to insert after (default: at the end). Ignored when replacing.' },
                scene: anyObject('put_scene: the whole scene, story.json format.'),
                act: anyObject('put_act: { id, title }.'),
                npc: anyObject('put_npc: the whole NPC, story.json format.'),
                handout: anyObject('put_handout: the whole handout, story.json format.'),
                overview: anyObject('set_overview: the whole overview, story.json format.'),
                info: anyObject(`set_info: some of ${INFO_FIELDS.join(', ')}.`),
              },
              required: ['op'],
              additionalProperties: false,
            },
          },
        },
        required: ['storyId', 'version', 'ops'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
  ]
}
