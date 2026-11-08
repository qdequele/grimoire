import { Dices } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { checkDice, freeDice } from '@/companion/dice3d/dice'
import { DiceTray } from '@/companion/dice3d/DiceTray'
import { RollResult, Stepper, useThrow } from '@/companion/RollResult'
import { DICE_SIDES, diceFormula, LEVEL_LABEL, MAX_DICE, MAX_MODIFIER, MAX_NET, netLabel, type CheckRoll, type DiceRoll, type Roll } from '@/companion/rolls'
import { rollFormula, rollPercentile, successLevel } from '@/engine/dice'
import { Rich } from '@/i18n/Rich'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import type { Lang } from '@/settings/lang'
import { TOOL_PATHS } from './pages'
import { ToolArticle, ToolIntro, ToolLayout } from './ToolLayout'

// The free dice roller: a d100 check against a value (bonus and penalty dice, success level) and free
// dice from D3 to D100, thrown with the phones' 3D dice. Everything is rolled in the browser.

const HISTORY = 12
const QUICK_VALUES = [25, 40, 50, 60, 75]
let counter = 0
const nextId = () => `roll-${++counter}`

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border border-border bg-card p-4 sm:p-6">
      <h2 className="font-heading text-2xl">{title}</h2>
      {children}
    </section>
  )
}

