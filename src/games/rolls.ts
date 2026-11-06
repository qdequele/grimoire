// The players' dice rolls, as the keeper's game screen sees them. A `roll` broadcast is only a hint
// (the topic is public): the rows are read from game_rolls under the keeper's own RLS.
import { asRoll, type Roll } from '@/companion/rolls'
import { supabase } from '@/lib/supabase'

const PAGE = 20

/**
 * Shows every new roll of the game once, in order. Call the returned function on each `roll` hint and
 * after each (re)subscribe: the first call only notes the newest roll (older ones aren't shown), later
 * ones show what came since, including rolls made while the channel was down. Reads run one at a time.
 */
export function rollFeed(gameId: string, show: (roll: Roll) => void): () => void {
  // created_at of the newest roll already seen; null until the first catch-up.
  let since: string | null = null
  const seen = new Set<string>()
  let queue: Promise<void> = Promise.resolve()
  const run = (fn: () => Promise<void>) => {
    queue = queue.then(fn).catch(() => undefined)
  }

  const baseline = async () => {
    const { data, error } = await supabase
      .from('game_rolls').select('created_at').eq('game_id', gameId).order('created_at', { ascending: false }).limit(1)
    if (error) return
    since = data[0]?.created_at ?? new Date(0).toISOString()
  }

  const readNew = async () => {
    if (since === null) return baseline()
    const { data, error } = await supabase
      .from('game_rolls').select('*').eq('game_id', gameId).gt('created_at', since)
      .order('created_at', { ascending: true }).limit(PAGE)
    if (error) return
    for (const row of data) {
      since = row.created_at
      if (seen.has(row.id)) continue
      seen.add(row.id)
      const roll = asRoll(row)
      if (roll) show(roll)
    }
  }

  return () => run(readNew)
}
