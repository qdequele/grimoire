import { Copy, Download, Play, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/auth/auth'
import { useCharacters } from '@/characters/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useStartGame } from '@/games/api'
import { useCopyStory, useDeleteStory, useStory } from './api'
import { downloadPack } from './packStorage'
import { useT } from '@/i18n/t'

export function StoryPage() {
  const t = useT()
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const { data: story, isPending, error } = useStory(id)
  const characters = useCharacters()
  const startGame = useStartGame()
  const copyStory = useCopyStory()
  const deleteStory = useDeleteStory()
  const [party, setParty] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [downloading, setDownloading] = useState(false)

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('Histoire introuvable.')}</AlertDescription>
      </Alert>
    )
  }
  if (isPending || !story) return <Skeleton className="h-64" />

  const { meta, overview, acts } = story.content
  const mine = story.owner_id === session?.user.id
  const toggle = (cid: string) => setParty((p) => (p.includes(cid) ? p.filter((x) => x !== cid) : [...p, cid]))

  async function start() {
    try {
      const gameId = await startGame.mutateAsync({ story: story!, characterIds: party })
      navigate(`/games/${gameId}`)
    } catch (e) {
      toast.error(t((e as Error).message))
    }
  }

  async function copy() {
    const copied = await copyStory.mutateAsync(story!)
    toast.success(t('Copie ajoutée à tes histoires.'))
    navigate(`/stories/${copied.id}`)
  }

  async function download() {
    setDownloading(true)
    try {
      const zip = await downloadPack(story!)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(zip)
      a.download = `${story!.content.meta.id}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      toast.error(t('Téléchargement impossible : {error}', { error: (e as Error).message }))
    } finally {
      setDownloading(false)
    }
  }

  async function remove() {
    await deleteStory.mutateAsync(story!)
    toast.success(t('Histoire supprimée.'))
    navigate('/stories/mine')
  }

  return (
    <article className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{mine ? t('Mon histoire') : t('Bibliothèque')}</Badge>
            <Badge variant="outline">{meta.lang.toUpperCase()}</Badge>
            {meta.era && <Badge variant="outline">{meta.era}</Badge>}
            {meta.duration && <Badge variant="outline">{meta.duration}</Badge>}
          </div>
          <h1 className="font-heading text-4xl">{meta.title}</h1>
          {meta.summary && <p className="text-lg text-muted-foreground">{meta.summary}</p>}
          {meta.contentWarnings?.length ? (
            <p className="text-sm text-muted-foreground">{t('Avertissements : {list}', { list: meta.contentWarnings.join(', ') })}</p>
          ) : null}
        </header>

        {overview?.secret && (
          <Card>
            <CardHeader>
              <CardTitle>{t('Pour le gardien')}</CardTitle>
              <CardDescription>{t("Le secret de l'histoire. Ne pas lire aux joueurs.")}</CardDescription>
            </CardHeader>
            <CardContent>{overview.secret}</CardContent>
          </Card>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-2xl">{t('Scènes')}</h2>
          {acts.map((act) => (
            <div key={act.id} className="flex flex-col gap-2">
              <h3 className="font-medium">{act.title}</h3>
              <ol className="flex list-decimal flex-col gap-1 pl-6 text-sm">
                {act.scenes.map((s) => (
                  <li key={s.id}>
                    <span className="font-medium">{s.title}</span>
                    {s.lead && <span className="text-muted-foreground"> · {s.lead}</span>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('Lancer une partie')}</CardTitle>
            <CardDescription>{t('Choisis les investigateurs de la table.')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {characters.data?.length ? (
              <div className="flex flex-col gap-2">
                {characters.data.map((c) => (
                  <Field key={c.id} orientation="horizontal">
                    <input
                      id={`party-${c.id}`}
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={party.includes(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                    <FieldLabel htmlFor={`party-${c.id}`} className="font-normal">
                      {c.data.name}
                      {c.data.occupation && <span className="text-muted-foreground"> · {t(c.data.occupation)}</span>}
                    </FieldLabel>
                  </Field>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("Tu n'as pas encore d'investigateur.")}</p>
            )}
            <Button variant="outline" render={<Link to="/characters/new" />} nativeButton={false}>
              <UserPlus data-icon="inline-start" />
              {t('Créer un investigateur')}
            </Button>
            <Button onClick={start} disabled={!party.length || startGame.isPending}>
              {startGame.isPending ? <Spinner data-icon="inline-start" /> : <Play data-icon="inline-start" />}
              {t('Lancer la partie')}
            </Button>
          </CardContent>
        </Card>

        <Button variant="outline" onClick={download} disabled={downloading}>
          {downloading ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
          {t('Télécharger le pack (.zip)')}
        </Button>
        {story.pack_files.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t.n(story.pack_files.length, 'Pack : story.json + {n} fichier', 'Pack : story.json + {n} fichiers')}
          </p>
        )}
        {!mine && (
          <Button variant="outline" onClick={copy} disabled={copyStory.isPending}>
            <Copy data-icon="inline-start" />
            {t('Copier dans mes histoires')}
          </Button>
        )}
        {mine && (
          <>
            <Separator />
            {confirmDelete ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm">{t('Supprimer définitivement cette histoire ? Les parties liées seront supprimées.')}</p>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={remove} disabled={deleteStory.isPending}>{t('Supprimer')}</Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>{t('Annuler')}</Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 data-icon="inline-start" />
                {t("Supprimer l'histoire")}
              </Button>
            )}
          </>
        )}
      </aside>
    </article>
  )
}
