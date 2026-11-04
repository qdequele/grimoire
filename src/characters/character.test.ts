import { describe, expect, it } from 'vitest'
import { derived, formatSkills, parseSkills, type CharacterData } from './character'

const base: CharacterData = { name: 'Test', characteristics: {}, skills: {} }

describe('derived', () => {
  it('computes HP, MP and SAN from characteristics', () => {
    expect(derived({ ...base, characteristics: { CON: 55, SIZ: 70, POW: 62 } })).toEqual({ hp: 12, mp: 12, san: 62 })
  })

  it('keeps values written on the sheet', () => {
    expect(derived({ ...base, characteristics: { CON: 55, SIZ: 70, POW: 62 }, hp: 10, san: 45 })).toEqual({ hp: 10, mp: 12, san: 45 })
  })

  it('leaves values unknown when characteristics are missing', () => {
    expect(derived(base)).toEqual({ hp: undefined, mp: undefined, san: undefined })
  })
})

describe('parseSkills', () => {
  it('reads one skill per line, with or without separators and %', () => {
    expect(parseSkills('Trouver Objet Caché 60\nBibliothèque: 45\nPsychologie = 30%\n\nnot a skill')).toEqual({
      'Trouver Objet Caché': 60,
      Bibliothèque: 45,
      Psychologie: 30,
    })
  })

  it('round-trips with formatSkills', () => {
    const skills = { Écouter: 40, 'Langue (latin)': 25 }
    expect(parseSkills(formatSkills(skills))).toEqual(skills)
  })
})
