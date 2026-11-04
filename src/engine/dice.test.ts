import { describe, expect, it } from 'vitest'
import { rollFormula, rollPercentile, successLevel } from './dice'
import { scriptedRng } from './random'

describe('successLevel', () => {
  it.each([
    [10, 50, 'extreme'],
    [11, 50, 'hard'],
    [25, 50, 'hard'],
    [26, 50, 'regular'],
    [50, 50, 'regular'],
    [51, 50, 'failure'],
    [1, 4, 'hard'], // floor(4/5) = 0, so no extreme success is possible
  ] as const)('%i against %i is %s', (roll, value, expected) => {
    expect(successLevel(roll, value)).toBe(expected)
  })
})

describe('rollPercentile', () => {
  it('combines tens and units', () => {
    // units 7, tens 4 → 47
    const r = rollPercentile(0, 0, scriptedRng([[7, 10], [4, 10]]))
    expect(r.result).toBe(47)
  })

  it('reads 00 + 0 as 100', () => {
    // die(10) % 10 → a face of 10 means 0
    const r = rollPercentile(0, 0, scriptedRng([[10, 10], [10, 10]]))
    expect(r.result).toBe(100)
  })

  it('keeps the lowest tens die with a bonus die', () => {
    const r = rollPercentile(1, 0, scriptedRng([[3, 10], [8, 10], [2, 10]]))
    expect(r.tens).toEqual([8, 2])
    expect(r.result).toBe(23)
    expect(r.keptIndex).toBe(1)
  })

  it('keeps the highest tens die with a penalty die', () => {
    const r = rollPercentile(0, 1, scriptedRng([[3, 10], [8, 10], [2, 10]]))
    expect(r.result).toBe(83)
  })

  it('cancels bonus and penalty one for one', () => {
    const r = rollPercentile(2, 2, scriptedRng([[5, 10], [6, 10]]))
    expect(r.tens).toHaveLength(1)
    expect(r.result).toBe(65)
  })
})

describe('rollFormula', () => {
  it('rolls dice plus a modifier', () => {
    const r = rollFormula('1D6+1', scriptedRng([[4, 6]]))
    expect(r?.total).toBe(5)
  })

  it('handles spaces, unicode minus and multiple dice terms', () => {
    const r = rollFormula('2D6 − 1 + 1D4', scriptedRng([[3, 6], [5, 6], [2, 4]]))
    expect(r?.total).toBe(9)
  })

  it('rolls a D3 as half a D6, rounded up', () => {
    expect(rollFormula('1D3', scriptedRng([[5, 6]]))?.total).toBe(3)
    expect(rollFormula('1D3', scriptedRng([[1, 6]]))?.total).toBe(1)
  })

  it('returns null for something that is not a formula', () => {
    expect(rollFormula('beaucoup')).toBeNull()
  })
})
