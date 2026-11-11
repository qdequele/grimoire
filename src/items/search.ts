// Searching the item catalogue: "revolver", "lumiere" (light), "grimper" (the rope helps with Climb),
// ".38". Accents and case don't matter, every word typed must match somewhere, and the card's name
// counts most. Texts are searched in the reader's language and in the catalogue's French, so a keeper
// finds "Corde" or "rope" whatever their setting.
import { skillName, type T } from '@/i18n/t'
import { CATALOG, type CatalogItem } from './catalog'
import { KIND_LABEL, unitOf, type ItemCard, type ItemKind, type ItemSource } from './item'
import { localCard } from './text'

/** Lower case, without accents or punctuation runs: "Lanterne à pétrole" → "lanterne a petrole". */
export const fold = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, ' ').trim()

/** Every searchable text of a card, folded: name (both languages), text, type, skills, calibre, unit. */
export function haystack(t: T, card: ItemCard, source?: ItemSource): { name: string; all: string } {
  const local = localCard(t, card, source)
  const skills = [card.weapon?.skill, card.bonus?.skill].filter((s): s is string => !!s).map((s) => skillName(t, s))
  const name = fold(`${local.name} ${card.name}`)
  const all = fold([
    local.name, card.name, local.text ?? '', card.text ?? '', t(KIND_LABEL[card.kind]), KIND_LABEL[card.kind],
    ...skills, local.bonus?.note ?? '', card.ammo ?? '', card.uses !== undefined ? t(unitOf(card)) : '',
  ].join(' '))
  return { name, all }
}

/** 0 when the query doesn't match; higher is better (every word in the name first). */
export function score(query: string, hay: { name: string; all: string }): number {
  const words = fold(query).split(' ').filter(Boolean)
  if (!words.length) return 1
  let s = 0
  for (const w of words) {
    if (!hay.all.includes(w)) return 0
    s += hay.name.split(' ').some((x) => x.startsWith(w)) ? 3 : hay.name.includes(w) ? 2 : 1
  }
  return s
}

/** The catalogue cards matching a query (and a kind), best first, else in catalogue order. */
export function searchCatalog(t: T, query: string, kind?: ItemKind): CatalogItem[] {
  return CATALOG
    .filter((c) => !kind || c.card.kind === kind)
    .map((c, i) => ({ c, i, s: score(query, haystack(t, c.card, { kind: 'catalog', id: c.id })) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c)
}
