import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Feather, RefreshCw, ScrollText } from 'lucide-react'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Tuto } from '@/characters/wizard/parts'
import { tMsg, useT } from '@/i18n/t'
import { functionErrorMessage } from '@/lib/functions'
import { cn } from '@/lib/utils'
import { useLang } from '@/settings/lang'
import { useCreation, useCreationsThisMonth, useSuggestIdeas, useWriteOutline, useWriteScenes } from './api'
import { briefSchema, emptyBrief, LENGTHS, sceneTotal, THREATS, TONES, type Brief, type IdeaField, type Outline } from './brief'
import { OutlineReview } from './OutlineReview'
import { MoodStep, MysteryStep, SettingStep, TableStep, type QuestionProps } from './steps'

// The creator's progress, kept per browser so a reload (or coming back later) doesn't lose it.
const STORE_KEY = 'grimoire-story-creator'

interface Saved {
  brief: Brief
  creationId: string | null
  outline: Outline | null
  outlinesLeft: number | null
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as Saved
      if (briefSchema.safeParse(s.brief).success) return s
    }
  } catch {
    /* unavailable or corrupt: start fresh */
  }
  return null
}

function save(s: Saved | null) {
  try {
    if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORE_KEY)
  } catch {
    /* not remembered, that's fine */
  }
}

const QUESTION_STEPS: Array<{ title: string; Component: ComponentType<QuestionProps> }> = [
  { title: 'Cadre', Component: SettingStep },
  { title: 'Ambiance', Component: MoodStep },
  { title: 'Intrigue', Component: MysteryStep },
  { title: 'Table', Component: TableStep },
]
const STEPS = [...QUESTION_STEPS.map((s) => s.title), 'Plan', 'Écriture']
const PLAN = QUESTION_STEPS.length
const WRITE = PLAN + 1

type Phase =
  | { kind: 'idle' }
  | { kind: 'writing'; written: number; total: number }
  | { kind: 'error'; message: string; written: number; total: number; storyId: string | null }

