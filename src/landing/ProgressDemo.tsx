import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { rollFormula, rollPercentile } from '@/engine/dice'
import { skillName, useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { DemoCard } from './parts'

// The improvement phase between games, as the game screen does it: every skill ticked during the
// game rolls a d100; above the skill, it gains 1D10. The investigator keeps it for the next game.

interface Skill { id: string; value: number; checked: boolean }

const START: Skill[] = [
  { id: 'library-use', value: 60, checked: true },
  { id: 'spot-hidden', value: 55, checked: true },
  { id: 'psychology', value: 40, checked: true },
  { id: 'stealth', value: 35, checked: false },
]

type Line = { id: string; roll: number; from: number; to: number }

export function ProgressDemo() {
  const t = useT()
  const [skills, setSkills] = useState(START)
  const [games, setGames] = useState(3)
  const [lines, setLines] = useState<Line[] | null>(null)
  const [history, setHistory] = useState<{ game: number; id: string; from: number; to: number }[]>([
    { game: 2, id: 'stealth', from: 30, to: 35 },
    { game: 1, id: 'library-use', from: 55, to: 60 },
  ])

  function toggle(id: string) {
    setSkills((s) => s.map((x) => (x.id === id ? { ...x, checked: !x.checked } : x)))
  }

  function improve() {
    const out: Line[] = []
    const next = skills.map((s) => {
      if (!s.checked) return s
      const roll = rollPercentile().result
      const to = roll > s.value ? Math.min(99, s.value + rollFormula('1D10')!.total) : s.value
      out.push({ id: s.id, roll, from: s.value, to })
      return { ...s, value: to, checked: false }
    })
    setSkills(next)
    setLines(out)
    setHistory((h) => [...out.filter((l) => l.to > l.from).map((l) => ({ game: games, id: l.id, from: l.from, to: l.to })), ...h].slice(0, 4))
    setGames((g) => g + 1)
  }

  const anyChecked = skills.some((s) => s.checked)

  return (
    <DemoCard label={t('Iris Vautrin · {n} parties', { n: games })} hint={t('coche des compétences, puis améliore')}>
      <ul className="flex flex-col">
        {skills.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={s.checked}
              onClick={() => toggle(s.id)}
              className="flex w-full items-center gap-3 border-b border-border py-2 text-left text-sm hover:text-gold"
            >
              <span aria-hidden="true" className={cn('size-3.5 border', s.checked ? 'border-gold bg-gold' : 'border-muted-foreground')} />
              <span className="flex-1">{skillName(t, s.id)}</span>
              <span className="font-mono">{s.value}</span>
            </button>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="w-fit" disabled={!anyChecked} onClick={improve}>{t('Phase d’amélioration')}</Button>
      {lines && (
        <ul className="flex flex-col gap-1 text-sm" aria-live="polite">
          {lines.map((l) => (
            <li key={l.id} className={cn(l.to > l.from ? 'text-gold' : 'text-muted-foreground')}>
              {l.to > l.from
                ? t('{skill} : jet {roll} → +{gain} ({from} → {to})', { skill: skillName(t, l.id), roll: l.roll, gain: l.to - l.from, from: l.from, to: l.to })
                : t('{skill} : jet {roll}, pas d’amélioration', { skill: skillName(t, l.id), roll: l.roll })}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <span className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{t('Historique')}</span>
        <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          {history.map((h, i) => (
            <li key={`${h.game}-${h.id}-${i}`}>
              {t('Partie {n} : {skill} passe de {from} à {to}', { n: h.game, skill: skillName(t, h.id), from: h.from, to: h.to })}
            </li>
          ))}
        </ul>
      </div>
    </DemoCard>
  )
}
