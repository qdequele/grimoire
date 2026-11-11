// A card picked up from a grid and shown big: it flies from where it was to the centre, turning over
// once (its back shows half way), then tilts under the pointer with a glare (and a holographic sheen
// for rare cards), like holding a collectible card to the light. Closing flies it back.
// Built on the dialog primitives (focus trap, Escape, labelled); with prefers-reduced-motion it only fades.
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { useCallback, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/t'
import type { ItemCard as Card, ItemSource } from './item'
import { ItemCard } from './ItemCard'
import { localCard } from './text'

export interface ViewedCard {
  key: string
  card: Card
  source?: ItemSource
  uses?: number | null
  /** Where the card was on screen when picked up (it flies from there, and back). */
  from?: DOMRect
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** The back of every card: Art Deco fans and a diamond, or Classic's ornament (items.css). */
export function CardBack() {
  return (
    <div className="icard-back" aria-hidden="true">
      <div className="icard-back-frame">
        <span className="icard-back-gem" />
        <span className="icard-back-name">Grimoire</span>
      </div>
    </div>
  )
}

/** Transform that puts the element's box over `from`. */
function fromTransform(el: HTMLElement, from: DOMRect, turn: string): string {
  const to = el.getBoundingClientRect()
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  return `translate(${dx}px, ${dy}px) scale(${from.width / to.width}) rotateY(${turn})`
}

export function CardViewer({ viewed, onClose, origin, children }: {
  viewed: ViewedCard | null
  onClose: () => void
  /** Where the card with this key is on screen now (it may have scrolled); `viewed.from` otherwise. */
  origin?: (key: string) => DOMRect | undefined
  children?: ReactNode
}) {
  const t = useT()
  const fly = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState<CSSProperties>({})
  const closing = useRef(false)
  // The latest card (a new object each render), read when the card's element mounts: set during
  // render, because the dialog can mount its content in the same commit that opens it.
  const latest = useRef(viewed)
  // eslint-disable-next-line react-hooks/refs -- read only from the ref callback and close(), after render
  latest.current = viewed
  const originRef = useRef(origin)
  // eslint-disable-next-line react-hooks/refs -- same: read after render
  originRef.current = origin
  const fromNow = () => {
    const v = latest.current
    return v ? (originRef.current?.(v.key) ?? v.from) : undefined
  }

  // Fly in: from the grid to the centre, one full turn. The dialog mounts its content a moment after
  // it opens, so this starts when the card's element appears (a callback ref), once per opening.
  const flyRef = useCallback((el: HTMLDivElement | null) => {
    fly.current = el
    if (!el) return
    closing.current = false
    setTilt({})
    const from = fromNow()
    if (!from || reducedMotion() || typeof el.animate !== 'function') return
    el.animate([{ transform: fromTransform(el, from, '0deg') }, { transform: 'translate(0, 0) scale(1) rotateY(360deg)' }], {
      duration: 750,
      easing: 'cubic-bezier(0.2, 0.75, 0.2, 1)',
    })
  }, [])

  // Fly back, then close (at once without motion, or when the card left the screen).
  const close = useCallback(() => {
    const el = fly.current
    if (closing.current) return
    closing.current = true
    const from = fromNow()
    if (!el || reducedMotion() || !from || typeof el.animate !== 'function') return onClose()
    setTilt({})
    const a = el.animate([{ transform: 'translate(0, 0) scale(1) rotateY(0deg)' }, { transform: fromTransform(el, from, '0deg') }], {
      duration: 320,
      easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
      fill: 'forwards',
    })
    // Close when the flight ends, or anyway shortly after: a background tab doesn't run animations.
    let done = false
    const finish = () => {
      if (done) return
      done = true
      onClose()
    }
    a.onfinish = finish
    setTimeout(finish, 450)
  }, [onClose])

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion() || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    setTilt({ '--ry': `${(x - 0.5) * 22}deg`, '--rx': `${(0.5 - y) * 18}deg`, '--gx': `${x * 100}%`, '--gy': `${y * 100}%`, '--glare': '1' } as CSSProperties)
  }

  const name = viewed ? localCard(t, viewed.card, viewed.source).name : ''
  return (
    <DialogPrimitive.Root open={!!viewed} onOpenChange={(open) => !open && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="iview-backdrop" />
        <DialogPrimitive.Popup className="iview" data-rarity={viewed?.card.rarity ?? 1}>
          <DialogPrimitive.Title className="sr-only">{name}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{t('Carte d’objet')}</DialogPrimitive.Description>
          <div className="iview-stage" onPointerMove={onMove} onPointerLeave={() => setTilt({})} onClick={(e) => e.target === e.currentTarget && close()}>
            <div ref={flyRef} className="iview-fly">
              <div className="iview-tilt" style={tilt}>
                <div className="iview-face">
                  {viewed && <ItemCard card={viewed.card} source={viewed.source} uses={viewed.uses} as="h2" />}
                  <span className="iview-glare" aria-hidden="true" />
                  <span className="iview-holo" aria-hidden="true" />
                </div>
                <div className="iview-face is-back">
                  <CardBack />
                </div>
              </div>
            </div>
          </div>
          {children && <div className="iview-side">{children}</div>}
          <Button variant="outline" size="icon" className="iview-close" onClick={close} aria-label={t('Fermer')}>
            <X />
          </Button>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
