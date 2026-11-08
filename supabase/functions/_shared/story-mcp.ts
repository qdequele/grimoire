// The MCP connector's logic: ChatGPT or Claude write a story (or revise one of the keeper's private
// stories) and Grimoire checks, converts and saves what they send. Investigator sheets have their own
// module (investigator.ts); their tools are defined here with the others.
//
// The chat app's model does the writing, so everything that arrives here is untrusted: drafts are
// coerced field by field (normalizeDraft), edits are applied to a copy and the result must pass the
// story schema, and texts must not use the names the creator forbids (forbiddenNamesIn).
//
// Pure TypeScript, no Deno or browser APIs: used by the mcp Edge Function and unit-tested with Vitest.
import { CRAFT_RULES, EXAMPLE_INTRO, FORBIDDEN_NAMES, ORIGINALITY_RULES, SOUND_RULES } from './create-prompt.ts'
import { DIFFICULTIES, importDraftSchema, ROLL_TYPES, SCREEN_PLACES, SCREEN_PRESETS, SCREEN_TIMES, STAT_KEYS, type DraftNpc, type DraftRoll, type DraftScene, type ImportDraft } from './import-draft.ts'
import {
  AGE_RANGE,
  CHARACTERISTICS,
  CREATION_SKILL_IDS,
  INVESTIGATORS_GUIDE,
  OCCUPATIONS,
  PERSONAL_INTEREST_COUNT,
  OCCUPATION_SKILL_COUNT,
  PROFILE_FIELDS,
  SHEET_LIMITS,
} from './investigator.ts'
import { SAMPLE_STORY, SOUNDS, STORY_FORMAT_MD } from './spec-bundle.ts'
import { BRIEF_LIMITS, LENGTHS, outlineSchema, THREATS, TONES } from './story-create.ts'
import { SVG_ELEMENTS, SVG_LIMITS } from './svg-safe.ts'

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
  /** Pictures (files under images/) a story may hold before save_image refuses a new one. */
  imagesPerStory: 40,
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
  'put_scene', 'remove_scene', 'set_screen', 'put_act', 'remove_act', 'put_npc', 'remove_npc', 'put_handout', 'remove_handout', 'set_overview', 'set_info',
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
      case 'set_screen': {
        // Only the ambiance screen of a scene, without sending the whole scene back. {} removes place,
        // preset and time; the picture (save_image) and the fire stay unless named ("" removes them).
        const target = needId(op.id, 'id', n)
        const sc = s.acts.flatMap((a) => a.scenes).find((x) => x.id === target)
        if (!sc) throw new ToolError('not_found', `ops[${n}]: scene "${target}" does not exist.`)
        if (!isObj(op.screen)) throw new ToolError('bad_request', `ops[${n}]: screen must be an object.`)
        const given = op.screen
        const before = isObj(sc.screen) ? sc.screen : {}
        const kept = Object.entries(before).filter(([k]) => (k === 'image' || k === 'fire') && !(k in given))
        const screen = Object.fromEntries([...kept, ...Object.entries(given)].filter(([, v]) => v !== '' && v !== null && v !== undefined))
        if (Object.keys(screen).length) sc.screen = screen
        else delete sc.screen
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

// ------------------------------------------------------------------ pictures (save_image)

/** A picture's file name: lowercase words joined by hyphens, ending in .svg. Stored at images/<name>. */
export const IMAGE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.svg$/
export const IMAGE_NAME_MAX = 64
/** Path of a picture inside the story pack, as story.json and stories.pack_files write it. */
export const imagePath = (name: string) => `images/${name}`

export type ImageTarget = { scene: string } | { handout: string }
export interface ImageRequest {
  name: string
  path: string
  /** The SVG source to store (still to sanitize), or undefined to use a picture already stored. */
  svg?: string
  attach: ImageTarget | null
  remove: boolean
}

/** Check save_image's arguments (not the SVG itself: sanitizeSvg does that). */
export function parseImageRequest(args: Json): ImageRequest {
  const name = typeof args.name === 'string' ? args.name.trim().replace(/^images\//, '') : ''
  if (!name || name.length > IMAGE_NAME_MAX || !IMAGE_NAME.test(name)) {
    throw new ToolError('bad_request', `name must be lowercase letters, digits and hyphens, ending in .svg (at most ${IMAGE_NAME_MAX} characters), e.g. "harbour-night.svg".`)
  }
  const remove = args.remove === true
  const svg = args.svg === undefined || args.svg === null || args.svg === '' ? undefined : args.svg
  if (svg !== undefined && typeof svg !== 'string') throw new ToolError('bad_request', 'svg must be the SVG source, as text.')
  let attach: ImageTarget | null = null
  if (args.attach !== undefined && args.attach !== null) {
    const a = args.attach
    const scene = isObj(a) && typeof a.scene === 'string' ? a.scene.trim() : ''
    const handout = isObj(a) && typeof a.handout === 'string' ? a.handout.trim() : ''
    if (!isObj(a) || Object.keys(a).some((k) => k !== 'scene' && k !== 'handout') || !!scene === !!handout) {
      throw new ToolError('bad_request', 'attach must be { "scene": "<scene id>" } or { "handout": "<handout id>" }.')
    }
    attach = scene ? { scene } : { handout }
  }
  if (remove && (svg !== undefined || attach)) throw new ToolError('bad_request', 'remove: true takes only storyId, version and name.')
  if (!remove && svg === undefined && !attach) {
    throw new ToolError('bad_request', 'Send svg (to store or replace the picture), attach (to use a picture already stored), or remove: true.')
  }
  return { name, path: imagePath(name), ...(svg !== undefined ? { svg: svg as string } : {}), attach, remove }
}

const scenesOf = (s: StoryLike) => s.acts.flatMap((a) => a.scenes)
/** Handouts may write a picture with or without images/ (the spec says "relative path in images/"). */
const samePicture = (value: unknown, path: string) => value === path || value === path.replace(/^images\//, '')

/** Point a scene's ambiance screen, or a handout, at a picture. Throws not_found for an unknown id. */
export function attachImage(content: unknown, path: string, target: ImageTarget): Json {
  const s = structuredClone(asStory(content))
  if ('scene' in target) {
    const sc = scenesOf(s).find((x) => x.id === target.scene)
    if (!sc) throw new ToolError('not_found', `Scene "${target.scene}" does not exist. Scenes: ${scenesOf(s).map((x) => x.id).join(', ')}.`)
    sc.screen = { ...(isObj(sc.screen) ? sc.screen : {}), image: path }
  } else {
    const h = (s.handouts ?? []).find((x) => x.id === target.handout)
    if (!h) {
      const known = (s.handouts ?? []).map((x) => x.id)
      throw new ToolError('not_found', `Handout "${target.handout}" does not exist${known.length ? ` (handouts: ${known.join(', ')})` : ''}. Create it first with edit_story put_handout { id, title, text }.`)
    }
    h.image = path
  }
  return s as Json
}

/** Remove every reference to a picture: scene screens, scene images and handouts. */
export function detachImage(content: unknown, path: string): Json {
  const s = structuredClone(asStory(content))
  for (const sc of scenesOf(s)) {
    if (isObj(sc.screen) && sc.screen.image === path) {
      const rest = Object.fromEntries(Object.entries(sc.screen).filter(([k]) => k !== 'image'))
      if (Object.keys(rest).length) sc.screen = rest
      else delete sc.screen
    }
    if (Array.isArray(sc.images)) {
      const images = sc.images.filter((im) => !(isObj(im) && im.src === path))
      if (images.length) sc.images = images
      else delete sc.images
    }
  }
  for (const h of s.handouts ?? []) if (samePicture(h.image, path)) delete h.image
  return s as Json
}

/** The story's pictures and where each is used, for get_story. */
export function imageUses(content: unknown, files: readonly string[]) {
  const s = asStory(content)
  return files
    .filter((f) => f.startsWith('images/'))
    .map((path) => ({
      path,
      scenes: scenesOf(s).filter((sc) => isObj(sc.screen) && sc.screen.image === path).map((sc) => sc.id),
      handouts: (s.handouts ?? []).filter((h) => samePicture(h.image, path)).map((h) => h.id),
    }))
}

/** Whether the story points at a picture anywhere. */
export const usesImage = (content: unknown, path: string) => JSON.stringify(detachImage(content, path)) !== JSON.stringify(asStory(content))

// ------------------------------------------------------------------ the guide

export const GUIDE_TOPICS = ['workflow', 'rules', 'format', 'sounds', 'images', 'example', 'investigators'] as const
export type GuideTopic = (typeof GUIDE_TOPICS)[number]

const IMAGE_ELEMENTS = [...SVG_ELEMENTS].filter((e) => !e.startsWith('fe')).join(', ')

export const IMAGES_GUIDE = `# Pictures for a story (save_image)

You can't output raster images, but you can draw in SVG. Grimoire stores your SVG in the story's pack; at the table, the keeper shows it on the ambiance screen (a TV or tablet the players look at).

Two uses:
- A scene background: the full-screen picture behind a scene (attach { "scene": "<scene id>" }, sets the scene's screen.image).
- A handout picture: a paper the investigators find, a letter, a newspaper clipping, a map, a floor plan (attach { "handout": "<handout id>" }, sets the handout's image). The handout must exist: create it with edit_story put_handout { id, title, text } first.

When to draw: once the scenes are written, offer a few pictures; don't draw unasked, and don't draw every scene. Two or three backgrounds for the key scenes and the handouts that are documents are plenty.
Before drawing a background, check the built-in décors (topic "sounds"): if the scene takes place in a church, graveyard, crypt, castle, manor, library, police station, forest, harbour, street, asylum, railway station, swamp, desert dig, mountain, museum, cavern, farm, ship, fairground, mine or moor, set its screen.place with edit_story set_screen instead. The built-in décors are animated and go with every atmosphere and time of day; a picture replaces the décor.

## Scene backgrounds

- viewBox="0 0 1600 900" (16:9). Start with a rectangle covering the whole frame; no width or height needed.
- Dark and atmospheric: night, dusk or fog; deep blues, greens and greys, a few warm lights (a lit window, a lantern, the moon). The screen adds living layers on top (fog, rain, candlelight, grain, vignette) and slowly pans and zooms: keep the subject near the middle and nothing important within 100 units of the edges.
- Depth through layers of silhouettes: a far layer (sky, hills, a skyline) lighter and hazier, a middle layer, a near layer almost black. Gradients for skies and glows (linearGradient, radialGradient), a soft blur filter for mist and halos.
- No text, no detailed faces, no spoilers: the players see it. A scene's mood matters more than its details.
- Draw shapes with paths of whole-number coordinates; reuse repeated shapes (windows, trees, gravestones) with <symbol> and <use>.

## Handouts (papers)

- A sheet of paper: portrait viewBox="0 0 800 1100" for a letter or a diary page, "0 0 1000 700" for a telegram or a card, "0 0 700 1000" for a newspaper clipping.
- Aged paper: an off-white or ochre sheet with a radial gradient darkening towards the edges, a few stains (semi-transparent ellipses, blurred), a fold or two (thin lighter and darker lines), torn or worn edges (a jagged path), maybe a wax seal or a stamp.
- The words in <text> and <tspan>, in the story's language, with generic font families only: "cursive" for handwriting, "serif" for print, "monospace" for typewriters and telegrams, "fantasy" for odd lettering. No web fonts. Ink in dark brown or blue-black; for handwriting, tilt lines slightly (rotate) and vary their start.
- Keep the handout's text field too: it holds the same words for the keeper and when no picture is shown.

## Maps and floor plans

- Seen from above, ink on paper. Rooms as rectangles with thick walls, doors as gaps with a quarter-circle swing, windows as double lines, stairs as hatching; a label in each room, a compass rose, a scale bar and a small legend box.
- Draw only what the investigators would know: no secret passage on a map they're given until they've found it (draw a second map if needed).
- Outdoor maps: roads, a river, woods as clusters of small circles, buildings as small blocks, labelled places.

## What an SVG may hold

Anything else is refused with the reason, and nothing is saved.
- One root <svg> with a viewBox, at most ${SVG_LIMITS.bytes / 1024} KB and ${SVG_LIMITS.elements} elements.
- Elements: ${IMAGE_ELEMENTS}, and the filter primitives (feGaussianBlur, feTurbulence, feDisplacementMap, feColorMatrix, feComposite, feMerge, feOffset, feFlood…) except feImage.
- Not allowed: scripts, event attributes (onload…), foreignObject, <image> and feImage, links (<a>), animation (animate, set…), DOCTYPE and entities, editor namespaces (inkscape, sodipodi), external URLs. href only as "#id" (use, textPath, gradients, patterns), url() only as url(#id). In <style> and style="": plain CSS, no @import, no @font-face, no backslashes.

## Calling save_image

- storyId and version: from get_story, or from the previous save_image or edit_story answer (each returns the new version).
- name: lowercase letters, digits and hyphens, ending in .svg ("harbour-night.svg", "letter-from-the-doctor.svg"). The file is stored at images/<name>; sending the same name again replaces the picture.
- svg: the SVG source. With attach, it is also set as that scene's background or that handout's picture; without attach, it is only stored.
- attach without svg: use a picture already stored (one map for two handouts, say).
- remove: true deletes the picture and every reference to it. To take a background off a scene but keep the file, use edit_story set_screen with image "".
- Each call counts as an edit (daily limit), and pictures have a daily limit of their own.`

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
7. Then offer pictures: a background for the ambiance screen in two or three key scenes (when no built-in décor fits them) and a picture for the handouts that are papers, letters or maps. Draw only the ones the keeper wants, in SVG, with save_image (grimoire_guide topic "images").

# Revising one of the keeper's stories

1. list_my_stories, then get_story (part "summary" first: ids of every act, scene, NPC and handout; then the scenes or NPCs you need).
2. edit_story with the "version" get_story returned and a list of operations. Scenes, NPCs and handouts are sent whole, in the story.json format of get_story (topic "format"): put_scene replaces the scene with the same id (or adds it to actId), put_npc and put_handout the same. remove_* also removes links to what is gone. set_screen changes only a scene's ambiance screen (décor, atmosphere and time of day, topic "sounds"). All operations apply or none do; the result must pass the format's schema.
3. On "conflict", the story changed since you read it: call get_story again and redo the edit on the new version.
4. Pictures: save_image stores an SVG you draw as a scene's background or a handout's picture, replaces it, or removes it (topic "images"). get_story lists the story's pictures and where they are used. save_image and edit_story both return the new version: use it for the next call.

Stories being written by a creation can't be edited until their last scene is written. Marketplace stories can't be edited.

# Investigators

You can also help make an investigator (a player character) for the keeper's table: read grimoire_guide topic "investigators", check the choices with check_investigator, show the keeper the finished sheet, then save_investigator. list_my_investigators and get_investigator read the keeper's investigators; save_investigator with characterId changes one.`

export const SERVER_INSTRUCTIONS = `Grimoire is a keeper's companion app for d100 investigation and horror tabletop games. These tools let you write ORIGINAL stories into the keeper's Grimoire library and revise their private stories.

You do the writing; Grimoire checks and saves it. Before writing or editing, call grimoire_guide with topic "workflow", then topic "rules". Agree on the outline with the keeper before writing any scene. Never use names from published games or fiction: stories that do are refused. You can also draw pictures for a story in SVG (save_image, guide topic "images"), and make investigators (player characters) by the creation rules (guide topic "investigators", check_investigator, then save_investigator).`

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
    case 'images':
      return IMAGES_GUIDE
    case 'example':
      return `${EXAMPLE_INTRO}\n\n${JSON.stringify(SAMPLE_STORY, null, 1)}`
    case 'investigators':
      return INVESTIGATORS_GUIDE()
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

const skillChoice = (withValue: boolean): JsonSchema => ({
  type: 'object',
  properties: {
    id: { enum: CREATION_SKILL_IDS },
    ...(withValue ? { value: { type: 'integer', description: 'One of the occupation values (see the guide).' } } : {}),
    specialty: { type: 'string', maxLength: SHEET_LIMITS.specialty, description: 'Only for skills that need one (art-craft, language-other, pilot, science, science-2, survival).' },
  },
  required: withValue ? ['id', 'value'] : ['id'],
  additionalProperties: false,
})

/** The creation choices (InvestigatorInput): Grimoire computes everything else. */
export const investigatorSchema = (): JsonSchema => ({
  type: 'object',
  description: 'The creation choices only (grimoire_guide topic "investigators"). Hit points, sanity, magic points, damage bonus and final skill values are computed by Grimoire.',
  properties: {
    name: { type: 'string', maxLength: SHEET_LIMITS.name },
    player: { type: 'string', maxLength: SHEET_LIMITS.playerName, description: 'The player\'s first name ("" for nobody). Left out when changing an investigator: the player stays.' },
    occupation: { enum: OCCUPATIONS.map((o) => o.id) },
    age: { type: 'integer', minimum: AGE_RANGE[0], maximum: AGE_RANGE[1] },
    link: { type: 'string', maxLength: SHEET_LIMITS.link, description: 'Their link with the story or the other investigators.' },
    rolled: { type: 'boolean', description: 'true only if the characteristics were rolled with dice (with the keeper\'s agreement). Default: the fixed values 40, 50, 50, 50, 60, 60, 70, 80.' },
    characteristics: {
      type: 'object',
      properties: Object.fromEntries(CHARACTERISTICS.map((k) => [k, { type: 'integer', minimum: 15, maximum: 90 }])),
      required: [...CHARACTERISTICS],
      additionalProperties: false,
    },
    luck: { type: 'integer', minimum: 15, maximum: 90, description: '3D6 × 5.' },
    occupationSkills: { type: 'array', minItems: OCCUPATION_SKILL_COUNT, maxItems: OCCUPATION_SKILL_COUNT, items: skillChoice(true) },
    creditRating: { type: 'integer', description: 'One of the occupation values.' },
    personalInterests: { type: 'array', minItems: PERSONAL_INTEREST_COUNT, maxItems: PERSONAL_INTEREST_COUNT, items: skillChoice(false) },
    profile: {
      type: 'object',
      properties: Object.fromEntries(PROFILE_FIELDS.map((k) => [k, { type: 'string', maxLength: SHEET_LIMITS.profile }])),
      additionalProperties: false,
    },
  },
  required: ['name', 'occupation', 'age', 'characteristics', 'luck', 'occupationSkills', 'creditRating', 'personalInterests'],
  additionalProperties: false,
})

export interface ToolDef {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; openWorldHint: false }
}

export function toolDefinitions(): ToolDef[] {
  const draft = relax(importDraftSchema(SOUND_IDS), ['id', 'name'])
  return [
    {
      name: 'grimoire_guide',
      title: 'Grimoire guide',
      description:
        'How to write a Grimoire story: "workflow" (the steps and tools, read it first), "rules" (originality and what makes a good story, plus the brief presets), "format" (story.json), "sounds" (allowed sound ids, and the ambiance screen\'s décors and atmospheres), "images" (drawing SVG pictures for scene backgrounds and handouts with save_image), "example" (a complete story). And how to make an investigator (player character): "investigators" (creation rules, occupations, skills, an example).',
      inputSchema: { type: 'object', properties: { topic: { enum: [...GUIDE_TOPICS] } }, required: ['topic'], additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
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
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
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
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    {
      name: 'edit_story',
      title: 'Edit a story',
      description: `Change one of the keeper's private stories (story.json format, see grimoire_guide "format"). Operations, applied in order, all or none: put_scene {scene, actId?, after?} adds or replaces a whole scene; remove_scene {id}; set_screen {id, screen: {place?, preset?, time?, image?}} sets a scene's ambiance screen ({} removes place, preset and time; a picture stays unless image is ""); put_act {act: {id, title}, after?}; remove_act {id} (empty acts only); put_npc {npc, after?}; remove_npc {id}; put_handout {handout, after?}; remove_handout {id}; set_overview {overview}; set_info {info: ${INFO_FIELDS.join(', ')}}. Needs the version from get_story.`,
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
                id: { type: 'string', description: 'For remove_* operations, and the scene id for set_screen.' },
                screen: {
                  type: 'object',
                  description: 'set_screen: the scene\'s ambiance screen (see grimoire_guide "sounds"). {} removes place, preset and time; the picture stays unless image is "" (save_image sets pictures).',
                  properties: {
                    place: { enum: [...SCREEN_PLACES] },
                    preset: { enum: [...SCREEN_PRESETS] },
                    time: { enum: [...SCREEN_TIMES] },
                    image: { type: 'string', description: 'A picture already stored ("images/<name>.svg"), or "" to take it off the scene.' },
                  },
                },
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
    {
      name: 'save_image',
      title: 'Save a picture',
      description:
        'Store an SVG picture you drew in one of the keeper\'s private stories, as a scene\'s ambiance-screen background (attach {scene}) or a handout\'s picture (attach {handout}), or just store it. The same name replaces the picture; attach without svg uses a stored picture; remove: true deletes it and every reference to it. The SVG is checked strictly (no scripts, external links or raster images; see grimoire_guide "images"). Needs the version from get_story and returns the new one.',
      inputSchema: {
        type: 'object',
        properties: {
          storyId: { type: 'string' },
          version: { type: 'string', description: 'The version get_story (or the previous save_image or edit_story) returned.' },
          name: { type: 'string', pattern: IMAGE_NAME.source, maxLength: IMAGE_NAME_MAX, description: 'File name, e.g. "harbour-night.svg". Stored at images/<name>.' },
          svg: { type: 'string', maxLength: SVG_LIMITS.bytes, description: 'The SVG source: one root <svg> with a viewBox (0 0 1600 900 for a scene background).' },
          attach: {
            type: 'object',
            description: 'Where to show it: { "scene": "<scene id>" } or { "handout": "<handout id>" }. Leave out to only store it.',
            properties: { scene: { type: 'string' }, handout: { type: 'string' } },
            additionalProperties: false,
          },
          remove: { type: 'boolean', description: 'true deletes the picture and every reference to it (with storyId, version and name only).' },
        },
        required: ['storyId', 'version', 'name'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    {
      name: 'check_investigator',
      title: 'Check an investigator',
      description:
        'Check an investigator\'s creation choices against the rules without saving anything (grimoire_guide "investigators"). Returns ok: false with every problem to fix, or ok: true with the finished sheet: characteristics, hit points, sanity, magic points, luck, damage bonus, build, and every skill\'s final value. Show that sheet to the keeper before save_investigator.',
      inputSchema: { type: 'object', properties: { investigator: investigatorSchema() }, required: ['investigator'], additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    {
      name: 'save_investigator',
      title: 'Save an investigator',
      description:
        'Save an investigator in the keeper\'s Grimoire account from creation choices the keeper approved (the same choices check_investigator accepts; anything breaking the rules is refused with the reasons, nothing saved). Without characterId it creates a new investigator; with characterId and version (from get_investigator) it rebuilds that investigator\'s sheet from the choices, keeping what they gained in play. The player is found by first name or added. Returns the link and the saved sheet.',
      inputSchema: {
        type: 'object',
        properties: {
          characterId: { type: 'string', description: 'Only to change an existing investigator.' },
          version: { type: 'string', description: 'With characterId: the version get_investigator returned.' },
          investigator: investigatorSchema(),
        },
        required: ['investigator'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    {
      name: 'list_my_investigators',
      title: 'List my investigators',
      description: 'The keeper\'s investigators: id, name, occupation, age, player and last change.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    {
      name: 'get_investigator',
      title: 'Read an investigator',
      description:
        'Read one of the keeper\'s investigators: the sheet with every computed value, the creation choices behind it (to change some and send them to save_investigator), whether they gained anything in play, and the version save_investigator needs.',
      inputSchema: { type: 'object', properties: { characterId: { type: 'string' } }, required: ['characterId'], additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
  ]
}
