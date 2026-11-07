// The game engine's dice, as the 3D dice show them. The engine rolls itself (Math.random) and hands
// over what it rolled (extraction patches, scripts/engine-dice.mjs): a d100 roll (`LASTD`) or the
// dice of a formula like 2D6+1D4 (`LASTF`). Pure.
import { checkDice, freeDice, type TrayDie } from '@/companion/dice3d/dice'
import { DICE_SIDES } from '@/companion/rolls'

export type EngineDiceRecord =
  /** d100: every tens die (0..9), the units die, and the index of the tens die that counts. */
  | { tens: number[]; u: number; used: number }
  /** A formula's dice, [sides, value] each (constants left out). */
  | { rolls: Array<[sides: number, value: number]> }

/** Beyond this the tray gets too crowded: the engine shows the number alone. */
export const MAX_SHOWN = 12

const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max

/** The dice to throw for a record, or null when they can't be drawn (unknown die, too many, bad data). */
export function engineDice(rec: unknown): TrayDie[] | null {
  if (!rec || typeof rec !== 'object') return null
  const r = rec as Record<string, unknown>
  if (Array.isArray(r.tens)) {
    const tens = r.tens
    if (!tens.length || !tens.every((t) => isInt(t, 0, 9)) || !isInt(r.u, 0, 9) || !isInt(r.used, 0, tens.length - 1)) return null
    return checkDice(tens.length, { tens: tens as number[], units: r.u, kept: r.used })
  }
  if (Array.isArray(r.rolls)) {
    const rolls = r.rolls as unknown[]
    const ok = rolls.length > 0 && rolls.every((x) =>
      Array.isArray(x) && (DICE_SIDES as readonly number[]).includes(x[0]) && isInt(x[1], 1, x[0]))
    if (!ok) return null
    const dice = (rolls as Array<[number, number]>).flatMap(([sides, v]) => freeDice(1, sides, [v]))
    return dice.length <= MAX_SHOWN ? dice : null
  }
  return null
}
