import { describe, expect, it } from 'vitest'
import { CHARACTERISTIC_ARRAY, OCCUPATION_ARRAY } from '@/rules/d100'
import {
  applyOccupation,
  checkDraft,
  derivedValues,
  finalSkills,
  generateNames,
  ISSUE_STEP,
  newDraft,
  remaining,
  rollCharacteristic,
  rollLuck,
  skillTotal,
  type CreationDraft,
} from './creation'
import { scriptedRng } from './random'

/** A complete, valid journalist. */
function complete(): CreationDraft {
  let d = newDraft('journalist')
  d = { ...d, name: 'Ada Whitcombe', luck: 55 }
  const values = [...CHARACTERISTIC_ARRAY]
  d.characteristics = { STR: values[0], CON: values[1], SIZ: values[2], DEX: values[3], APP: values[4], INT: values[5], POW: values[6], EDU: values[7] }
  // journalist: art-craft, library-use, history, language-own, psychology + social + 2 free
  d.occupationSkills = [...d.occupationSkills, 'charm', 'listen', 'spot-hidden']
  const occ = [...d.occupationSkills, 'credit-rating']
  d.occupationValues = Object.fromEntries(occ.map((s, i) => [s, OCCUPATION_ARRAY[i]]))
  d.personalInterests = ['stealth', 'climb', 'swim', 'occult']
  return d
}

describe('derivedValues', () => {
  it('computes HP, SAN, MP, dodge and own language', () => {
    const v = derivedValues({ CON: 50, SIZ: 60, POW: 70, DEX: 55, EDU: 80 })
    expect(v).toMatchObject({ hp: 11, san: 70, mp: 14, move: 8, dodge: 27, ownLanguage: 80 })
  })

  it.each([
    [40, 24, '-2', -2],
    [40, 44, '-1', -1],
    [60, 64, '0', 0],
    [70, 94, '+1D4', 1],
    [90, 80, '+1D6', 2],
  ])('STR %i + SIZ %i gives damage bonus %s, build %i', (STR, SIZ, damageBonus, build) => {
    expect(derivedValues({ STR, SIZ })).toMatchObject({ damageBonus, build })
  })
})

describe('remaining', () => {
  it('removes each placed value once', () => {
    expect(remaining(CHARACTERISTIC_ARRAY, [50, 80, 50])).toEqual([40, 50, 60, 60, 70])
  })
})

describe('rolls', () => {
  it('rolls 3D6 × 5 or (2D6+6) × 5 depending on the characteristic', () => {
    expect(rollCharacteristic('STR', scriptedRng([[3, 6], [4, 6], [5, 6]]))).toBe(60)
    expect(rollCharacteristic('SIZ', scriptedRng([[3, 6], [4, 6]]))).toBe(65)
    expect(rollLuck(scriptedRng([[1, 6], [1, 6], [1, 6]]))).toBe(15)
  })
})

describe('occupations', () => {
  it('switching occupation resets occupation skills and default specialties', () => {
    const d = applyOccupation({ ...newDraft('journalist'), personalInterests: ['medicine', 'stealth'] }, 'doctor')
    expect(d.occupationSkills).toContain('medicine')
    expect(d.specialties).toEqual({ 'language-other': 'Latin', science: 'Biologie', 'science-2': 'Pharmacologie' })
    // an interest that became an occupation skill is dropped
    expect(d.personalInterests).toEqual(['stealth'])
  })
})

describe('skillTotal', () => {
  it('uses the placed value for occupation skills, base + 20 for interests, base otherwise', () => {
    const d = complete()
    expect(skillTotal('art-craft', d)).toBe(70)
    expect(skillTotal('stealth', d)).toBe(40) // 20 + 20
    expect(skillTotal('first-aid', d)).toBe(30)
    expect(skillTotal('dodge', d)).toBe(25) // DEX 50 / 2
    expect(skillTotal('credit-rating', d)).toBe(40)
  })
})

describe('checkDraft', () => {
  it('accepts a complete investigator', () => {
    expect(checkDraft(complete())).toEqual({ issues: [], warnings: [] })
  })

  it('lists everything still missing on a new draft', () => {
    const codes = checkDraft(newDraft()).issues.map((i) => i.code)
    expect(codes).toEqual(expect.arrayContaining(['name', 'characteristic', 'luck', 'occupationSkills', 'socialSkill', 'occupationValues', 'personalInterests']))
  })

  it('warns when hand-typed characteristics are not the fixed values', () => {
    const d = complete()
    d.characteristics.STR = 75
    expect(checkDraft(d).warnings).toEqual([{ code: 'characteristicArray' }])
    expect(checkDraft({ ...d, rolled: true }).warnings).toEqual([])
  })

  it('requires a social skill when the occupation asks for one', () => {
    const d = complete()
    d.occupationSkills = d.occupationSkills.map((s) => (s === 'charm' ? 'drive-auto' : s))
    d.occupationValues = { ...d.occupationValues, 'drive-auto': d.occupationValues.charm }
    delete d.occupationValues.charm
    expect(checkDraft(d).issues).toEqual([{ code: 'socialSkill' }])
  })
})

describe('finalSkills', () => {
  it('keeps occupation skills, interests, dodge and credit, with specialties, best first', () => {
    const skills = finalSkills(complete())
    expect(Object.keys(skills)[0]).toBe('art-craft:Photographie')
    expect(skills).toMatchObject({ 'art-craft:Photographie': 70, stealth: 40, dodge: 25, 'credit-rating': 40 })
    expect(Object.keys(skills)).toHaveLength(14)
  })
})

describe('generateNames', () => {
  it('gives six distinct names of the chosen gender and origin', () => {
    let seed = 1
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const names = generateNames('irl', 'f', rng)
    expect(new Set(names).size).toBe(6)
    for (const n of names) expect(n).toMatch(/^(Bridget|Catherine|Delia|Eileen|Honora|Kathleen|Maeve|Mary|Nora|Rose|Sheila)( [A-Z]\.)? \S+/)
  })
})

describe('ISSUE_STEP', () => {
  it('points every issue of a new draft at a step before the summary', () => {
    for (const i of checkDraft(newDraft()).issues) expect(ISSUE_STEP[i.code]).toBeLessThan(6)
  })
})
