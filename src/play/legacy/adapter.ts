// story.json → the data constants the legacy engine reads (SCENARIOS entry, BEASTS, NPC_X…).
// Works for stories converted from the legacy app (exact round trip, see adapter.test.ts) and for
// any other story pack (sample story, AI imports), filling the gaps the legacy shapes need.
import { engineAmbience, engineSfx } from './sounds.ts'
import type {
  LegacyBeast, LegacyChip, LegacyHandout, LegacyItem, LegacyPregen, LegacyRitual, LegacyScenario, LegacyScene, LegacySec, LegacyStep,
} from './types.ts'

// Loose view of story.json: the engine only needs these fields.
interface Roll { type: string; options?: string[]; san?: string; dice?: string; label?: string }
interface Step { title: string; branch?: string; text?: string; test?: string; roll?: Roll; success?: string; failure?: string; pushed?: string; extra?: string }
interface Note { title: string; items: string[] }
interface Scene {
  id: string; title: string; ref?: string; lead?: string; readAloud?: string[]; notes?: Note[]; notesFirst?: boolean
  flow?: Step[]; notesAfter?: Note[]; callout?: string; npcTable?: boolean; npcs?: string[]; rolls?: Roll[]
  ambience?: string[]; sfx?: string[]; handouts?: string[]; items?: string[]
}
interface Npc {
  id: string; name: string; kind?: string; role?: string; description?: string; personality?: string
  hp?: number; characteristics?: Record<string, number>; armor?: number; dodge?: number; sanLoss?: string
  attacks?: Array<{ name: string; skill: number; damage: string }>; special?: string[]
}
interface Pregen {
  id: string; name: string; occupation?: string; age?: number; hp?: number; mp?: number; san?: number; luck?: number
  characteristics?: Record<string, number>; sheet?: string; skills?: Record<string, number>; dodge?: number
  attacks?: Array<{ name: string; skill: number; damage: string }>
}
export interface StoryForEngine {
  meta: { id: string; title: string; lang: string; summary?: string; players?: { min?: number; max?: number }; playersText?: string; duration?: string }
  acts: Array<{ id: string; title: string; scenes: Scene[] }>
  npcs?: Npc[]
  handouts?: Array<{ id: string; title: string; text?: string; image?: string; scene?: string }>
  /** Items given as cards (src/items): the engine only lists them; the app reads the cards from the story. */
  items?: Array<{ id: string; name: string; kind: string; scene?: string }>
  npcTable?: { ref?: string; note?: string; rows: string[][] }
  pregens?: Pregen[]
  defaultParty?: string[]
  knowledge?: Array<{ need: string; best?: string; backup?: string }>
  knowledgeNote?: string
  trackers?: Array<{
    id: string; label: string; max: number; step?: number; help?: string
    addLabel?: string; subLabel?: string; startLabel?: string; runningLabel?: string; fullMessage?: string
  }>
}

/** Everything the engine needs for one story, keyed the way the legacy constants were. */
export interface EngineData {
  SCENARIO: LegacyScenario
  BEASTS: LegacyBeast[]
  NPC_X: Record<string, { n: string; d: string }>
  SCENE_NPC: Record<string, string[]>
  NPC_TABLE: { p: string; note: string; rows: string[][] } | null
  WHO: string[][]
  INV0: LegacyPregen[]
  WEAPONS: Record<string, { esq: number; atk: Array<[string, number, string]> }>
  AMB_FOR: Record<string, string[]>
  SFX_FOR: Record<string, string[]>
  /** Ritual panel (the legacy engine knows one tracker, id "ritual"). */
  RITUAL: LegacyRitual | null
  WHO_NOTE: string
  /** Opponent first names: test lines like "Dodge of <name>" don't become roll buttons. */
  NPC_WORDS: string[]
  /** The story's documents (new-app addition): title (plain text), text (engine HTML), has a picture. */
  HANDOUTS: Record<string, LegacyHandout>
  /** The story's items (new-app addition), by id. */
  ITEMS: Record<string, LegacyItem>
}

const CODE_TO_CHAR_FR: Record<string, string> = {
  STR: 'FOR', CON: 'CON', SIZ: 'TAI', DEX: 'DEX', APP: 'APP', INT: 'INT', POW: 'POU', EDU: 'ÉDU',
}

