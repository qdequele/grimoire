import { describe, expect, it } from 'vitest'
import { skillKeyLabel } from './character'

describe('skillKeyLabel', () => {
  it('shows the French label, with the specialty in brackets', () => {
    expect(skillKeyLabel('spot-hidden')).toBe('Trouver Objet Caché')
    expect(skillKeyLabel('art-craft:Photographie')).toBe('Arts et métiers (Photographie)')
    expect(skillKeyLabel('science-2:Pharmacologie')).toBe('Sciences (Pharmacologie)')
  })

  it('falls back to the raw key for unknown skills', () => {
    expect(skillKeyLabel('lockpicking-advanced')).toBe('lockpicking-advanced')
  })
})
