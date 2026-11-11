// Cards in words: catalogue texts in the reader's language, uses ("3 balles"), damage, and the
// messages of the new-card form. Story and keeper texts stay as written.
import type { T } from '@/i18n/t'
import { UNIT_ONE, unitOf, type ItemCard as Card, type ItemSource } from './item'

/** A short stat ("contact", "1 ou 2") translated; numbers alone ("15 m", "1 (3)") stay as they are. */
const words = (t: T, s: string) => (/\p{L}{2,}/u.test(s) ? t(s) : s)

/** The card in the reader's language: catalogue texts are translated; story and keeper texts stay as written. */
export function localCard(t: T, card: Card, source?: ItemSource): Card {
  if (source?.kind !== 'catalog') return card
  return {
    ...card,
    name: t(card.name),
    text: card.text && t(card.text),
    bonus: card.bonus && { ...card.bonus, note: card.bonus.note && t(card.bonus.note) },
    weapon: card.weapon && {
      ...card.weapon,
      range: card.weapon.range && words(t, card.weapon.range),
      rate: card.weapon.rate && words(t, card.weapon.rate),
    },
  }
}

/** "3 balles", "1 balle". */
export const usesText = (t: T, card: Card, n: number) => {
  const unit = unitOf(card)
  return t.n(n, `{n} ${UNIT_ONE[unit]}`, `{n} ${unit}`)
}

/** Damage as printed: "1D6 + Impact" for melee weapons. */
export const damageText = (t: T, w: NonNullable<Card['weapon']>) => (w.db ? `${w.damage} + ${t('Impact')}` : w.damage)

/** What draftCard asks the keeper to fix (translated where shown). */
export const DRAFT_PROBLEMS = [
  'Donne un nom à l’objet.',
  'Le nom ne peut pas contenir < > & ou ".',
  'Indique les dégâts de l’arme, par exemple 1D6 ou 2D6+4.',
  'Vérifie les valeurs de la carte.',
] as const
