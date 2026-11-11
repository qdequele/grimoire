// Documents as cards: a story's letters, diaries and plans given to an investigator, and the
// catalogue's paper templates the keeper fills in. A document card carries its whole text
// (ItemCard.document), read on paper (DocumentReader); the card face shows its first lines.
import { ITEM_LIMITS, type ItemCard } from './item'

/** The text without its rich-text marks, on one line: for the card face and search. */
export function plainText(doc: string): string {
  return doc
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*([^*\s][^*]*?)\*/g, '$1')
    .replace(/\[\[[\w-]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([\w-]+)\]\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The first words of a document, cut at a word: "Night one. Lamp out at sundown…". */
export function excerpt(doc: string, max = 160): string {
  const s = plainText(doc)
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[\s.,;:!?—-]+$/, '')}…`
}

export interface StoryDocument {
  id: string
  title: string
  text?: string
  image?: string
}

/** What a story's references are called, to write them out in a document that leaves the story. */
export interface StoryNames {
  scene: Map<string, string>
  npc: Map<string, string>
  handout: Map<string, string>
}

/**
 * A story document as a card. Its references ({{npc:id}}, [[scene|label]], {{handout:id}}) become plain
 * names, since the card outlives the story; bold, italics and line breaks stay. Too long a text is cut
 * at the card's limit with an ellipsis. Pictures stay with the keeper (phones can't read the story's files).
 */
export function documentCard(h: StoryDocument, names: StoryNames): ItemCard {
  const resolved = (h.text ?? '')
    .replace(/\{\{(npc|handout):([\w-]+)\}\}/g, (_m, kind: 'npc' | 'handout', id: string) => names[kind].get(id) ?? id)
    .replace(/\[\[([\w-]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([\w-]+)\]\]/g, (_m, id: string) => names.scene.get(id) ?? id)
    .trim()
  const document = resolved.length > ITEM_LIMITS.document ? `${resolved.slice(0, ITEM_LIMITS.document - 1)}…` : resolved
  const name = h.title.replace(/[<>&"]/g, '').trim().slice(0, ITEM_LIMITS.name) || '?'
  const art = /\b(plan|carte|map|croquis|sketch)\b/i.test(h.title) ? 'map' : 'notebook'
  return { name, kind: 'document', art, ...(document ? { document } : {}) }
}

/** The id a story document has among the story's items (character_items.story_item). */
export const documentItemId = (handoutId: string) => `handout:${handoutId}`
