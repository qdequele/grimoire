import { describe, expect, it } from 'vitest'
import { ALL_LANGS, filterByLanguage, langCode, languageName, pickLanguage, storyLanguages } from './languages'

const story = (lang: string) => ({ content: { meta: { lang } } })

describe('story language filter', () => {
  it('matches on the primary subtag', () => {
    expect(langCode('fr-FR')).toBe('fr')
    expect(langCode(' EN ')).toBe('en')
    expect(langCode('pt_BR')).toBe('pt')
    expect(langCode('')).toBe('')
  })

  it('lists languages once, the app language first', () => {
    const stories = [story('en'), story('fr'), story('de'), story('FR-fr'), story('')]
    expect(storyLanguages(stories, 'fr')).toEqual(['fr', 'de', 'en'])
    expect(storyLanguages(stories, 'en')).toEqual(['en', 'de', 'fr'])
  })

  it("defaults to the app language, or to all when no story is in it", () => {
    expect(pickLanguage(null, ['fr', 'en'], 'en')).toBe('en')
    expect(pickLanguage(null, ['en'], 'fr')).toBe(ALL_LANGS)
    expect(pickLanguage(null, [], 'fr')).toBe(ALL_LANGS)
  })

  it("keeps the keeper's choice", () => {
    expect(pickLanguage('en', ['fr', 'en'], 'fr')).toBe('en')
    expect(pickLanguage(ALL_LANGS, ['fr', 'en'], 'fr')).toBe(ALL_LANGS)
    expect(pickLanguage('DE', ['fr'], 'fr')).toBe('de')
  })

  it('filters stories', () => {
    const stories = [story('en'), story('fr-FR'), story('fr')]
    expect(filterByLanguage(stories, 'fr')).toHaveLength(2)
    expect(filterByLanguage(stories, 'de')).toHaveLength(0)
    expect(filterByLanguage(stories, ALL_LANGS)).toBe(stories)
  })

  it('names languages in the app language', () => {
    expect(languageName('en', 'fr')).toBe('Anglais')
    expect(languageName('fr', 'fr')).toBe('Français')
    expect(languageName('fr', 'en')).toBe('French')
    expect(languageName('zz', 'en')).toBe('ZZ')
  })
})
