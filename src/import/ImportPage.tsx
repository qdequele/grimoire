import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { FileUp, ImagePlus, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { storyKeys } from '@/stories/api'

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

async function errorMessage(e: unknown): Promise<string> {
  if (e instanceof FunctionsHttpError) {
    try {
      const body = (await e.context.json()) as { error?: { message?: string } }
      if (body.error?.message) return body.error.message
    } catch {
      /* not JSON */
    }
  }
  return e instanceof Error ? e.message : 'Import impossible.'
}

function usePagesUsedThisMonth() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['imports', 'month', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const start = new Date()
      start.setUTCDate(1)
      start.setUTCHours(0, 0, 0, 0)
      const { data, error } = await supabase.from('story_imports').select('page_count').gte('created_at', start.toISOString())
      if (error) throw error
      return data.reduce((n, r) => n + r.page_count, 0)
    },
  })
}

export function ImportPage() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const used = usePagesUsedThisMonth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])

  function addFiles(list: FileList | null) {
    if (!list) return
    const images = [...list].filter((f) => ACCEPTED.includes(f.type))
    setFiles((prev) => [...prev, ...images].slice(0, MAX_PAGES))
  }

  async function run() {
    const userId = session!.user.id
    const folder = `${userId}/${crypto.randomUUID()}`
    const total = files.length
    let importId: string | undefined
    let storyId: string | null = null
    let validationErrors: string[] = []
    setPhase({ kind: 'running', done: 0, total, storyId })
    const paths: string[] = []
    try {
      // Upload everything first, in page order. The function deletes each batch once read.
      for (const [i, file] of files.entries()) {
        const ext = file.type.split('/')[1] ?? 'png'
        const path = `${folder}/${String(i + 1).padStart(3, '0')}.${ext}`
        const { error } = await supabase.storage.from('import-pages').upload(path, file, { contentType: file.type })
        if (error) throw error
        paths.push(path)
      }
      for (let i = 0; i < paths.length; i += PAGES_PER_CALL) {
        const batch = paths.slice(i, i + PAGES_PER_CALL)
        const { data, error } = await supabase.functions.invoke<ImportResponse>('import-story', {
          body: { importId, pagePaths: batch, firstPage: i + 1, totalPages: total, lang, title: title || undefined },
        })
        if (error) throw error
        importId = data!.importId
        storyId = data!.storyId
        validationErrors = data!.validationErrors
        setPhase({ kind: 'running', done: i + batch.length, total, storyId })
        qc.invalidateQueries({ queryKey: storyKeys.all })
      }
      setPhase({ kind: 'done', storyId, validationErrors })
      setFiles([])
    } catch (e) {
      // Pages not reached yet are still in storage: remove them, book pages are never kept.
      if (paths.length) await supabase.storage.from('import-pages').remove(paths)
      setPhase({ kind: 'error', message: await errorMessage(e), storyId })
    } finally {
      qc.invalidateQueries({ queryKey: ['imports'] })
      qc.invalidateQueries({ queryKey: storyKeys.all })
    }
  }

  const running = phase.kind === 'running'

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl">Importer une histoire</h1>
        <p className="text-muted-foreground">
          Photos ou captures des pages d'un scénario que tu possèdes. L'IA en fait une histoire jouable, privée, que tu
          pourras relire et corriger. Les pages ne sont pas conservées.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Pages</CardTitle>
          <CardDescription>
            Dans l'ordre de lecture, {MAX_PAGES} au maximum.
            {used.data !== undefined && ` ${used.data} page${used.data > 1 ? 's' : ''} importée${used.data > 1 ? 's' : ''} ce mois-ci.`}
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
              <p className="text-sm text-muted-foreground">Dépose les images ici, ou</p>
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={running}>
                Choisir des images
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
                    <img src={previews[i]} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full rounded-md border object-cover" />
                    <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1 text-xs">{i + 1}</span>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="secondary"
                      className="absolute top-1 right-1"
                      aria-label={`Retirer la page ${i + 1}`}
                      disabled={running}
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
                <FieldLabel htmlFor="title">Titre</FieldLabel>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Facultatif" />
              </Field>
              <Field>
                <FieldLabel>Langue de l'histoire</FieldLabel>
                <Tabs value={lang} onValueChange={(v) => setLang(v as 'fr' | 'en')}>
                  <TabsList>
                    <TabsTrigger value="fr">Français</TabsTrigger>
                    <TabsTrigger value="en">English</TabsTrigger>
                  </TabsList>
                </Tabs>
                <FieldDescription>Les textes sont écrits dans cette langue.</FieldDescription>
              </Field>
            </div>

            <Button onClick={run} disabled={!files.length || running}>
              {running ? <Spinner data-icon="inline-start" /> : <FileUp data-icon="inline-start" />}
              Importer {files.length || ''} page{files.length > 1 ? 's' : ''}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>

      {phase.kind === 'running' && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <Progress value={(phase.done / phase.total) * 100} />
          <p className="text-sm text-muted-foreground">
            {phase.done} / {phase.total} pages converties. Compte environ une minute par lot de {PAGES_PER_CALL} pages.
          </p>
        </div>
      )}

      {phase.kind === 'done' && (
        <Alert>
          <AlertTitle>Import terminé</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            {phase.validationErrors.length > 0 && (
              <span>
                {phase.validationErrors.length} point{phase.validationErrors.length > 1 ? 's' : ''} à vérifier dans l'histoire
                (identifiants ou valeurs hors format).
              </span>
            )}
            {phase.storyId && (
              <Link to={`/stories/${phase.storyId}`} className="underline underline-offset-4">Ouvrir l'histoire</Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {phase.kind === 'error' && (
        <Alert variant="destructive">
          <AlertTitle>L'import s'est arrêté</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{phase.message}</span>
            {phase.storyId && (
              <Link to={`/stories/${phase.storyId}`} className="underline underline-offset-4">
                Voir ce qui a déjà été importé
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}
