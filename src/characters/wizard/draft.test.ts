import { describe, expect, it } from 'vitest'
import type { CharacterRow } from '../api'
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
