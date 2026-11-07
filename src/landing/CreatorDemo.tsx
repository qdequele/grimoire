import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { derivedValues, rollCharacteristic } from '@/engine/creation'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { CHARACTERISTIC_INFO, CHARACTERISTICS, type Characteristic } from '@/rules/d100'
import { DemoCard } from './parts'

// The creation wizard's characteristics step, cut down: roll the eight characteristics, the derived
// values follow (same engine functions as the wizard).

type Sheet = Record<Characteristic, number>

const START: Sheet = { STR: 45, CON: 60, SIZ: 55, DEX: 70, APP: 50, INT: 75, POW: 65, EDU: 80 }
const STEPS = ['Concept', 'Caractéristiques', 'Valeurs dérivées', "Compétences d'occupation", 'Intérêts personnels', 'Profil']

export function CreatorDemo() {
  const t = useT()
  const [sheet, setSheet] = useState<Sheet>(START)
  const [rolls, setRolls] = useState(0)
  const d = derivedValues(sheet)

  function roll() {
    setSheet(Object.fromEntries(CHARACTERISTICS.map((k) => [k, rollCharacteristic(k)])) as Sheet)
    setRolls((n) => n + 1)
  }

  const derived: [string, string | number][] = [
    ['PV', d.hp], ['SAN', d.san], ['PM', d.mp], ['Esquive', d.dodge], ['Impact', d.damageBonus], ['Carrure', d.build],
  ]

  return (
    <DemoCard label={t('Nouvel investigateur')} hint={t('tire les caractéristiques')}>
      <ol className="flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] tracking-[0.12em] uppercase">
        {STEPS.map((s, i) => (
          <li key={s} className={cn('flex items-center gap-1.5', i === 1 ? 'text-gold' : 'text-muted-foreground')}>
            <span className="font-mono">{i + 1}</span> {t(s)}
          </li>
        ))}
      </ol>
      <dl className="grid grid-cols-4 gap-1.5">
        {CHARACTERISTICS.map((k) => (
          <div key={k} className="flex flex-col items-center border border-border py-2" title={t(CHARACTERISTIC_INFO[k].name)}>
            <dt className="text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">{t(CHARACTERISTIC_INFO[k].short)}</dt>
            {/* key: a new roll restarts the little fade on every value */}
            <dd key={`${k}-${rolls}`} className="font-mono text-xl text-gold animate-in fade-in zoom-in-90 duration-500">{sheet[k]}</dd>
          </div>
        ))}
      </dl>
      <dl className="grid grid-cols-3 gap-x-4 gap-y-1 border-t border-border pt-3 text-sm sm:grid-cols-6">
        {derived.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:gap-0">
            <dt className="text-xs text-muted-foreground">{t(label)}</dt>
            <dd className="font-mono">{value}</dd>
          </div>
        ))}
      </dl>
      <Button variant="outline" className="w-fit" onClick={roll}>{t('Tirer les caractéristiques')}</Button>
    </DemoCard>
  )
}
