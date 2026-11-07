import { describe, expect, it } from 'vitest'
import { engineDice, MAX_SHOWN } from './diceRecord'

const values = (dice: ReturnType<typeof engineDice>) => dice?.map((d) => [d.shape, d.value, !!d.dim])

describe('engine dice record → 3D dice', () => {
  it('a d100 roll: tens dice (the unused ones set aside) and the units die', () => {
    expect(values(engineDice({ tens: [3], u: 4, used: 0 }))).toEqual([['d10', '30', false], ['d10', '4', false]])
    expect(values(engineDice({ tens: [7, 0], u: 0, used: 1 }))).toEqual([['d10', '70', true], ['d10', '00', false], ['d10', '0', false]])
  })

  it('formula dice, a D3 on a d6 and a D100 as two d10s', () => {
    expect(values(engineDice({ rolls: [[6, 5], [6, 6]] }))).toEqual([['d6', '5', false], ['d6', '6', false]])
    expect(values(engineDice({ rolls: [[3, 2], [100, 47]] }))).toEqual([['d6', '2', false], ['d10', '40', false], ['d10', '7', false]])
  })

  it('nothing to draw: unknown dice, too many, or data that isn\'t a roll', () => {
    expect(engineDice({ rolls: [[7, 3]] })).toBeNull()
    expect(engineDice({ rolls: [[6, 7]] })).toBeNull()
    expect(engineDice({ rolls: [] })).toBeNull()
    expect(engineDice({ rolls: Array.from({ length: MAX_SHOWN + 1 }, () => [6, 1]) })).toBeNull()
    expect(engineDice({ tens: [10], u: 1, used: 0 })).toBeNull()
    expect(engineDice({ tens: [1, 2], u: 1, used: 2 })).toBeNull()
    expect(engineDice(null)).toBeNull()
    expect(engineDice('2D6')).toBeNull()
  })
})
