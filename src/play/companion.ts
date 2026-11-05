// Pure helpers between the account's live points (game_points) and the legacy engine's state S.
import type { CharacterData } from '@/characters/character'
import { findOrAddPlayer, toLegacyCharacter } from './engineData'
import type { EngineFactories, LegacyState } from './host'

export interface Points { pv: number; san: number; chance: number; pm: number }
export interface PointsRow extends Points {
  characterId: string
  checks: string[]
  source: 'keeper' | 'phone'
  updatedAt: string
}

type Slot = { cid: string } & Partial<Points> & Record<string, unknown>
type Prog = Record<string, unknown> & { checks?: string[] }
type PointsWithChecks = Points & { checks: string[] }

const partyOf = (S: LegacyState, storyId: string): Slot[] => {
  const scen = (S.scen ?? {}) as Record<string, { party?: Slot[] } | undefined>
  return scen[storyId]?.party ?? []
}
const progOf = (S: LegacyState): Record<string, Prog> => (S.prog ?? {}) as Record<string, Prog>
const num = (v: unknown): number => (typeof v === 'number' ? v : 0)

/** Current party values and checks of the account investigators in the engine state. */
export function pointsFromState(S: LegacyState, storyId: string): Map<string, PointsWithChecks> {
  const prog = progOf(S)
  const out = new Map<string, PointsWithChecks>()
  for (const s of partyOf(S, storyId)) {
    out.set(s.cid, {
      pv: num(s.pv),
      san: num(s.san),
      chance: num(s.chance),
      pm: num(s.pm),
      checks: [...(prog[s.cid]?.checks ?? [])],
    })
  }
  return out
}

const same = (a: PointsWithChecks, b: PointsWithChecks): boolean =>
  a.pv === b.pv && a.san === b.san && a.chance === b.chance && a.pm === b.pm &&
  a.checks.length === b.checks.length && a.checks.every((c, i) => c === b.checks[i])

/** Rows to write: entries of `now` that differ from `last` (values or checks). */
export function diffPoints(
  now: ReturnType<typeof pointsFromState>,
  last: ReturnType<typeof pointsFromState>,
): Array<{ characterId: string } & PointsWithChecks> {
  const out: Array<{ characterId: string } & PointsWithChecks> = []
  for (const [characterId, v] of now) {
    const before = last.get(characterId)
    if (!before || !same(v, before)) out.push({ characterId, ...v })
  }
  return out
}

/** Phone rows newer than `since` (ms) applied to the party slots (and S.prog[cid].san). Returns a new state. */
export function applyPoints(S: LegacyState, storyId: string, rows: PointsRow[], since: number): LegacyState {
  const fresh = new Map<string, PointsRow>()
  for (const r of rows) {
    if (r.source === 'phone' && Date.parse(r.updatedAt) > since) fresh.set(r.characterId, r)
  }
  if (!fresh.size) return S
  const scen = (S.scen ?? {}) as Record<string, { party?: Slot[] } & Record<string, unknown>>
  const party = partyOf(S, storyId)
  const prog = { ...progOf(S) }
  const newParty = party.map((s) => {
    const r = fresh.get(s.cid)
    if (!r) return s
    prog[s.cid] = { ...prog[s.cid], san: r.san }
    return { ...s, pv: r.pv, san: r.san, chance: r.chance, pm: r.pm }
  })
  return { ...S, prog, scen: { ...scen, [storyId]: { ...scen[storyId], party: newParty } } }
}

/** Account investigators listed in the game but missing from the engine party, added like freshState does. */
export function addMissingMembers(
  S: LegacyState,
  f: Pick<EngineFactories, 'mkSlot'>,
  storyId: string,
  members: Array<{ id: string; data: CharacterData; player?: string }>,
): LegacyState {
  const party = partyOf(S, storyId)
  const missing = members.filter((m) => !party.some((s) => s.cid === m.id))
  if (!missing.length) return S
  const scen = (S.scen ?? {}) as Record<string, { party?: Slot[] } & Record<string, unknown>>
  const chars = [...((S.chars ?? []) as Array<{ id: string }>)]
  const players = ((S.players ?? []) as Array<{ id: string; name: string }>).map((p) => ({ ...p }))
  const prog = { ...progOf(S) }
  const newParty = [...party]
  for (const m of missing) {
    const name = m.player?.trim()
    const owner = name ? findOrAddPlayer(players, name) : null
    const legacy = toLegacyCharacter(m.id, m.data)
    if (!chars.some((c) => c.id === m.id)) chars.push(legacy)
    prog[m.id] = { skills: {}, checks: [], hist: [], ...(m.data.progress ?? {}), player: name ?? '', owner }
    newParty.push({ ...(f.mkSlot(legacy) as object), player: name ?? '' } as unknown as Slot)
  }
  return { ...S, chars, players, prog, scen: { ...scen, [storyId]: { ...scen[storyId], party: newParty } } }
}

/** Character ids of the engine party (current story) that are account investigators. */
export function partyIds(S: LegacyState, storyId: string, accountIds: Set<string>): string[] {
  return partyOf(S, storyId).map((s) => s.cid).filter((id) => accountIds.has(id))
}
