import { describe, expect, it } from 'vitest'
import { PROFILE_FIELDS as APP_FIELDS } from '../../../src/rules/d100'
import { parseProfileRequest, pickSuggestions, PROFILE_FIELDS, profileSchema, profileUserPrompt, type ProfileRequest } from './profile'

const request = (over: Partial<ProfileRequest> = {}): ProfileRequest => ({
  name: 'Ada Lark', occupation: 'Journaliste', age: 31, link: 'Ancienne étudiante du professeur',
  characteristics: { APP: 80, POW: 40 }, skills: ['Bibliothèque 70', 'Psychologie 60'],
  profile: { ideology: 'La vérité finit toujours par sortir' }, ...over,
})

describe('profile fields', () => {
  it('match the wizard fields in src/rules/d100.ts', () => {
    expect(PROFILE_FIELDS.map((f) => [f.id, f.label])).toEqual(APP_FIELDS.map((f) => [f.id, f.label]))
  })

  it('schema requires every field and forbids extras (structured outputs rules)', () => {
    const s = profileSchema() as { required: string[]; properties: object; additionalProperties: boolean }
    expect(s.required).toEqual(Object.keys(s.properties))
    expect(s.additionalProperties).toBe(false)
  })
})

describe('parseProfileRequest', () => {
  it('caps free text and drops junk', () => {
    const r = parseProfileRequest({
      name: 'x'.repeat(500), occupation: 'Médecin', age: 400,
      characteristics: { STR: 50, 'drop table': 3, APP: 'high' }, skills: ['a', 42, 'b'],
      profile: { ideology: '  Dieu est mort  ', unknown: 'x' },
    }) as ProfileRequest
    expect(r.name).toHaveLength(80)
    expect(r.age).toBe(0)
    expect(r.characteristics).toEqual({ STR: 50 })
    expect(r.skills).toEqual(['a', 'b'])
    expect(r.profile).toEqual({ ideology: 'Dieu est mort' })
  })

  it('rejects an unknown field to regenerate', () => {
    expect(parseProfileRequest({ field: 'shoeSize' })).toMatch(/field must be one of/)
  })
})

describe('profileUserPrompt', () => {
  it('gives the facts and the keeper’s own text, and asks to fill the blanks', () => {
    const p = profileUserPrompt(request())
    expect(p).toContain('Journaliste')
    expect(p).toContain('APP 80')
    expect(p).toContain('Idéologie : La vérité finit toujours par sortir')
    expect(p).toContain('Remplis les champs vides')
  })

  it('asks for something different when regenerating one field', () => {
    expect(profileUserPrompt(request({ field: 'ideology' }))).toContain('différente de « La vérité finit toujours par sortir »')
  })
})

describe('pickSuggestions', () => {
  const output = {
    description: 'Grande, toujours en imperméable', ideology: 'Overwritten?', significantPeople: 'Son frère, Tom',
    meaningfulLocations: 'Le port de Boston', treasuredPossessions: 'Un appareil photo Kodak', traits: 'Têtue',
  }

  it('fills only the empty fields, never the keeper’s text', () => {
    const s = pickSuggestions(request(), output)
    expect(s).not.toHaveProperty('ideology')
    expect(Object.keys(s)).toHaveLength(5)
  })

  it('returns just the regenerated field', () => {
    expect(pickSuggestions(request({ field: 'ideology' }), output)).toEqual({ ideology: 'Overwritten?' })
  })
})
