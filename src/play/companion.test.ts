import { describe, expect, it } from 'vitest'
import type { CharacterData } from '@/characters/character'
import { addMissingMembers, applyPoints, diffPoints, keeperEchoAction, partyIds, pointsFromState, type PointsRow } from './companion'
import type { LegacyState } from './host'

const slot = (cid: string, v = 10) => ({ cid, player: '', pv: v, san: v + 1, chance: v + 2, pm: v + 3, state: '', note: '' })
const stateOf = (): LegacyState => ({
  chars: [{ id: 'c1' }, { id: 'x9' }],
  players: [],
  prog: { c1: { skills: {}, checks: ['A'], hist: [], player: '', owner: null } },
  scen: { s: { party: [slot('c1'), slot('x9', 20)] } },
})
const data = (name: string): CharacterData => ({ name, characteristics: { DEX: 50 }, skills: {} })
const row = (over: Partial<PointsRow>): PointsRow => ({
  characterId: 'c1', pv: 1, san: 2, chance: 3, pm: 4, checks: [], source: 'phone', updatedAt: '2026-01-02T00:00:00Z', ...over,
})
const mkSlot = (c: unknown) => slot((c as { id: string }).id, 5)

describe('companion helpers', () => {
  it('pointsFromState reads pv/san/chance/pm and prog checks per slot', () => {
    const m = pointsFromState(stateOf(), 's')
    expect(m.get('c1')).toEqual({ pv: 10, san: 11, chance: 12, pm: 13, checks: ['A'] })
    expect(m.get('x9')?.checks).toEqual([])
  })

  it('diffPoints returns only changed investigators', () => {
    const last = pointsFromState(stateOf(), 's')
    const S = stateOf()
    ;(S.scen as { s: { party: Array<{ pv: number }> } }).s.party[0].pv = 3
    expect(diffPoints(pointsFromState(S, 's'), last).map((d) => d.characterId)).toEqual(['c1'])
    const S2 = stateOf()
    ;(S2.prog as { c1: { checks: string[] } }).c1.checks = ['A', 'B']
    expect(diffPoints(pointsFromState(S2, 's'), last).map((d) => d.characterId)).toEqual(['c1'])
  })

  it('returns nothing after a remote change was recorded in last', () => {
    const S = applyPoints(stateOf(), 's', [row({})], 0)
    const applied = pointsFromState(S, 's')
    expect(diffPoints(pointsFromState(S, 's'), applied)).toEqual([])
  })

  it('applyPoints ignores keeper rows and rows older than since', () => {
    const S = stateOf()
    const since = Date.parse('2026-01-01T00:00:00Z')
    const out = applyPoints(S, 's', [row({ source: 'keeper' }), row({ characterId: 'x9', updatedAt: '2025-12-31T00:00:00Z' })], since)
    expect(pointsFromState(out, 's')).toEqual(pointsFromState(S, 's'))
  })

  it('applies newer phone rows to slot and prog.san without mutating the input', () => {
    const S = stateOf()
    const before = JSON.stringify(S)
    const out = applyPoints(S, 's', [row({})], 0)
    expect(pointsFromState(out, 's').get('c1')).toMatchObject({ pv: 1, san: 2, chance: 3, pm: 4 })
    expect((out.prog as Record<string, { san: number; checks: string[] }>).c1).toMatchObject({ san: 2, checks: ['A'] })
    expect(JSON.stringify(S)).toBe(before)
  })

  it('addMissingMembers adds a listed investigator once', () => {
    const S = stateOf()
    const before = JSON.stringify(S)
    const members = [{ id: 'c1', data: data('A') }, { id: 'c2', data: data('B'), player: 'P' }, { id: 'c3', data: data('C'), player: 'p' }]
    const out = addMissingMembers(S, { mkSlot }, 's', members)
    expect(JSON.stringify(S)).toBe(before)
    expect(partyIds(out, 's', new Set(['c1', 'c2', 'c3']))).toEqual(['c1', 'c2', 'c3'])
    expect((out.players as unknown[]).length).toBe(1)
    expect((out.chars as Array<{ id: string }>).map((c) => c.id)).toEqual(['c1', 'x9', 'c2', 'c3'])
    expect((out.prog as Record<string, { owner: string }>).c3.owner).toBe('p-1')
    const again = addMissingMembers(out, { mkSlot }, 's', members)
    expect(again).toBe(out)
  })

  it("partyIds skips in-game investigators that aren't account ones", () => {
    expect(partyIds(stateOf(), 's', new Set(['c1']))).toEqual(['c1'])
  })

  describe('keeperEchoAction', () => {
    const p = (pv: number, checks: string[] = []) => ({ pv, san: 50, chance: 40, pm: 8, checks })

    it('ignores the echo of our own write', () => {
      expect(keeperEchoAction(p(10), p(10), false)).toBe('ignore')
      expect(keeperEchoAction(p(10), p(10), true)).toBe('ignore')
    })

    it('repairs an older own write that landed after a phone value', () => {
      expect(keeperEchoAction(p(3), p(9), true)).toBe('repair')
    })

    it("adopts another tab's change, and doesn't fight its checks", () => {
      expect(keeperEchoAction(p(10), p(7), false)).toBe('adopt')
      expect(keeperEchoAction(p(10, ['A']), p(10, ['B']), false)).toBe('ignore')
    })

    it("two keeper tabs with different values settle instead of writing back and forth", () => {
      // Each tab: what it last wrote, and whether a phone value came since. Tab 1 writes X = 1.
      const tabs = [{ last: p(1), phone: false }, { last: p(2), phone: false }]
      let inFlight: Array<{ to: number; value: ReturnType<typeof p> }> = [{ to: 1, value: p(1) }]
      let writes = 0
      for (let step = 0; step < 20 && inFlight.length; step++) {
        const next: typeof inFlight = []
        for (const { to, value } of inFlight) {
          const tab = tabs[to]
          const action = keeperEchoAction(tab.last, value, tab.phone)
          if (action === 'adopt') tab.last = value
          if (action === 'repair') {
            tab.phone = false
            writes++
            next.push({ to: 1 - to, value: tab.last }, { to, value: tab.last })
          }
        }
        inFlight = next
      }
      expect(inFlight).toEqual([])
      expect(writes).toBe(0)
      expect(tabs[1].last).toEqual(p(1))
    })
  })
})
