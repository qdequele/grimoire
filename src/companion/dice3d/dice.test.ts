import { describe, expect, it } from 'vitest'
import { checkDice, freeDice } from './dice'
import { dieFaces } from './geometry'

const values = (dice: ReturnType<typeof freeDice>) => dice.map((d) => d.value)

describe('dice shown for a roll', () => {
  it('a d100 check is a tens die and a units die; bonus dice add tens dice, set aside unless kept', () => {
    expect(values(checkDice(1, { tens: [4], units: 7, kept: 0 }))).toEqual(['40', '7'])
    expect(values(checkDice(1, { tens: [0], units: 0, kept: 0 }))).toEqual(['00', '0'])
    const bonus = checkDice(2, { tens: [6, 2], units: 3, kept: 1 })
    expect(values(bonus)).toEqual(['60', '20', '3'])
    expect(bonus.map((d) => !!d.dim)).toEqual([true, false, false])
    expect(checkDice(3, null).map((d) => [d.shape, d.value])).toEqual([['d10', null], ['d10', null], ['d10', null], ['d10', null]])
  })

  it('free dice: one die each, a D3 on a d6, a D100 as two d10s', () => {
    expect(freeDice(2, 8, [3, 8]).map((d) => [d.shape, d.value])).toEqual([['d8', '3'], ['d8', '8']])
    expect(freeDice(1, 3, [2])[0]).toMatchObject({ shape: 'd6', labels: ['1', '2', '3', '1', '2', '3'], value: '2' })
    expect(values(freeDice(3, 100, [47, 100, 5]))).toEqual(['40', '7', '00', '0', '00', '5'])
    expect(freeDice(2, 100, null)).toHaveLength(4)
    expect(freeDice(3, 6, null)).toHaveLength(3)
  })

  it('every die has one label per face, and its value among them', () => {
    for (const sides of [3, 4, 6, 8, 10, 12, 20, 100]) {
      const results = sides === 100 ? [1, 50, 99, 100] : Array.from({ length: sides }, (_, i) => i + 1)
      for (const d of freeDice(results.length, sides, results)) {
        expect(d.labels).toHaveLength(dieFaces(d.shape).length)
        expect(d.labels).toContain(d.value)
      }
    }
  })
})