// ------------------------------------------------------------------ untrusted text
//
// A story is untrusted: it can come from a shared pack, an AI import or the chat connector, and the
// engine writes most of what it gets into the page as HTML. So nothing leaves this file as it came:
// - text the engine writes as HTML (rich text, and the few plain fields it never reads as text) is
//   made inert here: toHtml() and inertHtml();
// - plain text the engine also reads as text (titles, names, labels: Journal, narrator, toasts) stays
//   plain, and the engine escapes it where it writes it (scripts/engine-ui.mjs, and the extraction's
//   patches before it). adapter.test.ts lists those fields; engine-markup.test.ts runs the engine on them;
// - numbers are numbers (num), ids can't close an attribute (safeId).

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** An `&` that doesn't start a character reference (&nbsp; &#233; &#xE9;). */
const BARE_AMP = /&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6});)/g
/**
 * A `<` that doesn't start one of the tags kept as they are: b, i, em, strong, u and br, with nothing
 * but their name (no attribute, so nothing to run). Stories converted from the legacy app still carry them.
 */
const TAG_START = /<(?!\/?(?:b|i|em|strong|u)>|br ?\/?>)/gi

/**
 * Text as HTML that can only be text: no tag can open (but the few plain ones above), no reference
 * can be made up. For element content only, where quotes and `>` mean nothing: never for an attribute.
 */
export const inertHtml = (v: unknown): string => String(v ?? '').replace(BARE_AMP, '&amp;').replace(TAG_START, '&lt;')

/** A finite number, else the default: the engine writes these values as they are. */
const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}

/**
 * An id the engine can write in an attribute and read back unchanged (it does both, and keeps ids in
 * the saved game). Ids as the format wants them (kebab-case) are untouched; the characters that could
 * close an attribute or open a tag are spelled out. The app looks stories up by their own ids, so its
 * features keyed by id (a document's picture, the ambiance screen following a scene) don't find such
 * an id: the format refuses it anyway.
 */
