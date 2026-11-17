import { describe, expect, it } from 'vitest'
import { newDraft } from '@/engine/creation'
import type { CharacterRow } from '../api'
import { SHEET_LIMITS, toCharacterData } from '../character'
import { draftFromCharacter } from './draft'

const row = (data: unknown): CharacterRow => ({ data, player_id: null } as unknown as CharacterRow)

describe('draftFromCharacter', () => {
  it('opens a sheet with only a name (created from a phone)', () => {
    const d = draftFromCharacter(row({ name: 'Bare' }))
    expect(d).toMatchObject({ name: 'Bare', characteristics: {}, profile: {}, personalInterests: [], playerId: '' })
  })

  it('fills what a partial wizard state lacks', () => {
    const d = draftFromCharacter(row({ name: 'P', creation: { name: 'P', characteristics: 'x', step: 2 } }))
    expect(d.characteristics).toEqual({})
    expect(Array.isArray(d.occupationSkills)).toBe(true)
    expect(d.specialties).toEqual({})
  })
})

// A sheet made on a phone carries a `creation` blob the phone chose. Rows stored before the database
// checked it are still there: the wizard must open them, whatever they hold.
describe('draftFromCharacter, untrusted wizard state', () => {
  const hostile = {
    name: 'Checked',
    age: 31,
    characteristics: { STR: 50 },
    luck: 45,
    creation: {
      name: 'Other <b>',
      occupation: 7,
      age: 'old',
      link: 5,
      luck: 'lots',
      rolled: 'yes',
      characteristics: { STR: 60, DEX: 'x', HACK: 99 },
      occupationSkills: ['art-craft', 4, null, { id: 'x' }],
      occupationValues: { 'art-craft': 70, dodge: 'high' },
      personalInterests: ['listen', ['nested']],
      specialties: { 'art-craft': 'p'.repeat(90), listen: 3 },
      profile: { description: 'Tall', ideology: 12, unknown: 'kept out' },
      extra: { anything: true },
    },
  }

  it('keeps only values of the right type', () => {
    const d = draftFromCharacter(row(hostile))
    expect(d.occupation).toBe('custom')
    expect(d.age).toBe(31)
    expect(d.link).toBe('')
    expect(d.luck).toBe(45)
    expect(d.rolled).toBe(false)
    expect(d.characteristics).toEqual({ STR: 60 })
    expect(d.occupationSkills).toEqual(['art-craft'])
    expect(d.occupationValues).toEqual({ 'art-craft': 70 })
    expect(d.personalInterests).toEqual(['listen'])
    expect(d.specialties).toEqual({ 'art-craft': 'p'.repeat(SHEET_LIMITS.specialty) })
    expect(d.profile).toEqual({ description: 'Tall' })
    expect(d).not.toHaveProperty('extra')
  })

  it("takes the sheet's own name, which the database checked, over the blob's", () => {
    expect(draftFromCharacter(row(hostile)).name).toBe('Checked')
  })

  it('gives a draft the wizard can render and save', () => {
    const d = draftFromCharacter(row(hostile))
    expect(() => d.link.trim()).not.toThrow()
    const sheet = toCharacterData(d)
    expect(sheet.name).toBe('Checked')
    expect(Object.keys(sheet.skills).every((k) => k.length <= SHEET_LIMITS.skillKey)).toBe(true)
  })

  it('cuts texts to the sheet limits', () => {
    const d = draftFromCharacter(row({ name: 'N', creation: { link: 'l'.repeat(500), profile: { traits: 't'.repeat(5000) } } }))
    expect(d.link).toHaveLength(SHEET_LIMITS.link)
    expect(d.profile.traits).toHaveLength(SHEET_LIMITS.profile)
  })

  it('leaves a wizard-made state as it was', () => {
    const made = {
      ...newDraft('journalist'),
      name: 'Made', age: 40, link: 'Cousin', luck: 55, rolled: true,
      characteristics: { STR: 40, DEX: 70 },
      occupationValues: { 'art-craft': 60 },
      personalInterests: ['listen'],
      specialties: { 'art-craft': 'Photo & film' },
      profile: { traits: 'Curious' },
    }
    const d = draftFromCharacter(row({ name: 'Made', creation: made }))
    expect(d).toEqual({ ...made, playerId: '' })
  })
})
