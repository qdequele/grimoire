import { describe, expect, it } from 'vitest'
import { pngName } from './CardPng'
import { mirrored, sheetPages } from './PrintSheet'

describe('the print sheet', () => {
  it('lays cards out nine a page, padding the last page', () => {
    const pages = sheetPages(Array.from({ length: 13 }, (_, i) => i))
    expect(pages).toHaveLength(2)
    expect(pages[1]).toEqual([9, 10, 11, 12, null, null, null, null, null])
    expect(sheetPages([])).toEqual([])
  })

  it('mirrors each row of backs, so they land behind their cards on a long-edge flip', () => {
    expect(mirrored([0, 1, 2, 3, null, null, null, null, null])).toEqual([2, 1, 0, null, null, 3, null, null, null])
  })
})

describe('PNG file names', () => {
  it('come from the card name, without accents or punctuation', () => {
    expect(pngName('Revolver .38')).toBe('revolver-38.png')
    expect(pngName('Clé d’un métal inconnu')).toBe('cle-d-un-metal-inconnu.png')
    expect(pngName('…')).toBe('carte.png')
  })
})
