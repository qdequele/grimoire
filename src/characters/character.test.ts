import { describe, expect, it } from 'vitest'
import { progressSummary, skillKeyLabel } from './character'

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

describe('progressSummary', () => {
  const base = { name: 'X', characteristics: {}, skills: {} }

  it('is empty for an investigator who never played', () => {
    expect(progressSummary(base)).toEqual({ san: undefined, improved: [], checks: [], gamesPlayed: 0, history: [] })
  })

  it("reads the game engine's progression record", () => {
    const s = progressSummary({
      ...base,
      progress: {
        san: 47, skills: { Discrétion: 32 }, checks: ['Écouter'],
        hist: [{ at: 2, txt: 'A joué « Une histoire »' }, { at: 1, txt: 'SAN −3' }, { at: 0, txt: 'A joué « Une autre »' }],
      },
    })
    expect(s).toMatchObject({ san: 47, improved: [['Discrétion', 32]], checks: ['Écouter'], gamesPlayed: 2 })
    expect(s.history.map((h) => h.text)).toEqual(['A joué « Une histoire »', 'SAN −3', 'A joué « Une autre »'])
  })

  it('ignores malformed entries', () => {
    const s = progressSummary({ ...base, progress: { san: '12', skills: { A: 'x' }, checks: [3], hist: [{ at: 1 }] } })
    expect(s).toEqual({ san: undefined, improved: [], checks: [], gamesPlayed: 0, history: [] })
  })
})
