import { useT } from '@/i18n/t'
import { SKIN_LABEL, useSkin } from './skin'

/** Fan ornament above the title in the Art Deco skin (an original drawing in the legacy style). */
function Fan({ width = 110 }: { width?: number }) {
  return (
    <svg viewBox="0 0 120 60" width={width} height={width / 2} aria-hidden="true" className="text-gold">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M2 58a58 58 0 0 1 116 0" />
        <path d="M18 58a42 42 0 0 1 84 0" />
        <path d="M34 58a26 26 0 0 1 52 0" />
        <path d="M60 58V2M60 58 19 17M60 58l41-41M60 58 4 40M60 58l56-18" opacity=".7" />
      </g>
    </svg>
  )
}

/**
 * The big title block of the legacy home screen: eyebrow, ornament, title, italic subtitle.
 * `compact`: a small centred version for phone screens (player companion).
 */
export function Masthead({ eyebrow, title, subtitle, compact }: { eyebrow: string; title: string; subtitle?: string; compact?: boolean }) {
  const skin = useSkin((s) => s.skin)
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1.5 text-center">
        {skin === 'deco' && <Fan width={64} />}
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-heading text-4xl leading-tight text-balance">{title}</h1>
        {subtitle && <p className="font-serif text-lg text-muted-foreground italic">{subtitle}</p>}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="eyebrow">{eyebrow}</p>
      {skin === 'deco' && <Fan />}
      <h1 className="font-heading text-6xl leading-none text-balance sm:text-7xl">{title}</h1>
      {subtitle && <p className="font-serif text-lg text-muted-foreground italic">{subtitle}</p>}
    </div>
  )
}

/** Quote column of the legacy home screen: display font, gold rule on the left. */
export function Epigraph({ quote, note }: { quote: string; note?: string }) {
  const t = useT()
  return (
    <blockquote className="flex flex-col gap-3 border-l border-gold/60 pl-5">
      <p className="font-heading text-2xl leading-snug text-balance">{t('« {quote} »', { quote })}</p>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </blockquote>
  )
}

/** "Thème : Art déco" link, uppercase and underlined like the legacy home. */
export function SkinToggle() {
  const t = useT()
  const { skin, toggle } = useSkin()
  return (
    <button
      type="button"
      onClick={toggle}
      className="w-fit text-xs tracking-[0.2em] text-muted-foreground uppercase underline underline-offset-4 hover:text-foreground"
    >
      {t('Thème : {skin}', { skin: t(SKIN_LABEL[skin]) })}
    </button>
  )
}