export function CreateStoryPage() {
  const t = useT()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const step = Math.min(STEPS.length - 1, Math.max(0, Number(params.get('etape') ?? 1) - 1))
  const [initial] = useState(load)
  const form = useForm<Brief>({ resolver: zodResolver(briefSchema), defaultValues: initial?.brief ?? emptyBrief(useLang.getState().lang) })
  const [creationId, setCreationId] = useState<string | null>(initial?.creationId ?? null)
  const [outline, setOutline] = useState<Outline | null>(initial?.outline ?? null)
  const [outlinesLeft, setOutlinesLeft] = useState<number | null>(initial?.outlinesLeft ?? null)
  const [notes, setNotes] = useState('')
  const [inspiring, setInspiring] = useState<'all' | IdeaField | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [confirmReset, setConfirmReset] = useState(false)
  const stopped = useRef(false)

  const used = useCreationsThisMonth()
  const server = useCreation(creationId)
  const ideas = useSuggestIdeas()
  const writeOutline = useWriteOutline()
  const writeScenes = useWriteScenes()

  // Remember everything the keeper did, answers included.
  const brief = useWatch({ control: form.control }) as Brief
  useEffect(() => {
    save({ brief, creationId, outline, outlinesLeft })
  }, [brief, creationId, outline, outlinesLeft])

  // Leaving the page stops the writing loop after the current batch (it can be resumed).
  useEffect(() => () => { stopped.current = true }, [])

  const started = !!server.data?.story_id || server.data?.status === 'writing'
  const done = server.data?.status === 'succeeded' && !!server.data.story_id

  const goTo = (i: number) => {
    setParams({ etape: String(i + 1) })
    window.scrollTo(0, 0)
  }

  function startOver() {
    save(null)
    form.reset(emptyBrief(t.lang))
    setCreationId(null)
    setOutline(null)
    setOutlinesLeft(null)
    setNotes('')
    setPhase({ kind: 'idle' })
    setConfirmReset(false)
    goTo(0)
  }

  async function inspire(field?: IdeaField) {
    setInspiring(field ?? 'all')
    try {
      const { ideas: got } = await ideas.mutateAsync({ brief: form.getValues(), field })
      if (!Object.keys(got).length) toast.info(t('Pas de nouvelle idée cette fois. Réessaie.'))
      for (const [k, v] of Object.entries(got)) form.setValue(k as IdeaField, v, { shouldDirty: true })
    } catch (e) {
      toast.error(tMsg(t, await functionErrorMessage(e, 'Suggestion impossible.')))
    } finally {
      setInspiring(null)
    }
  }

  async function makeOutline(values: Brief) {
    try {
      const res = await writeOutline.mutateAsync(
        creationId && outline ? { brief: values, creationId, outline, notes: notes.trim() } : { brief: values },
      )
      setCreationId(res.creationId)
      setOutline(res.outline)
      setOutlinesLeft(res.outlinesLeft)
      setNotes('')
      goTo(PLAN)
    } catch (e) {
      toast.error(tMsg(t, await functionErrorMessage(e, 'Création impossible.')))
    }
  }

  async function writeAll() {
    if (!creationId) return
    stopped.current = false
    goTo(WRITE)
    const total = outline ? sceneTotal(outline) : 0
    let progress = { written: 0, total, storyId: server.data?.story_id ?? null }
    setPhase({ kind: 'writing', ...progress })
    // The edited outline goes with the first batch; the server keeps it from then on.
    let send: Outline | undefined = started ? undefined : outline ?? undefined
    try {
      for (;;) {
        const res = await writeScenes.mutateAsync({ creationId, outline: send })
        send = undefined
        progress = { written: res.written, total: res.total, storyId: res.storyId }
        setPhase({ kind: 'writing', ...progress })
        if (!res.remaining) {
          if (res.validationErrors.length) {
            toast.warning(t.n(res.validationErrors.length, "{n} point à vérifier dans l'histoire (identifiants ou valeurs hors format).", "{n} points à vérifier dans l'histoire (identifiants ou valeurs hors format)."))
          }
          toast.success(t('Ton histoire est prête.'))
          save(null)
          navigate(`/stories/${res.storyId}`)
          return
        }
        if (stopped.current) return
      }
    } catch (e) {
      setPhase({ kind: 'error', message: await functionErrorMessage(e, 'Création impossible.'), ...progress })
    }
  }

  const title = STEPS[step]
  const busy = writeOutline.isPending || phase.kind === 'writing'
  const Question = step < PLAN ? QUESTION_STEPS[step].Component : null

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav aria-label={t('Étapes de création')} className="min-w-0">
        <p className="eyebrow mb-3">{t('Création d’histoire')}</p>
        <ol className="flex gap-1 overflow-x-auto lg:flex-col">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => goTo(i)}
                disabled={(i === WRITE && !started && phase.kind === 'idle') || busy}
                aria-current={i === step ? 'step' : undefined}
                className={cn(
                  'flex w-full items-baseline gap-2 border-l-2 border-transparent px-3 py-1.5 text-left text-sm whitespace-nowrap text-muted-foreground hover:text-foreground disabled:opacity-50',
                  i === step && 'border-gold bg-card text-foreground',
                )}
              >
                <span className="font-mono text-xs">{i + 1}</span>
                {t(s)}
              </button>
            </li>
          ))}
        </ol>
        {used.data !== undefined && (
          <p className="mt-4 px-3 text-xs text-muted-foreground">
            {t.n(used.data, '{n} histoire créée ce mois-ci.', '{n} histoires créées ce mois-ci.')}
          </p>
        )}
      </nav>

      <section className="flex max-w-4xl min-w-0 flex-col gap-5">
        <h1 className="font-heading text-4xl">{step === 0 ? t('Créer une histoire') : t(title)}</h1>

        {done && step !== WRITE && (
          <Alert>
            <AlertTitle>{t('Ton histoire est prête.')}</AlertTitle>
            <AlertDescription className="flex flex-wrap gap-3">
              <Link to={`/stories/${server.data!.story_id}`} className="underline underline-offset-4">{t("Ouvrir l'histoire")}</Link>
              <button type="button" className="underline underline-offset-4" onClick={startOver}>{t('Créer une autre histoire')}</button>
            </AlertDescription>
          </Alert>
        )}

        {Question && <Question form={form} inspire={inspire} inspiring={inspiring} />}

        {step === PLAN && (
          <>
            {!outline && <PlanIntro brief={brief} />}
            {outline && (
              <>
                <Tuto>
                  <p>{t('Relis le plan. Tu peux renommer, réécrire un résumé ou retirer une scène. Si l’ensemble ne te plaît pas, dis ce qui ne va pas et demande un nouveau plan.')}</p>
                </Tuto>
                <OutlineReview outline={outline} onChange={setOutline} disabled={started || busy} />
              </>
            )}
            {!started && (
              <div className="flex flex-col gap-4 border-t pt-5">
                {outline && (
                  <Field>
                    <FieldLabel htmlFor="outline-notes">{t('Ce qui ne va pas')}</FieldLabel>
                    <Textarea
                      id="outline-notes"
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t('Facultatif. Ex. : moins de combat, un PNJ plus ambigu, une fin à Venise.')}
                    />
                    {outlinesLeft !== null && (
                      <FieldDescription>{t.n(outlinesLeft, 'Encore {n} nouveau plan possible pour cette histoire.', 'Encore {n} nouveaux plans possibles pour cette histoire.')}</FieldDescription>
                    )}
                  </Field>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {outline && (
                    <Button onClick={writeAll} disabled={busy}>
                      <Feather data-icon="inline-start" />
                      {t.n(sceneTotal(outline), "Écrire l'histoire ({n} scène)", "Écrire l'histoire ({n} scènes)")}
                    </Button>
                  )}
                  <Button
                    variant={outline ? 'outline' : 'default'}
                    onClick={form.handleSubmit(makeOutline)}
                    disabled={busy || outlinesLeft === 0}
                  >
                    {writeOutline.isPending ? <Spinner data-icon="inline-start" /> : outline ? <RefreshCw data-icon="inline-start" /> : <ScrollText data-icon="inline-start" />}
                    {outline ? t('Nouveau plan') : t('Écrire le plan')}
                  </Button>
                  {writeOutline.isPending && <span className="text-sm text-muted-foreground">{t('Compte une à deux minutes.')}</span>}
                </div>
              </div>
            )}
            {started && !done && (
              <Button className="w-fit" onClick={writeAll} disabled={busy}>
                <Feather data-icon="inline-start" />
                {t('Reprendre l’écriture')}
              </Button>
            )}
          </>
        )}

        {step === WRITE && (
          <WritingPanel phase={phase} onRetry={writeAll} done={done} storyId={server.data?.story_id ?? null} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {step > 0 ? (
            <Button variant="outline" onClick={() => goTo(step - 1)} disabled={busy}>
              <ArrowLeft data-icon="inline-start" />
              {t(STEPS[step - 1])}
            </Button>
          ) : <span />}
          {step < PLAN && (
            <Button className="ml-auto" onClick={() => goTo(step + 1)}>
              {t(STEPS[step + 1])}
              <ArrowRight data-icon="inline-end" />
            </Button>
          )}
        </div>

        {(creationId || form.formState.isDirty) && !busy && (
          <div className="flex items-center gap-2 text-sm">
            {!confirmReset && <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>{t('Recommencer à zéro')}</Button>}
            {confirmReset && (
              <>
                {t('Tout effacer ?')}
                <Button variant="destructive" size="sm" onClick={startOver}>{t('Oui')}</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>{t('Non')}</Button>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

/** Before the first outline: the answers in one glance. */
function PlanIntro({ brief: b }: { brief: Brief }) {
  const t = useT()
  const label = <T extends { id: string; label: string }>(list: readonly T[], id: string) => {
    const found = list.find((x) => x.id === id)
    return found ? t(found.label) : t('Au choix de l’IA')
  }
  const rows: Array<[string, string]> = [
    ['Époque', b.era || t('Au choix de l’IA')],
    ['Lieu', b.place || t('Au choix de l’IA')],
    ['Ton', label(TONES, b.tone)],
    ['Menace', label(THREATS, b.threat)],
    ['Le mystère', b.hook || t('Au choix de l’IA')],
    ['Nombre d’investigateurs', String(b.investigators)],
    ['Durée', label(LENGTHS, b.length)],
  ]
  return (
    <>
      <Tuto>
        <p>{t('L’IA va écrire le plan : le secret, les scènes, les personnages. Tu pourras le corriger avant qu’elle écrive les scènes en détail.')}</p>
      </Tuto>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-xs tracking-[0.12em] text-muted-foreground uppercase sm:pt-0.5">{t(k)}</dt>
            <dd className="font-serif">{v}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

function WritingPanel({ phase, onRetry, done, storyId }: { phase: Phase; onRetry: () => void; done: boolean; storyId: string | null }) {
  const t = useT()
  if (phase.kind === 'idle') {
    return done && storyId ? (
      <Link to={`/stories/${storyId}`} className="underline underline-offset-4">{t("Ouvrir l'histoire")}</Link>
    ) : (
      <Button className="w-fit" onClick={onRetry}>
        <Feather data-icon="inline-start" />
        {t('Reprendre l’écriture')}
      </Button>
    )
  }
  const pct = phase.total ? (phase.written / phase.total) * 100 : 0
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <Tuto>
        <p>{t('L’IA écrit les scènes deux par deux : texte à lire, déroulé, jets, personnages. L’histoire apparaît dans tes histoires dès les premières scènes.')}</p>
      </Tuto>
      <Progress value={pct} />
      <p className="text-sm text-muted-foreground">
        {t('{done} / {total} scènes écrites. Compte une à deux minutes par paire de scènes.', { done: phase.written, total: phase.total })}
      </p>
      {phase.kind === 'writing' && <Spinner />}
      {phase.kind === 'error' && (
        <Alert variant="destructive">
          <AlertTitle>{t("L'écriture s'est arrêtée")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{tMsg(t, phase.message)}</span>
            <span className="flex flex-wrap gap-3">
              <button type="button" className="underline underline-offset-4" onClick={onRetry}>{t('Reprendre l’écriture')}</button>
              {phase.storyId && (
                <Link to={`/stories/${phase.storyId}`} className="underline underline-offset-4">{t('Voir ce qui a déjà été écrit')}</Link>
              )}
            </span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
