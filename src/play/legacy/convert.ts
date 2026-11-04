// Legacy app data (the constants of the original single-file app) → story packs (story.json).
// Run on the private dump in private/legacy-dump: `node scripts/convert-legacy.ts`.
// The reverse lives in adapter.ts; a round-trip test checks that nothing the engine reads is lost.
// No scenario content in this file: it only knows the shapes.
import { AMB_TO_LIBRARY, SFX_TO_LIBRARY } from './sounds.ts'
import type {
  LegacyBeast, LegacyChip, LegacyDump, LegacyPregen, LegacyScenario, LegacyScene, LegacySec, LegacyStep,
} from './types.ts'

type Json = Record<string, unknown>

// ------------------------------------------------------------------ rich text

/** Legacy HTML (<b>, <i>, golinks) → story rich text. Exactly reversible by toHtml() in adapter.ts. */
export function toRichText(html: string): string {
  return html
    .replace(/<a class="golink" data-go="([^"]+)">(.*?)<\/a>/g, '[[$1|$2]]')
    .replace(/<b>(.*?)<\/b>/g, '**$1**')
    .replace(/<i>(.*?)<\/i>/g, '*$1*')
}

const rich = (s: string | undefined) => (s ? toRichText(s) : s)
const richList = (l: string[] | undefined) => l?.map(toRichText)

// ------------------------------------------------------------------ rolls

const CHAR_FR_TO_CODE: Record<string, string> = {
  FOR: 'STR', CON: 'CON', TAI: 'SIZ', DEX: 'DEX', APP: 'APP', INT: 'INT', POU: 'POW', 'ÉDU': 'EDU',
}

/** Best-effort skill id for a legacy label; the label itself is always kept for display. */
export function skillIdFor(label: string, labelToId: Record<string, string>): string {
  return (
    labelToId[label] ??
    label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  )
}

export function chipToRoll([kind, label, val]: LegacyChip, labelToId: Record<string, string>): Json {
  if (kind === 'san') return { type: 'san', san: val, label }
  if (kind === 'dmg') return { type: 'damage', dice: val, label }
  if (label === 'Chance' || label === 'Luck') return { type: 'luck', label }
  if (CHAR_FR_TO_CODE[label]) return { type: 'characteristic', options: [CHAR_FR_TO_CODE[label]], label }
  return { type: 'skill', options: [skillIdFor(label, labelToId)], label }
}

// ------------------------------------------------------------------ scenes

const notesOf = (secs: LegacySec[] | undefined) =>
  secs?.length ? secs.map((s) => ({ title: s.h, items: richList(s.ul)! })) : undefined

function stepOf(st: LegacyStep): Json {
  return compact({
    title: st.h,
    text: rich(st.txt),
    test: st.test,
    success: rich(st.ok),
    failure: rich(st.ko),
    pushed: rich(st.fail),
    extra: rich(st.extra),
  })
}

function sceneOf(sc: LegacyScene, dump: LegacyDump, labelToId: Record<string, string>): Json {
  const amb = dump.AMB_FOR[sc.id]
  const sfx = dump.SFX_FOR[sc.id]
  return compact({
    id: sc.id,
    title: sc.t,
    ref: sc.p,
    lead: rich(sc.lead),
    readAloud: richList(sc.read),
    notes: notesOf(sc.secs),
    // The legacy app shows this one scene's notes before the read-aloud text.
    notesFirst: sc.id === 'rupert' ? true : undefined,
    flow: sc.flow?.length ? sc.flow.map(stepOf) : undefined,
    notesAfter: notesOf(sc.after),
    callout: rich(sc.note),
    npcTable: sc.table ? true : undefined,
    npcs: dump.SCENE_NPC[sc.id],
    rolls: sc.chips?.length ? sc.chips.map((c) => chipToRoll(c, labelToId)) : undefined,
    ambience: amb?.map((a) => AMB_TO_LIBRARY[a] ?? a),
    sfx: sfx?.map((s) => SFX_TO_LIBRARY[s] ?? s),
  })
}

// ------------------------------------------------------------------ people

function beastToNpc(b: LegacyBeast): Json {
  return compact({
    id: b.id,
    name: b.n,
    kind: 'creature',
    hp: b.pv,
    characteristics: { DEX: b.dex },
    armor: b.arm,
    dodge: b.esq,
    sanLoss: b.san || undefined,
    attacks: b.atk.map(([name, skill, damage]) => ({ name, skill, damage })),
    special: b.note ? [b.note] : undefined,
  })
}

