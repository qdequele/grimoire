import { describe, expect, it } from 'vitest'
import { useLang } from '@/settings/lang'
import { currentT } from '@/i18n/t'
import { fold, searchCatalog } from './search'

const ids = (q: string, kind?: Parameters<typeof searchCatalog>[2]) => searchCatalog(currentT(), q, kind).map((c) => c.id)

describe('searching the catalogue', () => {
  it('ignores accents, case and punctuation', () => {
    expect(fold('  Lanterne à PÉTROLE ! ')).toBe('lanterne a petrole')
    expect(ids('lanterne a petrole')).toEqual(['lantern'])
    expect(ids('LUMIÈRE')).toContain('flashlight')
  })

  it("finds cards by what they help with, their type, calibre or text, not only their name", () => {
    expect(ids('grimper')).toEqual(['rope'])
    expect(ids('.38')).toEqual(['revolver-38', 'ammo-38'])
    expect(ids('occulte')).toEqual(expect.arrayContaining(['crucifix', 'amulet', 'chalk-salt', 'old-book']))
    expect(ids('nuisibles')).toEqual(['rifle-22'])
  })

  it('wants every word, ranks names first, and filters by type', () => {
    expect(ids('balles 45')).toEqual(['ammo-45', 'pistol-45']) // the pistol's text says "balles" too: names rank first
    expect(ids('fusil')[0]).toMatch(/^(rifle|shotgun)/)
    expect(ids('', 'medical')).toEqual(['first-aid-kit', 'bandages', 'laudanum'])
    expect(ids('zzz')).toEqual([])
  })

  it('also finds the English names, and the French ones in English', () => {
    const before = useLang.getState().lang
    useLang.setState({ lang: 'en' })
    try {
      expect(ids('crowbar')).toEqual(['crowbar'])
      expect(ids('pied de biche')).toEqual(['crowbar'])
      expect(ids('climb')).toEqual(['rope'])
    } finally {
      useLang.setState({ lang: before })
    }
  })
})
