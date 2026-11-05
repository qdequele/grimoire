import { describe, expect, it } from 'vitest'
import type { CharacterData } from '@/characters/character'
import { addMissingMembers, applyPoints, diffPoints, partyIds, pointsFromState, type PointsRow } from './companion'
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
})
