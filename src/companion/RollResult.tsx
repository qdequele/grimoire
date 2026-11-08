// A roll's pieces shared by the phones' Dés tab and roll dialog and the free dice roller page: the
// stepper, the result (big number, level, dice), and the throw-then-reveal timing. No server here.
import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { diceDetail, keptTens, LEVEL_LABEL, type CheckRoll, type DiceRoll, type Roll } from './rolls'

/** − value + : a small stepper. */
export function Stepper({ label, value, text, min, max, onChange }: {
  label: string
  value: number
  text: string
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const t = useT()
  return (
    <div className="flex items-center justify-between gap-2 border border-border bg-card px-1">
      <Button variant="ghost" size="icon-lg" className="text-gold" aria-label={t('Moins : {label}', { label })} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus />
      </Button>
      <output aria-label={label} className="text-center text-sm">{text}</output>
      <Button variant="ghost" size="icon-lg" className="text-gold" aria-label={t('Plus : {label}', { label })} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus />
      </Button>
    </div>
  )
}

const levelClass = (r: CheckRoll) =>
  r.level === 'failure' ? 'text-destructive' : r.level === 'regular' ? 'text-foreground' : 'text-gold'

/** One roll's result: the big number, how it reads, the dice. */
export function RollResult({ roll, compact }: { roll: Roll; compact?: boolean }) {
  const t = useT()
  if (roll.kind === 'dice') return <DiceResult roll={roll} compact={compact} />
  const kept = keptTens(roll)
  return (
    <div data-testid="roll-result" className={cn('flex flex-col items-center gap-1 text-center', !compact && 'animate-in fade-in-0 zoom-in-95')}>
      <output className={cn('font-heading leading-none', compact ? 'text-2xl' : 'text-6xl', levelClass(roll))}>{roll.result}</output>
      <p className={cn('font-semibold tracking-[0.14em] uppercase', compact ? 'text-[0.625rem]' : 'text-xs', levelClass(roll))}>
        {t(LEVEL_LABEL[roll.level])}
      </p>
      {!compact && (
        <p className="font-mono text-xs text-muted-foreground">
          {t('dizaines')}{' '}
          {roll.tens.map((d, i) => (
            <span key={i} className={cn(roll.tens.length > 1 && i === kept && 'text-gold underline underline-offset-2', roll.tens.length > 1 && i !== kept && 'line-through')}>
              {i > 0 && ' · '}{d}0
            </span>
          ))}
          {' — '}{t('unités')} {roll.units}
        </p>
      )}
    </div>
  )
}

function DiceResult({ roll, compact }: { roll: DiceRoll; compact?: boolean }) {
  return (
    <div data-testid="roll-result" className={cn('flex flex-col items-center gap-1 text-center', !compact && 'animate-in fade-in-0 zoom-in-95')}>
      <output className={cn('font-heading leading-none text-gold', compact ? 'text-2xl' : 'text-6xl')}>{roll.result}</output>
      {(roll.results.length > 1 || roll.modifier !== 0) && (
        <p className="font-mono text-xs text-muted-foreground">{diceDetail(roll)}</p>
      )}
    </div>
  )
}

/**
 * A roll being thrown on this phone: the dice tumble before the result shows. `fresh` is the roll just
 * received (thrown once); older rolls, like the last one when the Dés tab opens again, show at once.
 */
export function useThrow() {
  const [fresh, setFresh] = useState<string | null>(null)
  const [settled, setSettled] = useState<string | null>(null)
  return {
    fresh,
    received: (r: Roll) => setFresh(r.id),
    onSettled: setSettled,
    revealed: (r: Roll | null | undefined, pending: boolean): r is Roll => !!r && !pending && (r.id !== fresh || settled === r.id),
  }
}
