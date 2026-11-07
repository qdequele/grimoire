import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { applyDamage, type DamageOutcome, type Health } from '@/engine/damage'
import { rollFormula, rollPercentile, successLevel } from '@/engine/dice'
import { useT, type T } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { DemoCard } from './parts'

// The game screen's combat helper, cut down: turn order by DEX, a creature attacks, damage follows
// the rules (major wound, unconscious, dying, dead) through the same engine as the game.

interface Fighter { id: string; name: string; dex: number; health: Health; foe?: boolean }

const ATTACK = { skill: 45, damage: '1D6+1D4' }

const START: Fighter[] = [
  { id: 'iris', name: 'Iris Vautrin', dex: 70, health: { hp: 11, maxHp: 11, state: 'ok' } },
  { id: 'beast', name: '', dex: 55, health: { hp: 14, maxHp: 14, state: 'ok' }, foe: true },
  { id: 'paul', name: 'Paul Mercier', dex: 40, health: { hp: 12, maxHp: 12, state: 'ok' } },
]

type Entry =
  | { kind: 'miss'; round: number; roll: number }
  | { kind: 'hit'; round: number; roll: number; target: string; damage: number; from: number; to: number; outcome: DamageOutcome }

function outcomeText(t: T, o: DamageOutcome): string {
  switch (o) {
    case 'none': return ''
    case 'killedOutright': return t('tué sur le coup')
    case 'majorWoundDying': return t('blessure grave, mourant')
    case 'majorWound': return t('blessure grave : jet de CON, sinon inconscient')
    case 'dyingFromWound': return t('mourant')
    case 'unconscious': return t('inconscient')
  }
}

function entryText(t: T, e: Entry, names: Record<string, string>): string {
  const head = t('Round {round} · Griffes ({skill} %) : {roll}', { round: e.round, skill: ATTACK.skill, roll: e.roll })
  if (e.kind === 'miss') return `${head}, ${t('raté')}.`
  const hit = t('{name} perd {damage} PV ({from} → {to})', { name: names[e.target], damage: e.damage, from: e.from, to: e.to })
  return `${head} — ${hit}${e.outcome === 'none' ? '' : ` : ${outcomeText(t, e.outcome)}`}.`
}

export function CombatDemo() {
  const t = useT()
  const beast = t('Chose des marais')
  const [fighters, setFighters] = useState(START)
  const [target, setTarget] = useState('paul')
  const [round, setRound] = useState(1)
  const [log, setLog] = useState<Entry[]>([])
  const names = Object.fromEntries(fighters.map((f) => [f.id, f.foe ? beast : f.name]))
  const standing = (f: Fighter) => f.health.state !== 'dead' && f.health.state !== 'dying' && f.health.state !== 'unconscious'
  const targets = fighters.filter((f) => !f.foe && standing(f))
  const aim = targets.find((f) => f.id === target) ?? targets[0]

  function attack() {
    if (!aim) return
    const roll = rollPercentile().result
    if (successLevel(roll, ATTACK.skill) === 'failure') {
      setLog((l) => [{ kind: 'miss' as const, round, roll }, ...l].slice(0, 4))
    } else {
      const damage = rollFormula(ATTACK.damage)!.total
      const { health, outcome } = applyDamage(aim.health, damage)
      setFighters((fs) => fs.map((f) => (f.id === aim.id ? { ...f, health } : f)))
      setLog((l) => [{ kind: 'hit' as const, round, roll, target: aim.id, damage, from: aim.health.hp, to: health.hp, outcome }, ...l].slice(0, 4))
    }
    setRound((r) => r + 1)
  }

  function reset() {
    setFighters(START)
    setRound(1)
    setLog([])
    setTarget('paul')
  }

  const stateLabel = (f: Fighter) =>
    ({ ok: '', majorWound: t('Blessure grave'), unconscious: t('Inconscient'), dying: t('Mourant'), dead: t('Mort') })[f.health.state]

  return (
    <DemoCard label={t('Combat · round {round}', { round })} hint={t('choisis une cible, puis attaque')}>
      <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{t('Ordre par DEX')}</p>
      <ol className="flex flex-col gap-2">
        {[...fighters].sort((a, b) => b.dex - a.dex).map((f) => {
          const pct = (f.health.hp / f.health.maxHp) * 100
          const hurt = f.health.state !== 'ok'
          const pickable = !f.foe && standing(f)
          return (
            <li key={f.id}>
              <button
                type="button"
                disabled={!pickable}
                aria-pressed={pickable ? aim?.id === f.id : undefined}
                onClick={() => setTarget(f.id)}
                className={cn(
                  'grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 border px-3 py-2 text-left',
                  pickable && aim?.id === f.id ? 'border-gold/70' : 'border-border',
                  pickable && 'hover:border-gold/50',
                )}
              >
                <span className="flex items-baseline gap-2">
                  <span className={cn('font-heading text-lg', f.foe && 'text-destructive')}>{names[f.id]}</span>
                  <span className="text-xs text-muted-foreground">DEX {f.dex}</span>
                  {pickable && aim?.id === f.id && <span className="text-xs text-gold">· {t('cible')}</span>}
                </span>
                <span className="font-mono text-sm">
                  {f.health.hp}/{f.health.maxHp} {t('PV')}
                </span>
                <span className="col-span-2 flex items-center gap-3">
                  <span className="h-1.5 flex-1 bg-muted">
                    <span className={cn('block h-full transition-[width] duration-500', hurt || f.foe ? 'bg-destructive' : 'bg-gold')} style={{ width: `${pct}%` }} />
                  </span>
                  {stateLabel(f) && <span className="text-xs text-destructive">{stateLabel(f)}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!aim} onClick={attack}>
          {aim ? t('Griffes sur {name} · {damage}', { name: aim.name.split(' ')[0], damage: ATTACK.damage }) : t('Plus personne debout')}
        </Button>
        <Button variant="ghost" onClick={reset}>{t('Recommencer')}</Button>
      </div>
      <ul className="flex min-h-24 flex-col gap-1 border-t border-border pt-3 text-sm" aria-live="polite">
        {log.length === 0 && <li className="text-muted-foreground">{t('Le journal de combat s’écrit ici.')}</li>}
        {log.map((e, i) => (
          <li key={`${e.round}-${i}`} className={cn(i > 0 && 'text-muted-foreground')}>{entryText(t, e, names)}</li>
        ))}
      </ul>
    </DemoCard>
  )
}
