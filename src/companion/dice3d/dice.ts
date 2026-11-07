// Which physical dice a roll shows: a d100 is a tens die (00…90) and a units die (0…9), bonus and
// penalty dice add tens dice, a D3 is a d6 numbered 1–3 twice. Pure.
import type { DieShape } from './geometry'

export interface TrayDie {
  shape: DieShape
  /** Every face's label, in order (opposite faces pair the first with the last…). */
  labels: string[]
  /** The label it lands on; null while the server hasn't answered (the die shakes). */
  value: string | null
  /** Set aside once the dice rest: a bonus or penalty tens die that wasn't kept. */
  dim?: boolean
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i))
const TENS = Array.from({ length: 10 }, (_, i) => `${i}0`.padStart(2, '0'))
const UNITS = range(0, 9)
const tensLabel = (d: number) => TENS[d]

const tensDie = (value: string | null, dim?: boolean): TrayDie => ({ shape: 'd10', labels: TENS, value, ...(dim && { dim }) })
const unitsDie = (value: string | null): TrayDie => ({ shape: 'd10', labels: UNITS, value })

/** A d100 check: one tens die per bonus or penalty die plus one, then the units die. */
export function checkDice(tensCount: number, roll: { tens: number[]; units: number; kept: number } | null): TrayDie[] {
  if (!roll) return [...Array.from({ length: tensCount }, () => tensDie(null)), unitsDie(null)]
  return [
    ...roll.tens.map((d, i) => tensDie(tensLabel(d), roll.tens.length > 1 && i !== roll.kept)),
    unitsDie(String(roll.units)),
  ]
}

function freeDie(sides: number, value: number | null): TrayDie[] {
  const label = value === null ? null : String(value)
  switch (sides) {
    case 3: return [{ shape: 'd6', labels: [...range(1, 3), ...range(1, 3)], value: label }]
    case 4: case 6: case 8: case 12: case 20:
      return [{ shape: `d${sides}` as DieShape, labels: range(1, sides), value: label }]
    case 10: return [{ shape: 'd10', labels: range(1, 10), value: label }]
    case 100:
      if (value === null) return [tensDie(null), unitsDie(null)]
      return [tensDie(tensLabel(Math.floor(value / 10) % 10)), unitsDie(String(value % 10))]
    default: return []
  }
}

/** Free dice from the Dés tab: `count` dice of `sides` (a D100 is two d10s). */
export function freeDice(count: number, sides: number, results: number[] | null): TrayDie[] {
  if (results) return results.flatMap((v) => freeDie(sides, v))
  return Array.from({ length: count }, () => freeDie(sides, null)).flat()
}
