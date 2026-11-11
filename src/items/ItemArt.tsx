import { ARTS, type ArtId, type Mat, type Shape } from './arts'

const fillOf = (m: Mat) => `var(--ia-${m})`

/** An item's illustration (arts.ts), in the materials of the current skin (items.css). */
export function ItemArt({ art, className }: { art: ArtId; className?: string }) {
  const shapes: Shape[] = ARTS[art] ?? ARTS.backpack
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" strokeLinejoin="round" strokeLinecap="round">
      {shapes.map((s, i) =>
        s.f ? (
          <path key={i} d={s.d} fill={fillOf(s.f)} stroke="var(--ia-line)" strokeWidth={s.sw ?? 2} fillRule={s.eo ? 'evenodd' : undefined} />
        ) : (
          <path key={i} d={s.d} fill="none" stroke={fillOf(s.s ?? 'line')} strokeWidth={s.sw ?? 2} strokeDasharray={s.dash ? '4 3' : undefined} />
        ),
      )}
    </svg>
  )
}
