import { defaultRng, die, type Rng } from './random'

export interface FormulaTerm {
  sign: 1 | -1
  /** Present for dice terms like 2D6. Absent for flat modifiers. */
  dice?: { count: number; sides: number; results: number[] }
  value: number
}

export interface FormulaRoll {
  total: number
  terms: FormulaTerm[]
}

const MAX_DICE = 50

/**
 * Roll a damage-style formula: "1D6+1", "2D3 - 1", "1D10+1D4". Returns null if it can't be parsed.
 * A D3 is rolled as ceil(D6 / 2), like at the table.
 */
export function rollFormula(formula: string, rng: Rng = defaultRng): FormulaRoll | null {
  const normalized = formula.replace(/\s/g, '').toUpperCase().replace(/−/g, '-').replace(/×/g, '*')
  const parts = normalized.match(/[+-]?[^+-]+/g)
  if (!parts) return null

  const terms: FormulaTerm[] = []
  let total = 0
  for (const part of parts) {
    const sign: 1 | -1 = part.startsWith('-') ? -1 : 1
    const body = part.replace(/^[+-]/, '')
    const diceMatch = body.match(/^(\d*)D(\d+)$/)
    if (diceMatch) {
      const count = Number(diceMatch[1] || 1)
      const sides = Number(diceMatch[2])
      const results: number[] = []
      for (let i = 0; i < Math.min(count, MAX_DICE); i++) {
        results.push(sides === 3 ? Math.ceil(die(6, rng) / 2) : die(sides, rng))
      }
      const value = results.reduce((a, b) => a + b, 0)
      terms.push({ sign, dice: { count, sides, results }, value })
      total += sign * value
    } else if (/^\d+$/.test(body)) {
      const value = Number(body)
      terms.push({ sign, value })
      total += sign * value
    } else {
      return null
    }
  }
  return { total, terms }
}

export interface PercentileRoll {
  /** Final result, 1..100. */
  result: number
  /** Every tens die rolled (0..9). More than one when bonus or penalty dice apply. */
  tens: number[]
  units: number
  /** Bonus minus penalty dice. Positive keeps the lowest, negative the highest. */
  net: number
  /** Index in `tens` of the die that was kept. */
  keptIndex: number
}

/** Roll d100 with bonus and penalty dice. They cancel out one for one. 00 + 0 reads as 100. */
export function rollPercentile(bonus = 0, penalty = 0, rng: Rng = defaultRng): PercentileRoll {
  const net = bonus - penalty
  const units = die(10, rng) % 10
  const tens: number[] = []
  for (let i = 0; i < 1 + Math.abs(net); i++) tens.push(die(10, rng) % 10)
  const valueOf = (t: number) => (t === 0 && units === 0 ? 100 : t * 10 + units)
  const values = tens.map(valueOf)
  const result = net > 0 ? Math.min(...values) : net < 0 ? Math.max(...values) : values[0]
  return { result, tens, units, net, keptIndex: values.indexOf(result) }
}

export type SuccessLevel = 'extreme' | 'hard' | 'regular' | 'failure'

/**
 * Success level of a d100 result against a skill or characteristic value.
 * Matches the legacy app: no separate critical (01) or fumble yet.
 */
export function successLevel(result: number, value: number): SuccessLevel {
  if (result <= Math.floor(value / 5)) return 'extreme'
  if (result <= Math.floor(value / 2)) return 'hard'
  if (result <= value) return 'regular'
  return 'failure'
}
