import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { checkDraft, derivedValues, finalSkills, ISSUE_STEP, newDraft, occupationOf, type CreationDraft } from '@/engine/creation'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n/t'
import type { CharacterData } from '../character'
import { saveLocalDraft, useWizardHost } from './host'
import { STEPS, type StepProps } from './steps'

/** A whole number in 0..99: the range the sheet's points live in (and the companion RPC accepts). */
const points = (n: number) => Math.min(99, Math.max(0, Math.round(n)))

export function toCharacterData(d: CreationDraft): CharacterData {
  const v = derivedValues(d.characteristics)
  return {
    name: d.name.trim(),
    occupation: occupationOf(d).label,
    age: d.age,
    link: d.link.trim() || undefined,
    characteristics: d.characteristics,
    hp: points(v.hp),
    mp: points(v.mp),
    san: points(v.san),
    luck: d.luck === undefined ? undefined : points(d.luck),
    move: v.move,
    build: v.build,
    damageBonus: v.damageBonus,
    skills: finalSkills(d),
    profile: Object.fromEntries(Object.entries(d.profile).filter(([, t]) => t?.trim())),
    creation: d,
  }
}

export interface CharacterWizardProps {
  initial: CreationDraft
  /** Editing a saved investigator: no local draft, "save changes". */
  editing: boolean
  /** Saves the draft; handles its own errors. */
  onSave: (d: CreationDraft) => Promise<void>
  /** More buttons next to save on the summary step (the keeper's "delete"). */
  extraActions?: ReactNode
  /** One column, step list on top: inside the phone companion's narrow layout. */
  compact?: boolean
}

/** The 7-step creation wizard: step list, current step, save. The step is `?etape=` in the URL. */
export function CharacterWizard({ initial, editing, onSave, extraActions, compact = false }: CharacterWizardProps) {
  const t = useT()
  const { draftKey } = useWizardHost()
  const [params, setParams] = useSearchParams()
  const step = Math.min(STEPS.length - 1, Math.max(0, Number(params.get('etape') ?? 1) - 1))
  const [draft, setDraft] = useState<CreationDraft>(initial)
  const [confirmReset, setConfirmReset] = useState(false)
  const [saving, setSaving] = useState(false)

  const update: StepProps['update'] = (patch) =>
    setDraft((d) => {
      const next = typeof patch === 'function' ? patch(d) : { ...d, ...patch }
      if (!editing) saveLocalDraft(draftKey, next)
      return next
    })
  const goTo = (i: number) => {
    // Other query parameters (the keeper's ?joueur=) are read once by the page: replaced like before.
    setParams({ etape: String(i + 1) })
    window.scrollTo(0, 0)
  }
  const { issues } = checkDraft(draft)
  // Steps with something to fill in show ✓ or a gold dot; information-only steps show nothing.
  const stepsToCheck = new Set(Object.values(ISSUE_STEP))
  const stepsWithIssues = new Set(issues.map((i) => ISSUE_STEP[i.code]))
  const stepStatus = (i: number): 'done' | 'todo' | null =>
    i === STEPS.length - 1 ? (issues.length ? 'todo' : 'done') : stepsToCheck.has(i) ? (stepsWithIssues.has(i) ? 'todo' : 'done') : null
  const { title, Component } = STEPS[step]
  const last = step === STEPS.length - 1

  async function save() {
    setSaving(true)
    try {
      await onSave(draft)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('grid grid-cols-1 gap-8', !compact && 'lg:grid-cols-[15rem_minmax(0,1fr)]', compact && 'gap-5')}>
      <nav aria-label={t('Étapes de création')} className="min-w-0">
        <p className="eyebrow mb-3">{editing ? t('Modifier l’investigateur') : t('Création d’investigateur')}</p>
        <ol className={cn('flex gap-1 overflow-x-auto', !compact && 'lg:flex-col')}>
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === step ? 'step' : undefined}
                className={cn(
                  'flex w-full items-baseline gap-2 border-l-2 border-transparent px-3 py-1.5 text-left text-sm whitespace-nowrap text-muted-foreground hover:text-foreground',
                  i === step && 'border-gold bg-card text-foreground',
                )}
              >
                <span className="font-mono text-xs">{i + 1}</span>
                {t(s.title)}
                {stepStatus(i) === 'done' && <Check className="ml-auto size-3.5 self-center text-gold" aria-label={t('complet')} />}
                {stepStatus(i) === 'todo' && (
                  <span className="ml-auto size-1.5 self-center rounded-full bg-gold" role="img" aria-label={t('à compléter')} />
                )}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section className="flex max-w-4xl min-w-0 flex-col gap-5">
        <h1 className={cn('font-heading text-4xl', compact && 'text-3xl')}>
          {step === 0 ? (editing ? t('Modifier un investigateur') : t('Créer un investigateur')) : last ? draft.name || t('Sans nom') : t(title)}
        </h1>
        <Component draft={draft} update={update} goTo={goTo} />

        {last && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={issues.length > 0 || saving}>
              {saving && <Spinner data-icon="inline-start" />}
              {editing ? t('Enregistrer les modifications') : t('Enregistrer le personnage')}
            </Button>
            {!editing && !confirmReset && (
              <Button variant="ghost" onClick={() => setConfirmReset(true)}>{t('Recommencer à zéro')}</Button>
            )}
            {confirmReset && (
              <span className="flex items-center gap-2 text-sm">
                {t('Tout effacer ?')}
                <Button variant="destructive" size="sm" onClick={() => { update(newDraft()); setConfirmReset(false); goTo(0) }}>{t('Oui')}</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>{t('Non')}</Button>
              </span>
            )}
            {extraActions}
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          {step > 0 ? (
            <Button variant="outline" onClick={() => goTo(step - 1)}>
              <ArrowLeft data-icon="inline-start" />
              {t(STEPS[step - 1].title)}
            </Button>
          ) : <span />}
          {!last && (
            <Button className="ml-auto" onClick={() => goTo(step + 1)}>
              {t(STEPS[step + 1].title)}
              <ArrowRight data-icon="inline-end" />
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}
