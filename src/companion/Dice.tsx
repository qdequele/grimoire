import { Dices } from 'lucide-react'
import { useState } from 'react'
import { create } from 'zustand'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { useRollCheck, useRollDice } from './api'
import { checkDice, freeDice } from './dice3d/dice'
import { DiceTray } from './dice3d/DiceTray'
import { RollResult, Stepper, useThrow } from './RollResult'
import {
  DICE_SIDES, diceFormula, keptTens, LEVEL_LABEL, MAX_DICE, MAX_MODIFIER, MAX_NET, netLabel, subjectName,
  type Roll, type RollSubject,
} from './rolls'
import { useSheetContext } from './SheetPage'

// ------------------------------------------------------------------ this phone's rolls

const HISTORY = 20

/** The rolls made on this phone since the page opened, per investigator, newest first. */
const useRollHistory = create<{ rolls: Record<string, Roll[]>; add: (r: Roll) => void }>((set) => ({
  rolls: {},
  add: (r) => set((s) => ({ rolls: { ...s.rolls, [r.characterId]: [r, ...(s.rolls[r.characterId] ?? [])].slice(0, HISTORY) } })),
}))


// ------------------------------------------------------------------ d100 check

export interface RollTarget {
  subject: RollSubject
  /** Display name. */
  title: string
  /** What it is for, already translated. */
  what: string
  value: number
}

/**
 * Tapping a skill, a characteristic, SAN or Luck: what it is for, the thresholds, and a d100 roll
 * (with bonus or penalty dice) made by the server. The keeper's game screen shows the result too.
 */
export function RollDialog({ target, onClose }: { target: RollTarget | null; onClose: () => void }) {
  const t = useT()
  const { token, member } = useSheetContext()
  const roll = useRollCheck(token)
  const add = useRollHistory((s) => s.add)
  const [net, setNet] = useState(0)
  const [last, setLast] = useState<Roll | null>(null)
  const throwing = useThrow()
  // Keep showing the last target while the dialog closes.
  const [shown, setShown] = useState(target)
  if (target && target !== shown) {
    setShown(target)
    setNet(0)
    setLast(null)
  }
  const v = shown?.value ?? 0

  const go = () => {
    if (!shown) return
    roll.mutate(
      { characterId: member.id, subject: shown.subject, target: shown.value, net },
      { onSuccess: (r) => { setLast(r); throwing.received(r); add(r) } },
    )
  }
  const pending = roll.isPending
  const dice = pending
    ? checkDice(1 + Math.abs(net), null)
    : last?.kind === 'check' ? checkDice(last.tens.length, { tens: last.tens, units: last.units, kept: keptTens(last) }) : null

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-5 rounded-none border border-gold/40 bg-background">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{shown?.title}</DialogTitle>
          <DialogDescription className="font-serif text-base text-foreground/90">{shown?.what}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-3 gap-px border border-border bg-border text-center">
          {[
            { label: 'Réussite', value: v },
            { label: 'Majeure', value: Math.floor(v / 2) },
            { label: 'Extrême', value: Math.floor(v / 5) },
          ].map((x) => (
            <div key={x.label} className="flex flex-col bg-card py-2">
              <dt className="text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{t(x.label)}</dt>
              <dd className="font-mono text-lg">≤ {x.value}</dd>
            </div>
          ))}
        </dl>
        <Stepper
          label={t('Dés bonus ou de pénalité')}
          value={net}
          text={netLabel(t, net) || t('Ni bonus ni pénalité')}
          min={-MAX_NET}
          max={MAX_NET}
          onChange={setNet}
        />
        <Button size="lg" onClick={go} disabled={roll.isPending}>
          <Dices data-icon="inline-start" />
          {last ? t('Relancer') : t('Lancer 1D100')}
        </Button>
        {dice && <DiceTray dice={dice} throwKey={pending ? null : throwing.fresh} onSettled={throwing.onSettled} />}
        {throwing.revealed(last, pending) && <RollResult roll={last} />}
        <p className="text-center text-xs text-muted-foreground">{t('Le gardien voit le résultat sur son écran.')}</p>
      </DialogContent>
    </Dialog>
  )
}

// ------------------------------------------------------------------ Dés tab

/** Dés tab: free dice (damage, D6…) rolled by the server, and this phone's last rolls. */
export function DiceTab() {
  const t = useT()
  const { token, member } = useSheetContext()
  const roll = useRollDice(token)
  const add = useRollHistory((s) => s.add)
  const history = useRollHistory((s) => s.rolls[member.id]) ?? []
  const [count, setCount] = useState(1)
  const [sides, setSides] = useState<number>(6)
  const [modifier, setModifier] = useState(0)

  const throwing = useThrow()

  const go = () =>
    roll.mutate({ characterId: member.id, count, sides, modifier }, { onSuccess: (r) => { add(r); throwing.received(r) } })
  const last = history[0]
  const pending = roll.isPending
  const dice = pending ? freeDice(count, sides, null) : last?.kind === 'dice' ? freeDice(last.count, last.sides, last.results) : null

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h2 className="eyebrow">{t('Dé')}</h2>
        <div role="radiogroup" aria-label={t('Dé')} className="grid grid-cols-4 gap-px border border-border bg-border">
          {DICE_SIDES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sides === s}
              onClick={() => setSides(s)}
              className={cn(
                'bg-card py-3 font-heading text-lg hover:text-gold',
                sides === s && 'bg-gold text-background hover:text-background',
              )}
            >
              D{s}
            </button>
          ))}
        </div>
      </section>
      <div className="grid grid-cols-2 gap-2">
        <Stepper label={t('Nombre de dés')} value={count} text={t.n(count, '{n} dé', '{n} dés')} min={1} max={MAX_DICE} onChange={setCount} />
        <Stepper
          label={t('Modificateur')}
          value={modifier}
          text={modifier < 0 ? `−${-modifier}` : `+${modifier}`}
          min={-MAX_MODIFIER}
          max={MAX_MODIFIER}
          onChange={setModifier}
        />
      </div>
      <Button size="lg" onClick={go} disabled={roll.isPending}>
        <Dices data-icon="inline-start" />
        {t('Lancer {dice}', { dice: diceFormula({ count, sides, modifier }) })}
      </Button>
      {dice && <DiceTray dice={dice} throwKey={pending ? null : throwing.fresh} onSettled={throwing.onSettled} />}
      {throwing.revealed(last, pending) && <RollResult key={last.id} roll={last} />}
      <p className="text-center text-xs text-muted-foreground">{t('Le gardien voit le résultat sur son écran.')}</p>

      {history.length > 1 && (
        <section className="flex flex-col gap-1">
          <h2 className="eyebrow">{t('Derniers jets')}</h2>
          <ul>
            {history.slice(1).map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 border-b border-border py-2">
                <span className="font-serif text-lg">
                  {r.kind === 'dice' ? diceFormula(r) : `${subjectName(t, r.subject)} (${r.target})`}
                </span>
                <span className="font-mono text-sm whitespace-nowrap">
                  {r.result}
                  {r.kind === 'check' && <span className="text-muted-foreground"> · {t(LEVEL_LABEL[r.level])}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
