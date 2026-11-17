// Pure helpers for the live points (game_points) on the keeper's game screen. Phones write one
// field at a time (companion_set_point); the game screen does the same in both directions, so a
// change to one field never undoes a change the other side made to another field at the same moment.
import type { Points } from '@/play/companion'

export type PointsWithChecks = Points & { checks: string[] }
export const POINT_FIELDS = ['pv', 'san', 'chance', 'pm'] as const
export type PointField = (typeof POINT_FIELDS)[number]

const sameChecks = (a: string[], b: string[]) => a.length === b.length && a.every((c, i) => c === b[i])

/**
 * What the keeper sends to game_points for one investigator: only the fields that differ from what
 * the table is known to hold (`last`), or null when nothing does. The whole row when the table has
 * none yet (`inTable` false), or nothing is known of it.
 */
export function keeperPatch(
  now: PointsWithChecks,
  last: PointsWithChecks | undefined,
  inTable: boolean,
): (Partial<Points> & { checks?: string[] }) | null {
  const whole = { pv: now.pv, san: now.san, chance: now.chance, pm: now.pm, checks: now.checks }
  if (!last) return whole
  const patch: Partial<Points> & { checks?: string[] } = {}
  for (const f of POINT_FIELDS) if (now[f] !== last[f]) patch[f] = now[f]
  if (!sameChecks(now.checks, last.checks)) patch.checks = now.checks
  if (!Object.keys(patch).length) return null
  return inTable ? patch : whole
}

/**
 * A game_points row read from the table, field by field:
 * - a field that differs from what the table was known to hold (`last`) changed there (a phone, or
 *   another keeper tab): the engine takes it;
 * - a field that didn't change keeps the engine's value, which may be a keeper change not written yet;
 * - a field whose keeper write is on its way (`sending`) is left alone: the row read is older than
 *   that write, which will replace it.
 * Returns the engine's values after the row, whether they changed, and what the table now holds.
 */
export function mergeRow(
  row: Points,
  last: Points | undefined,
  engine: Points | undefined,
  sending: ReadonlySet<PointField>,
): { engine: Points; changed: boolean; table: Points } {
  const next = { pv: row.pv, san: row.san, chance: row.chance, pm: row.pm }
  const table = { ...next }
  if (last && engine) {
    for (const f of POINT_FIELDS) {
      if (sending.has(f)) table[f] = last[f]
      if (sending.has(f) || row[f] === last[f]) next[f] = engine[f]
    }
  }
  return { engine: next, changed: !engine || POINT_FIELDS.some((f) => engine[f] !== next[f]), table }
}