function pregenOf(p: LegacyPregen, dump: LegacyDump): Json {
  const w = dump.WEAPONS[p.id]
  return compact({
    id: p.id,
    name: p.n,
    occupation: p.job,
    hp: p.pv,
    mp: p.pm,
    san: p.san,
    luck: p.chance,
    characteristics: { DEX: p.dex },
    sheet: p.sk,
    dodge: w?.esq,
    attacks: w?.atk.map(([name, skill, damage]) => ({ name, skill, damage })),
  })
}

// ------------------------------------------------------------------ story

function players(s: string): { min: number; max: number } | undefined {
  const m = s.match(/(\d+)\D+(\d+)/)
  if (m) return { min: Number(m[1]), max: Number(m[2]) }
  const one = s.match(/(\d+)/)
  return one ? { min: Number(one[1]), max: Number(one[1]) } : undefined
}

export function scenarioToStory(
  sc: LegacyScenario,
  dump: LegacyDump,
  labelToId: Record<string, string>,
  /** French → English interface dictionary (private I18N.ui), for the English scenario's panel texts. */
  english: Record<string, string> = {},
): Json {
  const lang = sc.lang ?? 'fr'
  const en = lang === 'en'
  const npcX = (en ? dump.NPC_X_EN : dump.NPC_X) ?? dump.NPC_X
  const sceneIds = sc.acts!.flatMap((a) => a.scenes.map((s) => s.id))
  const npcIds = [...new Set(sceneIds.flatMap((id) => dump.SCENE_NPC[id] ?? []))]
  const people = npcIds
    .filter((id) => npcX[id])
    .map((id) => ({ id, name: npcX[id].n, description: rich(npcX[id].d) }))
  const beasts = (dump.BEASTS[sc.id] ?? []).map(beastToNpc)
  const table = dump.NPCS?.[sc.id]
  const who = en ? dump.WHO_EN : dump.WHO
  // The legacy app translated interface texts at display time and left untranslated ones in French.
  const tr = (t: string | undefined) => (t && en ? english[t] ?? t : t)
  const r = dump.RITUAL
  return compact({
    format: 'grimoire-story/1',
    meta: compact({
      id: sc.id,
      title: sc.t,
      lang,
      summary: sc.desc,
      players: players(sc.players),
      playersText: sc.players,
      duration: sc.length,
      system: 'd100',
      source: 'Imported from the legacy app (private)',
      license: 'private',
    }),
    acts: sc.acts!.map((a) => ({ id: slug(a.name), title: a.name, scenes: a.scenes.map((s) => sceneOf(s, dump, labelToId)) })),
    npcs: [...people, ...beasts],
    npcTable: table
      ? compact({ ref: table.p, note: table.note, rows: sc.id === 'livres' ? dump.LIVRES_PNJ : en ? dump.PROFILES_EN ?? dump.PROFILES : dump.PROFILES })
      : undefined,
    pregens: dump.INV0.map((p) => pregenOf(p, dump)),
    defaultParty: sc.party?.length ? sc.party : undefined,
    knowledge: sc.who && who ? who.map(([need, best, backup]) => compact({ need, best, backup })) : undefined,
    knowledgeNote: sc.who ? tr(dump.WHO_NOTE) : undefined,
    trackers:
      sc.ritual && r
        ? [
            compact({
              id: 'ritual', label: tr(r.title), max: r.max, step: r.step, unit: 'PM', timer: true, help: tr(r.help),
              addLabel: tr(r.add), subLabel: tr(r.sub), startLabel: tr(r.start), runningLabel: tr(r.running), fullMessage: tr(r.full),
            }),
          ]
        : undefined,
  })
}

/** Every playable legacy scenario (with acts) as a story pack. */
export function legacyToStories(dump: LegacyDump, labelToId: Record<string, string>, english: Record<string, string> = {}): Json[] {
  return dump.SCENARIOS.filter((s) => s.acts?.length).map((s) => scenarioToStory(s, dump, labelToId, english))
}

// ------------------------------------------------------------------ helpers

function slug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'act'
}

/** Drop undefined, empty strings, empty arrays and empty objects. */
export function compact(o: Json): Json {
  const out: Json = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as Json).length === 0) continue
    out[k] = v
  }
  return out
}
