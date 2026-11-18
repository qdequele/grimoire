import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { DOC_RENEW_MS, documentRow, needsSigning } from './documents'
import { keeperRoll } from './rolls'

describe('documents kept for the players', () => {
  const now = Date.parse('2026-11-18T10:00:00Z')

  it('signs a picture again when its signature is missing or runs out soon', () => {
    const image = { bucket: 'story-packs', path: 'a/b.png' }
    expect(needsSigning(image, now)).toBe(true)
    expect(needsSigning({ ...image, url: 'https://x.test/b', until: now + DOC_RENEW_MS - 1 }, now)).toBe(true)
    expect(needsSigning({ ...image, url: 'https://x.test/b', until: now + DOC_RENEW_MS + 60_000 }, now)).toBe(false)
    // Not a stored picture: nothing to sign.
    expect(needsSigning(null, now)).toBe(false)
    expect(needsSigning({ url: 'https://x.test/b' }, now)).toBe(false)
  })

  it('keeps a document that has a text or a signed picture, within the table’s limits', () => {
    expect(documentRow('g', { key: 'handout:x', title: 'Lettre', text: 'Texte', image: null }, null))
      .toMatchObject({ game_id: 'g', key: 'handout:x', title: 'Lettre', body: 'Texte', image: null })
    expect(documentRow('g', { key: 'upload:p', title: '', image: { bucket: 'screen-images', path: 'p' } }, { bucket: 'screen-images', path: 'p', url: 'https://x.test/p', until: 1 }))
      .toMatchObject({ body: null, image: { url: 'https://x.test/p' } })
    // A picture that could not be signed and no text: nothing to keep.
    expect(documentRow('g', { key: 'upload:p', title: '', image: { bucket: 'screen-images', path: 'p' } }, null)).toBeNull()
    const long = documentRow('g', { key: 'k'.repeat(400), title: 't'.repeat(300), text: 'x'.repeat(30_000), image: null }, null)!
    expect([long.key.length, long.title.length, long.body!.length]).toEqual([300, 200, 20_000])
  })
})

describe('the keeper’s rolls for the table', () => {
  it('turns what the engine rolled into a row, within the database’s bounds', () => {
    expect(keeperRoll('g', 'o', 'c', { kind: 'check', subject: 'label:Bibliothèque', target: 260, net: 5, dice: { tens: [3], units: 4 }, result: 34, level: 'hard' }))
      .toEqual({ game_id: 'g', owner_id: 'o', character_id: 'c', source: 'keeper', kind: 'check', subject: 'label:Bibliothèque', target: 200, net: 2, dice: { tens: [3], units: 4 }, result: 34, level: 'hard', effect: null })
    expect(keeperRoll('g', 'o', 'c', { kind: 'damage', subject: 'label:Chute', dice: { formula: '1D6', total: 4 }, result: 4, effect: { field: 'pv', delta: -4, from: 11, to: 7 } }))
      .toMatchObject({ kind: 'damage', source: 'keeper', effect: { field: 'pv', delta: -4 } })
  })

  it('drops what isn’t a roll', () => {
    expect(keeperRoll('g', 'o', 'c', { kind: 'check', subject: 'san', dice: {}, result: 3, level: 'crit', target: 50 })).toBeNull()
    expect(keeperRoll('g', 'o', 'c', { kind: 'dice', subject: 'x', dice: {}, result: 3 })).toBeNull()
    expect(keeperRoll('g', 'o', 'c', { kind: 'damage', subject: '', dice: {}, result: 3 })).toBeNull()
    expect(keeperRoll('g', 'o', 'c', { kind: 'damage', subject: 'label:x', dice: {}, result: 1.5 })).toBeNull()
  })
})
