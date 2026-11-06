import { describe, expect, it } from 'vitest'
import type { CharacterData } from '@/characters/character'
import { clampPoints, companionSheet, companionSheetProblems, skillRows } from './sheet'

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

describe('companionSheet', () => {
  it('brings skills and age within what the server accepts', () => {
    const d = companionSheet({ name: 'Z', age: 200, characteristics: {}, skills: { own: 110, spot: 45 } })
    expect(d).toMatchObject({ age: 150, skills: { own: 99, spot: 45 } })
  })
})

describe('companionSheetProblems', () => {
  const sheet = (over: Partial<CharacterData> = {}): CharacterData => ({ name: 'Ada', characteristics: {}, skills: { dodge: 30 }, ...over })
  const at = (n: number) => 'a'.repeat(n)

  it('accepts every text at its limit', () => {
    const d = sheet({
      name: at(80), occupation: at(200), link: at(200), profile: { traits: at(2000) },
      skills: { [`art-craft:${at(80 - 'art-craft:'.length)}`]: 5 },
    })
    expect(companionSheetProblems(d, at(80))).toEqual([])
  })

  it('names each text one character over its limit (the server refuses them)', () => {
    const key = `art-craft:${at(81 - 'art-craft:'.length)}`
    const d = sheet({ name: at(81), occupation: at(201), link: at(201), profile: { traits: at(2001) }, skills: { [key]: 5 } })
    expect(companionSheetProblems(d, at(81))).toEqual([
      { field: 'name', reason: 'tooLong', max: 80 },
      { field: 'occupation', reason: 'tooLong', max: 200 },
      { field: 'link', reason: 'tooLong', max: 200 },
      { field: 'profile', id: 'traits', reason: 'tooLong', max: 2000 },
      { field: 'skill', key, reason: 'tooLong', max: 80 },
      { field: 'playerName', reason: 'tooLong', max: 80 },
    ])
  })

  it('measures the name and first name trimmed, like the server', () => {
    expect(companionSheetProblems(sheet({ name: ` ${at(80)} ` }), ` ${at(80)} `)).toEqual([])
  })

  it('refuses < > & " in the name, skill keys and first name', () => {
    const key = 'art-craft:<img src=x>'
    expect(companionSheetProblems(sheet({ name: 'A & B', skills: { [key]: 5 } }), 'Bo"b')).toEqual([
      { field: 'name', reason: 'markup' },
      { field: 'skill', key, reason: 'markup' },
      { field: 'playerName', reason: 'markup' },
    ])
  })
})
