import { useQueryClient } from '@tanstack/react-query'
import { Check, FolderOpen, PackageOpen, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { storyKeys, useImportPack, useMyStories } from '@/stories/api'
import { packSceneCount, readPack, splitPacks, unzipPack, type ReadPack } from '@/stories/pack'
import { tMsg, useT } from '@/i18n/t'

interface Item {
  key: string
  source: string
  pack: ReadPack
  status: 'ready' | 'importing' | 'done' | 'failed'
  progress?: [number, number]
  storyId?: string
  replaced?: boolean
  error?: string
}

const titleOf = (p: ReadPack) => ((p.story?.meta as { title?: string } | undefined)?.title ?? '')
const metaIdOf = (p: ReadPack) => ((p.story?.meta as { id?: string } | undefined)?.id ?? '')

async function entriesOf(file: File, path: string) {
  return { path, data: new Uint8Array(await file.arrayBuffer()) }
}

/** Import story packs (.zip or folders) as private stories, with their files in Storage. */
export function PackImport() {
  const t = useT()
  const qc = useQueryClient()
  const mine = useMyStories()
  const importPack = useImportPack()
  const zipInput = useRef<HTMLInputElement>(null)
  const dirInput = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [reading, setReading] = useState(false)
  const [running, setRunning] = useState(false)
  const existing = new Set((mine.data ?? []).map((s) => s.content.meta.id))

  async function add(files: File[]) {
    setReading(true)
    try {
      const next: Item[] = []
      // Each .zip is a pack (or a zipped folder of packs).
      for (const f of files.filter((f) => /\.zip$/i.test(f.name))) {
        try {
          for (const p of splitPacks(unzipPack(new Uint8Array(await f.arrayBuffer())))) {
            next.push({ key: `${f.name}/${p.name}`, source: f.name, pack: readPack(p.entries), status: 'ready' })
          }
        } catch {
          next.push({ key: f.name, source: f.name, pack: { story: null, files: [], errors: ['Archive .zip illisible.'], warnings: [] }, status: 'ready' })
        }
      }
      // Loose files from a folder pick: split by story.json.
      const loose = files.filter((f) => !/\.zip$/i.test(f.name))
      if (loose.length) {
        const entries = await Promise.all(loose.map((f) => entriesOf(f, f.webkitRelativePath || f.name)))
        for (const p of splitPacks(entries)) {
          next.push({ key: `dir/${p.name}/${entries.length}`, source: p.name || t('dossier'), pack: readPack(p.entries), status: 'ready' })
        }
      }
      setItems((prev) => [...prev.filter((i) => !next.some((n) => n.key === i.key)), ...next])
    } finally {
      setReading(false)
    }
  }

  const update = (key: string, patch: Partial<Item>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  async function run() {
    setRunning(true)
    for (const item of items.filter((i) => i.status === 'ready' && i.pack.story)) {
      update(item.key, { status: 'importing', progress: [0, item.pack.files.length + 1] })
      try {
        const { row, replaced } = await importPack.mutateAsync({
          story: item.pack.story!,
          files: item.pack.files,
          onProgress: (done, total) => update(item.key, { progress: [done, total] }),
        })
        update(item.key, { status: 'done', storyId: row.id, replaced })
      } catch (e) {
        update(item.key, { status: 'failed', error: (e as Error).message })
      }
    }
    setRunning(false)
    qc.invalidateQueries({ queryKey: storyKeys.all })
  }

  const importable = items.filter((i) => i.status === 'ready' && i.pack.story).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Packs Grimoire')}</CardTitle>
        <CardDescription>
          {t('Un pack est un dossier ou un .zip avec story.json, et souvent images/ et sounds/. Chaque histoire devient une histoire privée, ses fichiers sont gardés dans ton espace. Une histoire déjà importée (même identifiant) est mise à jour, ses parties sont conservées.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          className="flex flex-col items-center gap-3 border border-dashed p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            void add([...e.dataTransfer.files])
          }}
        >
          <PackageOpen className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('Dépose un ou plusieurs .zip ici, ou')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" onClick={() => zipInput.current?.click()} disabled={running}>
              {t('Choisir des .zip')}
            </Button>
            <Button type="button" variant="outline" onClick={() => dirInput.current?.click()} disabled={running}>
              <FolderOpen data-icon="inline-start" />
              {t('Choisir un dossier')}
            </Button>
          </div>
          <input
            ref={zipInput}
            type="file"
            accept=".zip,application/zip"
            multiple
            hidden
            data-testid="pack-zip-input"
            onChange={(e) => {
              void add([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
          <input
            ref={dirInput}
            type="file"
            multiple
            hidden
            data-testid="pack-dir-input"
            // @ts-expect-error non-standard but supported by every current browser
            webkitdirectory=""
            onChange={(e) => {
              void add([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
          {reading && <Spinner />}
        </div>

        {items.length > 0 && (
          <ul className="flex flex-col gap-3" aria-label="Packs à importer">
            {items.map((item) => {
              const title = titleOf(item.pack)
              const replaces = item.status === 'ready' && item.pack.story && existing.has(metaIdOf(item.pack))
              return (
                <li key={item.key} className="flex flex-col gap-2 border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-lg">{title || item.source}</span>
                    {item.pack.story && (
                      <>
                        <Badge variant="secondary">{String((item.pack.story.meta as { lang?: string }).lang ?? '').toUpperCase()}</Badge>
                        <Badge variant="outline">{t.n(packSceneCount(item.pack.story), '{n} scène', '{n} scènes')}</Badge>
                        <Badge variant="outline">{t.n(item.pack.files.length, '{n} fichier', '{n} fichiers')}</Badge>
                      </>
                    )}
                    {replaces && <Badge variant="outline">{t('remplacera l’histoire existante')}</Badge>}
                    <span className="ml-auto flex items-center gap-2 text-sm">
                      {item.status === 'done' && (
                        <>
                          <Check className="size-4 text-gold" />
                          {item.replaced ? t('Mise à jour') : t('Importée')}
                          <Link to={`/stories/${item.storyId}`} className="underline underline-offset-4">{t('Ouvrir')}</Link>
                        </>
                      )}
                      {item.status === 'failed' && <span className="text-destructive">{t('Échec')}</span>}
                      {item.status === 'ready' && !running && (
                        <Button
                          type="button" variant="ghost" size="icon-xs" aria-label={t('Retirer {name}', { name: title || item.source })}
                          onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                        >
                          <X />
                        </Button>
                      )}
                    </span>
                  </div>
                  {item.status === 'importing' && item.progress && (
                    <Progress value={(item.progress[0] / item.progress[1]) * 100} aria-label={t('Import de {name}', { name: title })} />
                  )}
                  {item.pack.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertDescription>{item.pack.errors.map((e) => tMsg(t, e)).join(' ')}</AlertDescription>
                    </Alert>
                  )}
                  {item.error && (
                    <Alert variant="destructive">
                      <AlertDescription>{tMsg(t, item.error)}</AlertDescription>
                    </Alert>
                  )}
                  {item.pack.warnings.length > 0 && (
                    <details className="text-sm text-muted-foreground">
                      <summary className="cursor-pointer">
                        {t.n(item.pack.warnings.length, '{n} point à vérifier (importable quand même)', '{n} points à vérifier (importable quand même)')}
                      </summary>
                      <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
                        {item.pack.warnings.map((w) => <li key={w}>{tMsg(t, w)}</li>)}
                      </ul>
                    </details>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <Button onClick={run} disabled={!importable || running}>
          {running && <Spinner data-icon="inline-start" />}
          {importable ? t.n(importable, 'Importer {n} histoire', 'Importer {n} histoires') : t('Importer les histoires')}
        </Button>
      </CardContent>
    </Card>
  )
}
