// An item as a collectible card: name and damage on top, the illustration in its window, the item's
// type, its attack or ability, rules text, uses left as pips, rarity and number at the bottom. Sized
// by its container (container query units), so the same card fits a phone, a grid or a dialog.
import { useState } from 'react'
import { skillName, useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { catalogNumber } from './catalog'
import { artOf, CONDITION_LABEL, conditionEffects, KIND_LABEL, type Condition, type ItemCard as Card, type ItemSource } from './item'
import { ItemArt } from './ItemArt'
import { pictureOf } from './pictures'
import { conditionDamageText, conditionNotes, localCard, usesText } from './text'
import './items.css'

function Pips({ card, uses }: { card: Card; uses: number }) {
  const max = card.uses ?? 0
  if (max > 12) {
    return (
      <span className="icard-bar" aria-hidden="true">
        <span style={{ width: `${(uses / max) * 100}%` }} />
      </span>
    )
  }
  const shape = card.kind === 'weapon' || card.kind === 'ammo' ? 'round' : 'dot'
  return (
    <span className="icard-pips" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cn('icard-pip', shape === 'round' && 'is-round', i < uses && 'is-full')} />
      ))}
    </span>
  )
}

export interface ItemCardProps {
  card: Card
  /** Uses left (null or absent: a full card, as in the catalogue). */
  uses?: number | null
  source?: ItemSource
  className?: string
  /** Heading level of the name (h3 in lists). */
  as?: 'h2' | 'h3' | 'h4'
  /**
   * A picture file instead of the card's own (the dev comparison page). By default a catalogue card
   * shows its picture (pictures.ts), any other its line drawing; `null` forces the line drawing.
   */
  artSrc?: string | null
  /** A held weapon's condition: a stamp on the picture, and the stats it changes. */
  condition?: Condition
}

export function ItemCard({ card: raw, uses, source, className, as: H = 'h3', artSrc, condition: rawCondition = 'clean' }: ItemCardProps) {
  const t = useT()
  const card = localCard(t, raw, source)
  const left = uses ?? card.uses
  const w = card.weapon
  const number = source?.kind === 'catalog' ? catalogNumber(source.id) : null
  const origin = number ?? (source?.kind === 'story' ? t('Histoire') : source?.kind === 'keeper' ? t('Gardien') : '')
  const strip = [
    t(KIND_LABEL[card.kind]),
    card.ammo && (card.kind === 'ammo' || card.kind === 'weapon') ? t('calibre {ammo}', { ammo: card.ammo }) : '',
  ].filter(Boolean).join(' · ')
  const empty = left === 0
  const picture = artSrc === null ? undefined : (artSrc ?? pictureOf(source))
  // A picture that fails to load falls back to the line drawing.
  const [broken, setBroken] = useState<string | null>(null)
  const condition = w ? rawCondition : 'clean'
  const effects = conditionEffects(card, condition)
  const notes = condition === 'clean' ? [] : conditionNotes(t, card, condition)
  const conditionText = condition === 'clean' ? '' : `${t(CONDITION_LABEL[condition])} : ${notes.join(' · ')}`

  return (
    <article
      className={cn('icard', empty && 'is-empty', className)}
      data-kind={card.kind}
      data-condition={condition === 'clean' ? undefined : condition}
      aria-label={card.name}
      aria-description={conditionText || undefined}
    >
      <div className="icard-frame">
        <header className="icard-head">
          <span className="icard-gem" aria-hidden="true" />
          <H className={cn('icard-name', card.name.length > 26 ? 'is-longer' : card.name.length > 16 && 'is-long')}>{card.name}</H>
          {w ? (
            <span className="icard-hp">
              <small>{t('Dég.')}</small>
              {/* Damage by range band ("4D6/2D6/1D6"): the closest one here, all of them below. */}
              {w.damage.split('/')[0]}
            </span>
          ) : null}
        </header>
        <div className="icard-window">
          {picture && broken !== picture ? (
            <img src={picture} alt="" className="icard-art icard-picture" loading="lazy" decoding="async" onError={() => setBroken(picture)} />
          ) : (
            <ItemArt art={artOf(card)} className="icard-art" />
          )}
          {condition !== 'clean' && (
            <>
              <span className="icard-wear" aria-hidden="true" />
              <span className="icard-stamp">{t(CONDITION_LABEL[condition])}</span>
            </>
          )}
        </div>
        <p className="icard-strip">{strip}</p>
        <div className="icard-body">
          {w && (
            <div className="icard-move">
              <span className="icard-cost" aria-hidden="true" />
              <span className="icard-move-name">{skillName(t, w.skill)}</span>
              <span className={cn('icard-move-val', (effects.minus || effects.half) && 'is-worse')}>
                {effects.broken ? '—' : conditionDamageText(t, w, card, condition)}
              </span>
            </div>
          )}
          {notes.length > 0 && <p className="icard-condition">{notes.join(' · ')}</p>}
          {w && (w.range || w.rate || w.malfunction) && (
            <dl className="icard-stats">
              {w.range && (
                <div>
                  <dt>{t('Portée')}</dt>
                  <dd>{w.range}</dd>
                </div>
              )}
              {w.rate && (
                <div>
                  <dt>{t('Attaques')}</dt>
                  <dd>{w.rate}</dd>
                </div>
              )}
              {(effects.malfunction ?? w.malfunction) && (
                <div>
                  <dt>{t('Panne')}</dt>
                  <dd className={cn(effects.malfunction !== w.malfunction && 'is-worse')}>{effects.malfunction ?? w.malfunction}</dd>
                </div>
              )}
            </dl>
          )}
          {card.bonus && (
            <div className="icard-move is-bonus">
              <span className="icard-cost" aria-hidden="true" />
              <span className="icard-move-name">{skillName(t, card.bonus.skill)}</span>
              {card.bonus.note && <span className="icard-move-note">{card.bonus.note}</span>}
            </div>
          )}
          {card.text && <p className="icard-text">{card.text}</p>}
        </div>
        {card.uses !== undefined && left != null && (
          <div className="icard-uses">
            <Pips card={card} uses={left} />
            <span className="icard-uses-n">{empty ? t('Épuisé') : `${left}/${card.uses}`}</span>
          </div>
        )}
        <footer className="icard-foot">
          <span className="icard-rarity" aria-label={card.rarity ? t('Rareté {n} sur 3', { n: card.rarity }) : undefined}>
            {Array.from({ length: card.rarity ?? 0 }, (_, i) => (
              <span key={i} className="diamond" />
            ))}
          </span>
          <span className="icard-no">{origin}</span>
        </footer>
      </div>
      {card.uses !== undefined && left != null && <span className="sr-only">{usesText(t, card, left)}</span>}
    </article>
  )
}