export const safeId = (v: unknown): string => String(v ?? '').replace(/[&<>"'`]/g, (c) => `_${c.charCodeAt(0).toString(16)}`)

// ------------------------------------------------------------------ rich text

/** A step that is one of the choices of the step before it: its `branch`, else a title starting with "Si …" / "If …". */
export const branchOf = (st: { title: string; branch?: string }): string | undefined =>
  st.branch?.trim() || (/^(si|if)\s/i.test(st.title.trim()) ? st.title.trim() : undefined)

/**
 * Story rich text → the legacy engine's HTML. Inverse of toRichText() in convert.ts.
 * The text is made inert first (inertHtml), so the only tags are the ones added here; the titles and
 * names looked up for a link are made inert too. The markers ([[ ]] {{ }} * and line breaks) are not
 * touched by that, and the ids they carry can only be kebab-case.
 */
export function toHtml(
  text: string, sceneTitles: Record<string, string> = {}, npcNames: Record<string, string> = {}, handoutTitles: Record<string, string> = {},
): string {
  return inertHtml(text)
    .replace(/\[\[([a-z0-9-]+)\|(.*?)\]\]/g, '<a class="golink" data-go="$1">$2</a>')
    .replace(/\[\[([a-z0-9-]+)\]\]/g, (_m, id: string) => `<a class="golink" data-go="${id}">${inertHtml(sceneTitles[id] ?? id)}</a>`)
    .replace(/\{\{npc:([a-z0-9-]+)\}\}/g, (_m, id: string) => `<b>${inertHtml(npcNames[id] ?? id)}</b>`)
    .replace(/\{\{handout:([a-z0-9-]+)\}\}/g, (_m, id: string) =>
      handoutTitles[id] ? `<a class="golink hdlink" data-hd="${id}">${escapeHtml(String(handoutTitles[id]))}</a>` : `<b>${id}</b>`)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/\n/g, '<br>')
}

// ------------------------------------------------------------------ rolls

/** Display label of a roll option, as the legacy engine expects it (French skill names). */
export type SkillLabel = (id: string) => string

function optionLabel(type: string, id: string, skillLabel: SkillLabel): string {
  if (type === 'characteristic') return CODE_TO_CHAR_FR[id] ?? id
  return skillLabel(id)
}

function rollToChip(r: Roll, skillLabel: SkillLabel): LegacyChip {
  if (r.type === 'san') return ['san', r.label ?? 'Santé mentale', r.san ?? '']
  if (r.type === 'damage') return ['dmg', r.label ?? 'Dégâts', r.dice ?? '']
  if (r.type === 'luck') return ['test', r.label ?? 'Chance', '']
  return ['test', r.label ?? optionLabel(r.type, r.options?.[0] ?? '', skillLabel), '']
}

/** A structured roll → the free-text test line the legacy engine parses ("Charme ou Persuasion", "SAN 0/1D6"). */
function rollToTest(r: Roll, skillLabel: SkillLabel): string | undefined {
  if (r.type === 'san') return `SAN ${r.san}${r.label ? ` (${r.label})` : ''}`
  if (r.type === 'luck') return 'Chance'
  if (r.type === 'damage') return undefined
  return (r.options ?? []).map((o) => optionLabel(r.type, o, skillLabel)).join(' ou ') || undefined
}

// ------------------------------------------------------------------ conversion

export function storyToEngine(story: StoryForEngine, skillLabel: SkillLabel): EngineData {
  const en = story.meta.lang === 'en'
  const sceneTitles = Object.fromEntries(story.acts.flatMap((a) => a.scenes.map((s) => [s.id, s.title])))
  const npcNames = Object.fromEntries((story.npcs ?? []).map((n) => [n.id, n.name]))
  const handouts = story.handouts ?? []
  const handoutTitles = Object.fromEntries(handouts.map((h) => [h.id, h.title]))
  const items = (story.items ?? []).filter((x) => x && typeof x.id === 'string' && typeof x.name === 'string')
  const itemNames = Object.fromEntries(items.map((x) => [x.id, x.name]))
  const html = (t: string | undefined) => (t === undefined ? undefined : toHtml(t, sceneTitles, npcNames, handoutTitles))
  const secs = (n: Note[] | undefined): LegacySec[] => (n ?? []).map((x) => ({ h: x.title, ul: x.items.map((i) => html(i)!) }))
  const attacks = (a: Array<{ name: string; skill: number; damage: string }>) =>
    a.map((x) => [x.name, num(x.skill, 0), x.damage] as [string, number, string])

  const AMB_FOR: Record<string, string[]> = {}
  const SFX_FOR: Record<string, string[]> = {}
  const SCENE_NPC: Record<string, string[]> = {}

  const scene = (s: Scene): LegacyScene => {
    const amb = engineAmbience(s.ambience)
    const sfx = engineSfx(s.sfx)
    const id = safeId(s.id)
    if (amb.length) AMB_FOR[id] = amb
    if (sfx.length) SFX_FOR[id] = sfx
    if (s.npcs?.length) SCENE_NPC[id] = s.npcs.map(safeId)
    const chips = (s.rolls ?? []).map((r) => rollToChip(r, skillLabel))
    const flow = (s.flow ?? []).map((st): LegacyStep => {
      // Damage rolls inside a step have no test line in the legacy engine: offer them as chips.
      if (st.roll?.type === 'damage') chips.push(rollToChip(st.roll, skillLabel))
      const br = branchOf(st)
      return clean({
        h: st.title,
        br: br === undefined ? undefined : html(br),
        txt: html(st.text),
        test: st.test ?? (st.roll ? rollToTest(st.roll, skillLabel) : undefined),
        ok: html(st.success),
        ko: html(st.failure),
        fail: html(st.pushed),
        extra: html(st.extra),
      })
    })
    return clean({
      id,
      t: s.title,
      p: s.ref,
      lead: html(s.lead),
      secs: secs(s.notes),
      read: s.readAloud?.map((p) => html(p)!),
      flow,
      after: secs(s.notesAfter),
      note: html(s.callout) ?? '',
      chips,
      table: s.npcTable || undefined,
      secsFirst: s.notesFirst || undefined,
      lang: en ? 'en' : undefined,
      // The scene's documents: listed by the scene, or naming it as theirs.
      hd: [...new Set([...(s.handouts ?? []), ...handouts.filter((h) => h.scene === s.id).map((h) => h.id)])].filter((h) => handoutTitles[h] !== undefined).map(safeId),
      it: [...new Set([...(s.items ?? []), ...items.filter((x) => x.scene === s.id).map((x) => x.id)])].filter((x) => itemNames[x] !== undefined).map(safeId),
    })
  }

  const npcs = story.npcs ?? []
  const fighters = npcs.filter((n) => n.hp !== undefined && n.attacks?.length)
  const talkers = npcs.filter((n) => !fighters.includes(n))
  const p = story.meta.players

  return {
    SCENARIO: clean({
      id: safeId(story.meta.id),
      t: story.meta.title,
      players: inertHtml(story.meta.playersText ?? (p?.min ? (en ? `${p.min} to ${p.max ?? p.min} players` : `${p.min} à ${p.max ?? p.min} joueurs`) : '')),
      length: inertHtml(story.meta.duration),
      status: 'ready',
      statusTxt: en ? 'Ready to play' : 'Prêt à jouer',
      desc: inertHtml(story.meta.summary),
      party: (story.defaultParty ?? []).map(safeId),
      ritual: !!panelTracker(story),
      who: !!story.knowledge?.length,
      lang: en ? 'en' : undefined,
      acts: story.acts.map((a) => ({ name: inertHtml(a.title), scenes: a.scenes.map(scene) })),
    }) as LegacyScenario,
    BEASTS: fighters.map((n) =>
      clean({
        id: safeId(n.id),
        n: n.name,
        pv: num(n.hp, 1),
        dex: num(n.characteristics?.DEX, 50),
        arm: num(n.armor, 0),
        esq: num(n.dodge, Math.floor(num(n.characteristics?.DEX, 50) / 2)),
        san: inertHtml(n.sanLoss),
        atk: attacks(n.attacks!),
        note: n.special?.map((x) => html(x)).join(' ') || undefined,
      }) as LegacyBeast,
    ),
    NPC_X: Object.fromEntries(
      talkers.map((n) => [safeId(n.id), { n: n.name, d: html(n.description ?? n.personality ?? n.role ?? '')! }]),
    ),
    SCENE_NPC,
    NPC_TABLE: story.npcTable
      ? { p: inertHtml(story.npcTable.ref), note: inertHtml(story.npcTable.note), rows: story.npcTable.rows.map((r) => r.map(inertHtml)) }
      : null,
    WHO: (story.knowledge ?? []).map((k) => [k.need, k.best, k.backup].map(inertHtml)),
    INV0: (story.pregens ?? []).map((g) => ({
      id: safeId(g.id),
      n: g.name,
      job: g.occupation ?? '',
      pv: num(g.hp, 10),
      san: num(g.san, 50),
      chance: num(g.luck, 50),
      pm: num(g.mp, 10),
      dex: num(g.characteristics?.DEX, 50),
      sk: g.sheet ?? Object.entries(g.skills ?? {}).map(([id, v]) => `${skillLabel(id)} ${v}`).join(' · '),
    })),
    WEAPONS: Object.fromEntries(
      (story.pregens ?? [])
        .filter((g) => g.attacks?.length)
        .map((g) => [safeId(g.id), { esq: num(g.dodge, 0), atk: attacks(g.attacks!) }]),
    ),
    AMB_FOR,
    SFX_FOR,
    RITUAL: ritual(panelTracker(story), html),
    WHO_NOTE: html(story.knowledgeNote) ?? '',
    NPC_WORDS: fighters.map((n) => n.name.split(/[\s,(]/)[0]).filter((w) => w.length > 2),
    HANDOUTS: Object.fromEntries(handouts.map((h) => [safeId(h.id), clean({ t: h.title, txt: html(h.text), img: h.image ? true : undefined })])),
    ITEMS: Object.fromEntries(items.map((x) => [safeId(x.id), { t: x.name, k: String(x.kind) }])),
  }
}

/** The tracker shown in the engine's one tracker panel: the one with id "ritual" (legacy stories), else the story's first. */
const panelTracker = (story: StoryForEngine) => story.trackers?.find((t) => t.id === 'ritual') ?? story.trackers?.[0]

function ritual(t: StoryForEngine['trackers'] extends Array<infer T> | undefined ? T | undefined : never, html: (s?: string) => string | undefined): LegacyRitual | null {
  if (!t) return null
  const step = num(t.step, 1)
  return {
    title: t.label,
    max: num(t.max, 1),
    step,
    add: t.addLabel ?? `+${step}`,
    sub: t.subLabel ?? `−${step}`,
    start: t.startLabel ?? 'Démarrer',
    running: t.runningLabel ?? 'En cours…',
    full: t.fullMessage ?? `${t.label} : ${t.max} atteint.`,
    help: html(t.help) ?? '',
  }
}

/** Drop undefined values and empty arrays (the legacy data simply omits them). */
function clean<T extends object>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)),
  ) as T
}
