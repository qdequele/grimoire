import { describe, expect, it } from 'vitest'
import { CATALOG_BY_ID } from './catalog'
import { documentCard, documentItemId, excerpt, plainText } from './documents'
import { filledCard } from './DocumentFields'
import { storyDocuments } from './engine'
import { ITEM_LIMITS, parseCard } from './item'

const names = { scene: new Map([['hall', 'The hall']]), npc: new Map([['ada', 'Ada']]), handout: new Map([['note', 'A note']]) }

describe('document cards', () => {
  it('writes out the story’s references, keeps bold, italics and line breaks', () => {
    const card = documentCard({ id: 'l', title: 'Letter from <Ada>', text: '**Dear** {{npc:ada}},\nmeet me in [[hall]], see [[hall|the old hall]] and {{handout:note}}.' }, names)
    expect(card).toEqual({ name: 'Letter from Ada', kind: 'document', art: 'notebook', document: '**Dear** Ada,\nmeet me in The hall, see the old hall and A note.' })
    expect(parseCard(card).card).toEqual(card)
  })

  it('draws plans and maps as maps, and cuts a text over the card’s limit', () => {
    expect(documentCard({ id: 'p', title: 'Plan du manoir' }, names)).toEqual({ name: 'Plan du manoir', kind: 'document', art: 'map' })
    const long = documentCard({ id: 'x', title: 'Long', text: 'a'.repeat(ITEM_LIMITS.document + 50) }, names)
    expect(long.document).toHaveLength(ITEM_LIMITS.document)
    expect(long.document!.endsWith('…')).toBe(true)
    expect(parseCard({ ...long, document: 'a'.repeat(ITEM_LIMITS.document + 1) }).card).toBeNull()
  })

  it('shows the first words on the card face, without marks', () => {
    expect(plainText('**Night** *one*.\nLamp [[x|out]].')).toBe('Night one. Lamp out.')
    expect(excerpt('word '.repeat(60), 40)).toMatch(/^word( word)*…$/)
    expect(excerpt('Short.')).toBe('Short.')
  })

  it('reads a story’s documents as cards to give, with ids apart from its items', () => {
    const docs = storyDocuments({ acts: [], npcs: [{ id: 'ada', name: 'Ada' }], handouts: [{ id: 'note', title: 'A note', text: 'From {{npc:ada}}' }, { id: 'bad' }] })
    expect(docs).toEqual([{ itemId: documentItemId('note'), card: { name: 'A note', kind: 'document', art: 'notebook', document: 'From Ada' } }])
    expect(documentItemId('note')).toBe('handout:note')
  })

  it('fills a paper template with the keeper’s title and text', () => {
    const letter = CATALOG_BY_ID.get('letter')!
    expect(letter.fill).toBe(true)
    expect(filledCard(letter.card, { title: ' A letter to "Martha" ', text: 'Come at once.' }, 'Lettre')).toEqual({
      name: 'A letter to Martha', kind: 'document', art: 'notebook', rarity: 1, document: 'Come at once.',
    })
    // Without text, the template's own blurb stays; without a title, the template's name.
    expect(filledCard(letter.card, { title: '', text: '' }, 'Lettre')).toEqual({ ...letter.card, name: 'Lettre' })
  })
})