/** d100 against a skill or characteristic value. */
function CheckRoller({ onRoll }: { onRoll: (r: Roll) => void }) {
  const t = useT()
  const [value, setValue] = useState(50)
  const [net, setNet] = useState(0)
  const [last, setLast] = useState<CheckRoll | null>(null)
  const throwing = useThrow()
  const v = Math.min(99, Math.max(1, value || 1))

  function go() {
    const p = rollPercentile(Math.max(0, net), Math.max(0, -net))
    const r: CheckRoll = {
      id: nextId(), characterId: 'tool', kind: 'check', subject: 'tool', target: v, net,
      tens: p.tens, units: p.units, result: p.result, level: successLevel(p.result, v), createdAt: new Date().toISOString(),
    }
    setLast(r)
    throwing.received(r)
  }

  const dice = last ? checkDice(last.tens.length, { tens: last.tens, units: last.units, kept: last.tens.findIndex((d) => (d === 0 && last.units === 0 ? 100 : d * 10 + last.units) === last.result) }) : null

  return (
    <Panel title={t('Test de compétence (d100)')}>
      <div className="flex flex-col gap-2">
        <label htmlFor="tool-value" className="eyebrow">{t('Valeur de la compétence ou de la caractéristique')}</label>
        <div className="flex flex-wrap items-center gap-2">
          <Input id="tool-value" type="number" inputMode="numeric" min={1} max={99} value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-24 font-mono text-lg" />
          {QUICK_VALUES.map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={v === q}
              onClick={() => setValue(q)}
              className={cn('border px-2.5 py-1 font-mono text-sm hover:text-gold', v === q ? 'border-gold/70 text-gold' : 'border-border text-muted-foreground')}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
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
      <Stepper label={t('Dés bonus ou de pénalité')} value={net} text={netLabel(t, net) || t('Ni bonus ni pénalité')} min={-MAX_NET} max={MAX_NET} onChange={setNet} />
      <Button size="lg" onClick={go}>
        <Dices data-icon="inline-start" />
        {last ? t('Relancer') : t('Lancer 1D100')}
      </Button>
      <div className="flex min-h-44 flex-col items-center justify-center gap-2" aria-live="polite">
        {dice ? (
          <>
            <DiceTray dice={dice} throwKey={throwing.fresh} onSettled={(k) => { throwing.onSettled(k); if (last?.id === k) onRoll(last) }} maxSize={64} />
            {throwing.revealed(last, false) && <RollResult key={last.id} roll={last} />}
          </>
        ) : (
          <p className="text-center text-sm text-muted-foreground">{t('Indique la valeur, puis lance le dé.')}</p>
        )}
      </div>
    </Panel>
  )
}

/** Any number of dice of one kind, plus a modifier (damage, D6…). */
function FreeRoller({ onRoll }: { onRoll: (r: Roll) => void }) {
  const t = useT()
  const [count, setCount] = useState(1)
  const [sides, setSides] = useState<number>(6)
  const [modifier, setModifier] = useState(0)
  const [last, setLast] = useState<DiceRoll | null>(null)
  const throwing = useThrow()

  function go() {
    const f = rollFormula(`${count}D${sides}`)!
    const results = f.terms[0].dice!.results
    const r: DiceRoll = {
      id: nextId(), characterId: 'tool', kind: 'dice', count, sides, modifier, results,
      result: f.total + modifier, createdAt: new Date().toISOString(),
    }
    setLast(r)
    throwing.received(r)
  }

  return (
    <Panel title={t('Dés libres : dégâts, D6, D20…')}>
      <div role="radiogroup" aria-label={t('Dé')} className="grid grid-cols-4 gap-px border border-border bg-border">
        {DICE_SIDES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={sides === s}
            onClick={() => setSides(s)}
            className={cn('bg-card py-3 font-heading text-lg hover:text-gold', sides === s && 'bg-gold text-background hover:text-background')}
          >
            D{s}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
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
      <Button size="lg" onClick={go}>
        <Dices data-icon="inline-start" />
        {t('Lancer {dice}', { dice: diceFormula({ count, sides, modifier }) })}
      </Button>
      <div className="flex min-h-44 flex-col items-center justify-center gap-2" aria-live="polite">
        {last ? (
          <>
            <DiceTray dice={freeDice(last.count, last.sides, last.results)} throwKey={throwing.fresh} onSettled={(k) => { throwing.onSettled(k); if (last.id === k) onRoll(last) }} maxSize={64} />
            {throwing.revealed(last, false) && <RollResult key={last.id} roll={last} />}
          </>
        ) : (
          <p className="text-center text-sm text-muted-foreground">{t('Choisis un dé et leur nombre.')}</p>
        )}
      </div>
    </Panel>
  )
}

export function DiceRollerPage({ lang }: { lang: Lang }) {
  const t = useT()
  const [history, setHistory] = useState<Roll[]>([])
  const add = (r: Roll) => setHistory((h) => [r, ...h].slice(0, HISTORY))
  const other: Lang = lang === 'fr' ? 'en' : 'fr'

  return (
    <ToolLayout lang={lang} alternate={TOOL_PATHS.dice[other]}>
      <ToolIntro
        eyebrow={t('Outil gratuit')}
        title={t('Lanceur de dés en ligne')}
        crumbs={[[t('Outils'), TOOL_PATHS.hub[lang]], [t('Lanceur de dés'), TOOL_PATHS.dice[lang]]]}
      >
        <p>{t('Un d100 contre la valeur d’une compétence, avec dés bonus ou de pénalité et le niveau de réussite. Et tous les dés du D3 au D100 pour les dégâts. Les dés roulent en 3D, dans ton navigateur, sans compte.')}</p>
      </ToolIntro>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <CheckRoller onRoll={add} />
        <FreeRoller onRoll={add} />
      </div>

      {history.length > 0 && (
        <section className="flex max-w-3xl flex-col gap-2">
          <h2 className="eyebrow">{t('Derniers jets')}</h2>
          <ul>
            {history.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 border-b border-border py-2">
                <span className="font-serif text-lg">
                  {r.kind === 'dice' ? diceFormula(r) : t('1D100 contre {value}', { value: r.target })}
                  {r.kind === 'check' && r.net !== 0 && <span className="text-sm text-muted-foreground"> · {netLabel(t, r.net)}</span>}
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

      <ToolArticle title={t('Comment lire un jet de d100')}>
        <p>{t('On lance deux dés à dix faces : un pour les dizaines (00 à 90), un pour les unités (0 à 9). 00 et 0 font 100. Le jet réussit s’il est inférieur ou égal à la valeur de la compétence.')}</p>
        <h3>{t('Les niveaux de réussite')}</h3>
        <p><Rich text={t('Plus le résultat est bas, meilleure est la réussite. Une **réussite majeure** demande la moitié de la valeur ou moins, une **réussite extrême** le cinquième ou moins. Avec 60 en Bibliothèque : 60 ou moins réussit, 30 ou moins est une réussite majeure, 12 ou moins une réussite extrême.')} /></p>
        <h3>{t('Dés bonus et dés de pénalité')}</h3>
        <p>{t('Quand les circonstances aident l’investigateur, on lance un dé des dizaines de plus et on garde le plus bas : c’est un dé bonus. Quand elles le gênent, on garde le plus haut : c’est un dé de pénalité. Un dé bonus et un dé de pénalité s’annulent.')}</p>
        <h3>{t('Les autres dés')}</h3>
        <p>{t('Les dégâts d’une arme, la perte de santé mentale ou la chance se lancent avec les autres dés : 1D3 pour un coup de poing, 1D6, 1D8 ou 1D10 pour une arme, 2D6 et plus pour les créatures. Un D3 est un D6 dont on divise le résultat par deux, arrondi au supérieur.')}</p>
      </ToolArticle>
    </ToolLayout>
  )
}
