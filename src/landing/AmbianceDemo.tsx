import { useState } from 'react'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { PLACE_LABEL, type PlaceId } from '@/screen/ambiance'
import { Stage } from '@/screen/Stage'
import type { ScreenScene } from '@/screen/state'

const DEMO_PLACES: { place: PlaceId; scene: Omit<ScreenScene, 'place' | 'image' | 'sounds'> }[] = [
  { place: 'harbour', scene: { preset: 'fog', time: 'night' } },
  { place: 'church', scene: { preset: 'storm', time: 'night' } },
  { place: 'forest', scene: { preset: 'night', time: 'dusk' } },
  { place: 'street', scene: { preset: 'rain', time: 'night' } },
]

/** The ambiance screen as it shows on the table's TV: a drawn décor, live, with a few places to pick. */
export function AmbianceDemo() {
  const t = useT()
  const [i, setI] = useState(0)
  const { place, scene } = DEMO_PLACES[i]
  return (
    <figure className="flex flex-col gap-3">
      <div className="border border-gold/60 p-1.5">
        <div className="relative aspect-video overflow-hidden bg-black">
          {/* The décor's own root is full screen (position: fixed): kept inside the frame here. */}
          <div className="scr-root" style={{ position: 'absolute' }}>
            <Stage scene={{ ...scene, place, image: null, sounds: [] }} handout={null} />
          </div>
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{t("L'écran d'ambiance, en direct")}</span>
        <span className="flex flex-wrap gap-1" role="group" aria-label={t('Décor')}>
          {DEMO_PLACES.map((d, j) => (
            <button
              key={d.place}
              type="button"
              aria-pressed={i === j}
              onClick={() => setI(j)}
              className={cn(
                'px-2 py-1 text-xs tracking-[0.14em] uppercase hover:text-gold',
                i === j ? 'text-gold underline underline-offset-4' : 'text-muted-foreground',
              )}
            >
              {t(PLACE_LABEL[d.place])}
            </button>
          ))}
        </span>
      </figcaption>
    </figure>
  )
}
