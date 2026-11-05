import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { checkDraft, derivedValues, finalSkills, ISSUE_STEP, newDraft, occupationOf, type CreationDraft } from '@/engine/creation'
import { cn } from '@/lib/utils'
import { useCharacter, useDeleteCharacter, useSaveCharacter, type CharacterRow } from '../api'
import type { CharacterData } from '../character'
import { STEPS, type StepProps } from './steps'
import { useT } from '@/i18n/t'

// Unsaved new investigator, kept per browser so a reload doesn't lose it (like the legacy S.draft).
const DRAFT_KEY = 'grimoire-character-draft'

function loadLocalDraft(): CreationDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return JSON.parse(raw) as CreationDraft
  } catch {
    /* unavailable or corrupt: start fresh */
  }
  return newDraft()
}

function saveLocalDraft(d: CreationDraft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* not remembered, that's fine */
  }
}

/** An investigator made before the wizard existed: rebuild what we can. */
function draftFromCharacter({ data: c, player_id }: CharacterRow): CreationDraft {
  const d = c.creation ?? { ...newDraft('custom'), name: c.name, age: c.age ?? 25, characteristics: c.characteristics, luck: c.luck, rolled: true }
  return { ...d, playerId: player_id ?? '' }
}

export function toCharacterData(d: CreationDraft): CharacterData {
  const v = derivedValues(d.characteristics)
  return {
    name: d.name.trim(),
    occupation: occupationOf(d).label,
    age: d.age,
    link: d.link.trim() || undefined,
    characteristics: d.characteristics,
    hp: v.hp,
    mp: v.mp,
    san: v.san,
    luck: d.luck,
    move: v.move,
    build: v.build,
    damageBonus: v.damageBonus,
    skills: finalSkills(d),
    profile: Object.fromEntries(Object.entries(d.profile).filter(([, t]) => t?.trim())),
    creation: d,
  }
}

export function CharacterWizardPage() {
  const t = useT()
  const { id } = useParams()
  const editing = !!id && id !== 'new'
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const step = Math.min(STEPS.length - 1, Math.max(0, Number(params.get('etape') ?? 1) - 1))
  const existing = useCharacter(editing ? id : undefined)
  const save = useSaveCharacter()
  const remove = useDeleteCharacter()
  // "Créer un personnage" from a player's card: /characters/new?joueur=<player id>.
  // Kept from the first render: changing step rewrites the query string.
  const [forPlayer] = useState(() => params.get('joueur'))
  const [draft, setDraft] = useState<CreationDraft | null>(() => {
    if (editing) return null
    const d = loadLocalDraft()
    return forPlayer ? { ...d, playerId: forPlayer } : d
  })
  const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null)

  useEffect(() => {
    if (editing && existing.data && !draft) setDraft(draftFromCharacter(existing.data))
  }, [editing, existing.data, draft])

  if (!draft) return <Skeleton className="h-96" />

  const update: StepProps['update'] = (patch) =>
    setDraft((d) => {
      const next = typeof patch === 'function' ? patch(d!) : { ...d!, ...patch }
      if (!editing) saveLocalDraft(next)
      return next
    })
  const goTo = (i: number) => {
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

  async function onSave() {
    try {
      // Editing the sheet keeps what the investigator earned in play.
      const progress = editing ? existing.data?.data.progress : undefined
      await save.mutateAsync({ id: editing ? id : undefined, data: { ...toCharacterData(draft!), ...(progress ? { progress } : {}) }, playerId: draft!.playerId || null })
      if (!editing) saveLocalDraft(null)
      toast.success(t('{name} est enregistré.', { name: draft!.name.trim() }))
      navigate(forPlayer ? '/characters/joueurs' : '/characters')
    } catch (e) {
      toast.error(t((e as Error).message))
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav aria-label={t('Étapes de création')} className="min-w-0">
        <p className="eyebrow mb-3">{editing ? t('Modifier l’investigateur') : t('Création d’investigateur')}</p>
        <ol className="flex gap-1 overflow-x-auto lg:flex-col">
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
        <h1 className="font-heading text-4xl">
          {step === 0 ? (editing ? t('Modifier un investigateur') : t('Créer un investigateur')) : last ? draft.name || t('Sans nom') : t(title)}
        </h1>
        <Component draft={draft} update={update} goTo={goTo} />

        {last && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onSave} disabled={issues.length > 0 || save.isPending}>
              {save.isPending && <Spinner data-icon="inline-start" />}
              {editing ? t('Enregistrer les modifications') : t('Enregistrer le personnage')}
            </Button>
            {confirm === null && !editing && (
              <Button variant="ghost" onClick={() => setConfirm('reset')}>{t('Recommencer à zéro')}</Button>
            )}
            {confirm === null && editing && (
              <Button variant="ghost" onClick={() => setConfirm('delete')}>{t('Supprimer')}</Button>
            )}
            {confirm === 'reset' && (
              <span className="flex items-center gap-2 text-sm">
                {t('Tout effacer ?')}
                <Button variant="destructive" size="sm" onClick={() => { update(newDraft()); setConfirm(null); goTo(0) }}>{t('Oui')}</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>{t('Non')}</Button>
              </span>
            )}
            {confirm === 'delete' && (
              <span className="flex items-center gap-2 text-sm">
                {t('Supprimer ce personnage ?')}
                <Button
                  variant="destructive" size="sm" disabled={remove.isPending}
                  onClick={async () => { await remove.mutateAsync(id!); toast.success(t('Investigateur supprimé.')); navigate('/characters') }}
                >
                  {t('Oui')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>{t('Non')}</Button>
              </span>
            )}
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
