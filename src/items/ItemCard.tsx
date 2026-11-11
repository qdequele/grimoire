// An item as a collectible card: name and damage on top, the illustration in its window, the item's
// type, its attack or ability, rules text, uses left as pips, rarity and number at the bottom. Sized
// by its container (container query units), so the same card fits a phone, a grid or a dialog.
import { skillName, useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { catalogNumber } from './catalog'
import { artOf, KIND_LABEL, type ItemCard as Card, type ItemSource } from './item'
import { ItemArt } from './ItemArt'
import { damageText, localCard, usesText } from './text'
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
}

export function ItemCard({ card: raw, uses, source, className, as: H = 'h3' }: ItemCardProps) {
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

  return (
    <article className={cn('icard', empty && 'is-empty', className)} data-kind={card.kind} aria-label={card.name}>
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
          <ItemArt art={artOf(card)} className="icard-art" />
        </div>
        <p className="icard-strip">{strip}</p>
        <div className="icard-body">
          {w && (
            <div className="icard-move">
              <span className="icard-cost" aria-hidden="true" />
              <span className="icard-move-name">{skillName(t, w.skill)}</span>
              <span className="icard-move-val">{damageText(t, w)}</span>
            </div>
          )}
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
              {w.malfunction && (
                <div>
                  <dt>{t('Panne')}</dt>
                  <dd>{w.malfunction}</dd>
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
