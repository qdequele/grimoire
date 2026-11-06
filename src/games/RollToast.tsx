// A player's roll, as the keeper sees it over the game screen: big, at the top, in the skin's colours
// (sonner's default card in a corner was too easy to miss during a game). It also goes to the Journal.
import { XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { diceDetail, LEVEL_LABEL, netLabel, rollMessage, type Roll } from '@/companion/rolls'
import { cn } from '@/lib/utils'
import type { T } from '@/i18n/t'

/** Shown until closed by hand, or after this long (paused while the pointer is over it). */
const DURATION = 30_000

export function showRollToast(t: T, roll: Roll, name: string) {
  const { title } = rollMessage(t, roll, name)
  const failed = roll.kind === 'check' && roll.level === 'failure'
  const extra = roll.kind === 'check' ? netLabel(t, roll.net) : ''
  const detail =
    roll.kind === 'check'
      ? [t(LEVEL_LABEL[roll.level]), extra].filter(Boolean).join(' · ')
      : roll.results.length > 1 || roll.modifier ? diceDetail(roll) : ''

  toast.custom(
    (id) => (
      <div
        role="status"
        className="flex w-[min(26rem,calc(100vw-2rem))] items-center gap-4 border border-gold bg-card px-4 py-3 text-card-foreground shadow-2xl outline outline-1 outline-offset-[3px] outline-gold/40"
      >
        <output
          className={cn('min-w-[2ch] text-center font-heading text-4xl leading-none tabular-nums', failed ? 'text-destructive' : 'text-gold')}
        >
          {roll.result}
        </output>
        <div className="min-w-0 flex-1">
          <p className="eyebrow truncate">{title}</p>
          {detail && <p className={cn('mt-1 font-serif text-lg leading-tight', failed && 'text-destructive')}>{detail}</p>}
        </div>
        <button
          type="button"
          aria-label={t('Fermer')}
          className="self-start text-muted-foreground hover:text-foreground"
          onClick={() => toast.dismiss(id)}
        >
          <XIcon className="size-4" />
        </button>
      </div>
    ),
    { duration: DURATION, position: 'top-center' },
  )
}
