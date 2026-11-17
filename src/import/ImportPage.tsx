import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUp, ImagePlus, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PackImport } from './PackImport'
import { importBatches, resumeFrom, type ImportResume } from './resume'
import { useAuth } from '@/auth/auth'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { functionErrorMessage } from '@/lib/functions'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/settings/lang'
import { storyKeys } from '@/stories/api'
import { useT } from '@/i18n/t'

/** Pages sent per Edge Function call: small enough to finish well inside its time limit. */
const PAGES_PER_CALL = 2
const MAX_PAGES = 40
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

interface ImportResponse {
  importId: string
  storyId: string | null
  validationErrors: string[]
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'running'; done: number; total: number; storyId: string | null }
  | { kind: 'done'; storyId: string | null; validationErrors: string[] }
  | { kind: 'error'; message: string; storyId: string | null }

function usePagesUsedThisMonth() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['imports', 'month', session?.user.id],
    enabled: !!session,
    // The same count as the import function's quota: pages sent this month, whatever their import's age.
    queryFn: async () => {
      const { data, error } = await supabase.rpc('import_pages_used', { p_owner: session!.user.id })
      if (error) throw error
      return data
    },
  })
}

export function ImportPage() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode') === 'pages' ? 'pages' : 'pack'
  const { session } = useAuth()
  const qc = useQueryClient()
  const used = usePagesUsedThisMonth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [lang, setLang] = useState<'fr' | 'en'>(useLang.getState().lang)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  // An import that stopped after some batches: the next run goes on with it. While it is pending
  // the pages, title and language stay as they were (page numbers must keep pointing at the same
  // files). Kept in memory only: a reload forgets it.
  const [resume, setResume] = useState<ImportResume | null>(null)
  const running = phase.kind === 'running'
  const locked = running || !!resume
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])

  function addFiles(list: FileList | null) {
    if (!list || locked) return
    const images = [...list].filter((f) => ACCEPTED.includes(f.type))
    setFiles((prev) => [...prev, ...images].slice(0, MAX_PAGES))
  }

  /** Imports the selected pages; with `from`, goes on with that interrupted import instead of starting a new one. */
  async function run(from: ImportResume | null) {
    const userId = session!.user.id
    const folder = `${userId}/${crypto.randomUUID()}`
    const total = from?.total ?? files.length
    const importTitle = from?.title ?? title
    const importLang = from?.lang ?? lang
    let importId = from?.importId
    let storyId = from?.storyId ?? null
    let validationErrors: string[] = []
    let done = from?.done ?? 0
    setResume(null)
    setPhase({ kind: 'running', done, total, storyId })
    const paths: string[] = []
    try {
      if (from) {
        // The server may have saved a batch whose answer never came back: go on from its count.
        const { data } = await supabase.from('story_imports').select('page_count, story_id').eq('id', from.importId).maybeSingle()
        done = resumeFrom(from.done, data?.page_count, total)
        storyId = data?.story_id ?? storyId
        setPhase({ kind: 'running', done, total, storyId })
      }
      // Upload the pages still to convert, in page order. The function deletes each batch once read.
      for (const [i, file] of files.slice(done).entries()) {
        const ext = file.type.split('/')[1] ?? 'png'
        const path = `${folder}/${String(done + i + 1).padStart(3, '0')}.${ext}`
        const { error } = await supabase.storage.from('import-pages').upload(path, file, { contentType: file.type })
        if (error) throw error
        paths.push(path)
      }
      for (const batch of importBatches(paths, done, PAGES_PER_CALL)) {
        const { data, error } = await supabase.functions.invoke<ImportResponse>('import-story', {
          body: { importId, pagePaths: batch.pagePaths, firstPage: batch.firstPage, totalPages: total, lang: importLang, title: importTitle || undefined },
        })
        if (error) throw error
        importId = data!.importId
        storyId = data!.storyId
        validationErrors = data!.validationErrors
        done = batch.firstPage - 1 + batch.pagePaths.length
        setPhase({ kind: 'running', done, total, storyId })
        qc.invalidateQueries({ queryKey: storyKeys.all })
      }
      setPhase({ kind: 'done', storyId, validationErrors })
      setFiles([])
    } catch (e) {
      // Pages not reached yet are still in storage: remove them, book pages are never kept.
      if (paths.length) await supabase.storage.from('import-pages').remove(paths)
      // Some pages are converted: the next run continues this import (same story, nothing counted twice).
      if (importId && done > 0) setResume({ importId, done, total, storyId, title: importTitle, lang: importLang })
      setPhase({ kind: 'error', message: await functionErrorMessage(e, 'Import impossible.'), storyId })
    } finally {
      qc.invalidateQueries({ queryKey: ['imports'] })
      qc.invalidateQueries({ queryKey: storyKeys.all })
    }
  }

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Tabs value={mode} onValueChange={(v) => setParams({ mode: v as string })}>
          <TabsList>
            <TabsTrigger value="pack">{t('Packs Grimoire')}</TabsTrigger>
            <TabsTrigger value="pages">{t('Pages scannées (IA)')}</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === 'pages' && (
          <p className="text-muted-foreground">
            {t("Photos ou captures des pages d'un scénario que tu possèdes. L'IA en fait une histoire jouable, privée, que tu pourras relire et corriger. Les pages ne sont pas conservées.")}
          </p>
        )}
      </header>

      {mode === 'pack' && <PackImport />}
      {mode === 'pages' && (
      <>

      <Card>
        <CardHeader>
          <CardTitle>{t('Pages')}</CardTitle>
          <CardDescription>
            {t("Dans l'ordre de lecture, {max} au maximum.", { max: MAX_PAGES })}
            {used.data !== undefined && ` ${t.n(used.data, '{n} page importée ce mois-ci.', '{n} pages importées ce mois-ci.')}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div
              className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                addFiles(e.dataTransfer.files)
              }}
            >
              <ImagePlus className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('Dépose les images ici, ou')}</p>
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={locked}>
                {t('Choisir des images')}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED.join(',')}
                multiple
                hidden
                data-testid="page-input"
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>

            {files.length > 0 && (
              <ol className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {files.map((f, i) => (
                  <li key={previews[i]} className="relative">
                    <img src={previews[i]} alt={t('Page {n}', { n: i + 1 })} className="aspect-[3/4] w-full rounded-md border object-cover" />
                    <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1 text-xs">{i + 1}</span>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="secondary"
                      className="absolute top-1 right-1"
                      aria-label={t('Retirer la page {n}', { n: i + 1 })}
                      disabled={locked}
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <X />
                    </Button>
                    <span className="sr-only">{f.name}</span>
                  </li>
                ))}
              </ol>
            )}

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field>
                <FieldLabel htmlFor="title">{t('Titre')}</FieldLabel>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Facultatif')} disabled={!!resume} />
              </Field>
              <Field>
                <FieldLabel>{t("Langue de l'histoire")}</FieldLabel>
                <Tabs value={lang} onValueChange={(v) => setLang(v as 'fr' | 'en')}>
                  <TabsList>
                    <TabsTrigger value="fr" disabled={!!resume}>Français</TabsTrigger>
                    <TabsTrigger value="en" disabled={!!resume}>English</TabsTrigger>
                  </TabsList>
                </Tabs>
                <FieldDescription>{t('Les textes sont écrits dans cette langue.')}</FieldDescription>
              </Field>
            </div>

            {resume ? (
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => run(resume)}>
                  <FileUp data-icon="inline-start" />
                  {t('Reprendre à la page {n}', { n: resume.done + 1 })}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setResume(null)
                    setPhase({ kind: 'idle' })
                  }}
                >
                  {t('Recommencer à zéro')}
                </Button>
              </div>
            ) : (
              <Button onClick={() => run(null)} disabled={!files.length || running}>
                {running ? <Spinner data-icon="inline-start" /> : <FileUp data-icon="inline-start" />}
                {files.length ? t.n(files.length, 'Importer {n} page', 'Importer {n} pages') : t('Importer les pages')}
              </Button>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      {phase.kind === 'running' && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <Progress value={(phase.done / phase.total) * 100} />
          <p className="text-sm text-muted-foreground">
            {t('{done} / {total} pages converties. Compte environ une minute par lot de {batch} pages.', { done: phase.done, total: phase.total, batch: PAGES_PER_CALL })}
          </p>
        </div>
      )}

      {phase.kind === 'done' && (
        <Alert>
          <AlertTitle>{t('Import terminé')}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            {phase.validationErrors.length > 0 && (
              <span>
                {t.n(phase.validationErrors.length, "{n} point à vérifier dans l'histoire (identifiants ou valeurs hors format).", "{n} points à vérifier dans l'histoire (identifiants ou valeurs hors format).")}
              </span>
            )}
            {phase.storyId && (
              <Link to={`/stories/${phase.storyId}`} className="underline underline-offset-4">{t("Ouvrir l'histoire")}</Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {phase.kind === 'error' && (
        <Alert variant="destructive">
          <AlertTitle>{t("L'import s'est arrêté")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{t(phase.message)}</span>
            {resume && (
              <span>
                {t.n(
                  resume.done,
                  'La première page est convertie. « Reprendre » continue cet import sans la refaire ni la recompter.',
                  'Les {n} premières pages sont converties. « Reprendre » continue cet import sans les refaire ni les recompter.',
                )}
              </span>
            )}
            {phase.storyId && (
              <Link to={`/stories/${phase.storyId}`} className="underline underline-offset-4">
                {t('Voir ce qui a déjà été importé')}
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}
      </>
      )}
    </section>
  )
}
