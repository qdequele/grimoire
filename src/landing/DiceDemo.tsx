import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DiceTray } from '@/companion/dice3d/DiceTray'
import { checkDice } from '@/companion/dice3d/dice'
import { LEVEL_LABEL, netLabel } from '@/companion/rolls'
import { rollPercentile, successLevel, type PercentileRoll } from '@/engine/dice'
import { skillName, useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { Chip } from './parts'

const DEMO_SKILLS = [
  { id: 'spot-hidden', value: 55 },
  { id: 'library-use', value: 60 },
  { id: 'stealth', value: 35 },
]
const DEMO_POINTS: [string, string][] = [['PV', '11'], ['SAN', '62'], ['Chance', '45'], ['PM', '12']]
const NETS = [-2, -1, 0, 1, 2]

/**
 * A player's phone, cut down: a few skills and bonus/penalty dice; a tap rolls a d100 with the
 * phones' 3D dice (a tens die per bonus or penalty die, the unkept ones fade), then the level shows.
 */
export function DiceDemo() {
  const t = useT()
  const [skill, setSkill] = useState(DEMO_SKILLS[0])
  const [net, setNet] = useState(0)
  const [roll, setRoll] = useState<{ key: string; r: PercentileRoll; value: number } | null>(null)
  const [shown, setShown] = useState<string | null>(null)

  function throwDice(s = skill) {
    setSkill(s)
    setShown(null)
    setRoll({ key: crypto.randomUUID(), r: rollPercentile(Math.max(0, net), Math.max(0, -net)), value: s.value })
  }

  const dice = roll
    ? checkDice(roll.r.tens.length, { tens: roll.r.tens, units: roll.r.units, kept: roll.r.keptIndex })
    : checkDice(1 + Math.abs(net), null)
  const result = roll && shown === roll.key ? roll.r.result : null
  const level = roll && result !== null ? successLevel(result, roll.value) : null

  return (
    <div className="mx-auto w-full max-w-[19rem] rounded-[2.25rem] border border-gold/50 bg-black/60 p-2.5 shadow-[0_0_60px_-20px] shadow-gold/30">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-border bg-card px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full border border-gold/60 font-heading text-lg text-gold">IV</span>
          <div className="flex flex-col">
            <span className="font-heading text-xl leading-tight">Iris Vautrin</span>
            <span className="text-xs text-muted-foreground">{t('Photographe')}</span>
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-1.5 text-center">
          {DEMO_POINTS.map(([label, value]) => (
            <div key={label} className="flex flex-col border border-border py-1.5">
              <dt className="text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">{t(label)}</dt>
              <dd className="font-mono text-lg text-gold">{value}</dd>
            </div>
          ))}
        </dl>
        <ul className="flex flex-col">
          {DEMO_SKILLS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => throwDice(s)}
                className={cn(
                  'flex w-full items-baseline justify-between border-b border-border py-2 text-left text-sm hover:text-gold',
                  s.id === skill.id && 'text-gold',
                )}
              >
                <span>{skillName(t, s.id)}</span>
                <span className="font-mono">{s.value}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">{t('Dés bonus ou de pénalité')}</span>
          <div className="flex justify-between gap-1" role="group" aria-label={t('Dés bonus ou de pénalité')}>
            {NETS.map((n) => (
              <Chip key={n} on={net === n} onClick={() => setNet(n)} label={netLabel(t, n) || t('Aucun')}>
                {n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0'}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex min-h-36 flex-col items-center justify-center gap-1">
          {roll ? (
            <DiceTray dice={dice} throwKey={roll.key} onSettled={setShown} maxSize={56} />
          ) : (
            <p className="px-4 text-center text-sm text-muted-foreground">{t('Touche une compétence pour lancer les dés.')}</p>
          )}
          <p className="min-h-6 text-center text-sm" aria-live="polite">
            {level && (
              <>
                <span className="font-mono text-gold">{result}</span>
                {' — '}
                <span className={cn(level === 'failure' ? 'text-destructive' : 'text-gold')}>{t(LEVEL_LABEL[level])}</span>
              </>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => throwDice()}>
          {t('Lancer 1D100')}
        </Button>
      </div>
    </div>
  )
}
