// The players' dice rolls, as the keeper's game screen sees them. A `roll` broadcast is only a hint
// (the topic is public): the rows are read from game_rolls under the keeper's own RLS.
import { asRoll, type Roll } from '@/companion/rolls'
import type { Json } from '@/lib/database.types'
import { supabase, type TablesInsert } from '@/lib/supabase'

const PAGE = 20
/** A game keeps its 100 newest rolls (companion_roll_prune). */
const KEPT = 100
/**
 * How far back each read looks again. `created_at` is the time of the insert, not of the commit: a
 * roll stamped before the newest one seen can become readable after it (two players tapping together).
 */
const OVERLAP_MS = 5000

/**
 * Shows every new roll of the game once. Call the returned function on each `roll` hint and after
 * each (re)subscribe: the first call only notes the rolls already there (they aren't shown), later
 * ones show what came since, oldest first, including rolls made while the channel was down. A roll
 * that commits late is shown when it appears, after later-stamped ones. Reads run one at a time.
 */
export function rollFeed(gameId: string, show: (roll: Roll) => void): () => void {
  // created_at of the newest roll already seen; null until the first catch-up.
  let since: string | null = null
  // Ids already shown or there at the start: reads overlap, each roll shows once.
  const seen = new Set<string>()
  let queue: Promise<void> = Promise.resolve()
  const run = (fn: () => Promise<void>) => {
    queue = queue.then(fn).catch(() => undefined)
  }
  const note = (row: { id: string; created_at: string }) => {
    seen.add(row.id)
    if (since === null || row.created_at > since) since = row.created_at
  }
  /** Rows older than the overlap can't come back: forget the oldest ids beyond what a game keeps. */
  const trim = () => {
    for (const id of seen) {
      if (seen.size <= 2 * KEPT) break
      seen.delete(id)
    }
  }

  const baseline = async () => {
    const { data, error } = await supabase
      .from('game_rolls').select('id, created_at').eq('game_id', gameId).order('created_at', { ascending: false }).limit(KEPT)
    if (error) return
    since = new Date(0).toISOString()
    data.forEach(note)
  }

  const readNew = async () => {
    if (since === null) return baseline()
    let from = new Date(Math.max(0, Date.parse(since) - OVERLAP_MS)).toISOString()
    for (;;) {
      const { data, error } = await supabase
        .from('game_rolls').select('*').eq('game_id', gameId).gte('created_at', from)
        .order('created_at', { ascending: true }).limit(PAGE)
      if (error) return
      for (const row of data) {
        if (seen.has(row.id)) continue
        note(row)
        // The keeper's own rolls for investigators are in the table too (for the players): not shown back.
        const roll = row.source === 'keeper' ? null : asRoll(row)
        if (roll) show(roll)
      }
      // A full page: there may be more. The next one starts at this one's last row (seen, so skipped).
      const last = data.at(-1)?.created_at
      if (data.length < PAGE || !last || last === from) break
      from = last
    }
    trim()
  }

  return () => run(readNew)
}

const LEVELS = ['extreme', 'hard', 'regular', 'failure']
const whole = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null)

/**
 * A roll the keeper's engine made for an investigator (GRIMOIRE_HOST.rolled), as the game_rolls row
 * the table's players read; null when it isn't one the table shows. The database checks it again.
 */
export function keeperRoll(gameId: string, ownerId: string, characterId: string, raw: Record<string, unknown>): TablesInsert<'game_rolls'> | null {
  const result = whole(raw.result)
  const subject = typeof raw.subject === 'string' ? raw.subject.slice(0, 90) : ''
  const dice = raw.dice && typeof raw.dice === 'object' ? (raw.dice as Json) : null
  if (result === null || !subject || !dice) return null
  const effect = raw.effect && typeof raw.effect === 'object' ? (raw.effect as Json) : null
  const base = { game_id: gameId, owner_id: ownerId, character_id: characterId, source: 'keeper', subject, dice, result, effect }
  if (raw.kind === 'damage') return { ...base, kind: 'damage' }
  const target = whole(raw.target), net = whole(raw.net)
  if (raw.kind !== 'check' || target === null || typeof raw.level !== 'string' || !LEVELS.includes(raw.level)) return null
  return { ...base, kind: 'check', target: Math.max(0, Math.min(200, target)), net: Math.max(-2, Math.min(2, net ?? 0)), level: raw.level }
}
