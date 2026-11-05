import { describe, expect, it } from 'vitest'
import type { CharacterData } from '@/characters/character'
import { clampPoints, skillRows } from './sheet'

const data = (over: Partial<CharacterData> = {}): CharacterData => ({
  name: 'X',
  characteristics: {},
  skills: { 'library-use': 55, persuade: 61, 'art-craft:Photographie': 7 },
  ...over,
})

describe('skillRows', () => {
  it('skillRows computes hard and extreme values and marks checked skills', () => {
    const rows = skillRows(data({ progress: { checks: ['Persuasion'] } }), ['Bibliothèque'])
    expect(rows.map((r) => r.label)).toEqual(['Arts et métiers (Photographie)', 'Bibliothèque', 'Persuasion'])
    expect(rows[0]).toEqual({ key: 'art-craft:Photographie', label: 'Arts et métiers (Photographie)', value: 7, hard: 3, extreme: 1, checked: false })
    expect(rows[1]).toMatchObject({ key: 'library-use', value: 55, hard: 27, extreme: 11, checked: true })
    expect(rows[2]).toMatchObject({ key: 'persuade', value: 61, hard: 30, extreme: 12, checked: true })
  })

  it('uses values improved in play and tolerates a sheet without skills or progress', () => {
    const rows = skillRows(data({ progress: { skills: { Persuasion: 66 }, checks: 'nope' } }))
    expect(rows.find((r) => r.key === 'persuade')).toMatchObject({ value: 66, hard: 33, extreme: 13, checked: false })
    expect(skillRows({ name: 'Y' } as CharacterData)).toEqual([])
  })
})

describe('clampPoints', () => {
  it('clampPoints keeps values within 0..maxHp and 0..99', () => {
    expect(clampPoints({ pv: 14, san: 120, chance: -3, pm: 50 }, 11)).toEqual({ pv: 11, san: 99, chance: 0, pm: 50 })
    expect(clampPoints({ pv: -1, san: 0, chance: 99, pm: 100 }, 11)).toEqual({ pv: 0, san: 0, chance: 99, pm: 99 })
  })
})
