import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'

// Building blocks of the landing page, in the legacy look (eyebrows, diamond bullets, gold rules).

/** A link that looks like a button (a Button rendering a Link would be announced as a button).
 *  data-slot: the Art Deco skin styles buttons through it. */
export function LinkButton({ to, variant, size, children }: { to: string; variant?: 'outline' | 'ghost'; size?: 'sm' | 'lg'; children: ReactNode }) {
  return <Link to={to} data-slot="button" className={buttonVariants({ variant, size })}>{children}</Link>
}

export function SectionTitle({ eyebrow, title, id }: { eyebrow: string; title: string; id?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="scroll-mt-28 font-heading text-4xl leading-tight text-balance sm:text-5xl">{title}</h2>
      <span className="deco-rule" aria-hidden="true" />
    </div>
  )
}

/** Diamond-bullet heading + text, like the legacy menu entries. */
export function Feature({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-2">
      <h3 className="flex items-baseline gap-3 font-heading text-2xl leading-tight">
        <span aria-hidden="true" className="diamond" />
        {title}
      </h3>
      <p className="pl-5 font-serif text-lg leading-relaxed text-muted-foreground">{children}</p>
    </li>
  )
}

/** Short diamond-bullet list under a showcase's text. */
export function Points({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex items-baseline gap-3 text-sm leading-relaxed">
          <span aria-hidden="true" className="diamond" />
          {item}
        </li>
      ))}
    </ul>
  )
}

/** One feature with its live demo: text on one side, demo on the other (`flip` swaps them on wide screens). */
export function Showcase({ id, eyebrow, title, text, points, demo, flip }: {
  id: string
  eyebrow: string
  title: string
  text: string
  points?: string[]
  demo: ReactNode
  flip?: boolean
}) {
  return (
    <section aria-labelledby={id} className="grid scroll-mt-24 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cn('flex flex-col gap-6', flip && 'lg:order-2')}>
        <SectionTitle id={id} eyebrow={eyebrow} title={title} />
        <p className="font-serif text-lg leading-relaxed text-muted-foreground">{text}</p>
        {points && <Points items={points} />}
      </div>
      <div className={cn(flip && 'lg:order-1')}>{demo}</div>
    </section>
  )
}

/** A demo's card: a panel of the app, with "Essaie" and what to do. */
export function DemoCard({ label, hint, children, className }: { label: string; hint: string; children: ReactNode; className?: string }) {
  const t = useT()
  return (
    <div className={cn('flex flex-col gap-4 border border-border bg-card p-4 sm:p-5', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="eyebrow">{label}</span>
        <span className="text-xs text-muted-foreground">{t('Essaie : {hint}', { hint })}</span>
      </div>
      {children}
    </div>
  )
}

/** A small uppercase button inside a demo (choices, targets). */
export function Chip({ on, onClick, children, label }: { on?: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'border px-2.5 py-1 text-xs tracking-[0.1em] uppercase transition-colors hover:text-gold',
        on ? 'border-gold/70 text-gold' : 'border-border text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}
