import { NotebookPen, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/i18n/t'
import { useCharacters, useSetCharacterPhoto, type CharacterRow } from './api'
import { Avatar } from './Avatar'
import { NotebookDialog } from './NotebookDialog'
import { PhotoDialog } from './PhotoDialog'
import { PregensLink } from './pregens/PregensPage'
import { useNoteCounts } from './notes'

export function CharactersPage() {
  const t = useT()
  const { data, isPending, error } = useCharacters()
  const counts = useNoteCounts()
  const [notebook, setNotebook] = useState<CharacterRow | null>(null)
  const [photoOf, setPhotoOf] = useState<CharacterRow | null>(null)
  const setPhoto = useSetCharacterPhoto()
  const savePhoto = async (characterId: string, photo: string | null) => {
    try {
      await setPhoto.mutateAsync({ characterId, photo })
    } catch (e) {
      toast.error(t("Impossible d'enregistrer la photo : {error}", { error: (e as Error).message }))
      throw e
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-muted-foreground">{t("Ils gardent leur progression d'une histoire à l'autre.")}</p>
        <div className="flex flex-wrap gap-2">
          <PregensLink />
          <Button render={<Link to="/characters/new" />} nativeButton={false}>
            <UserPlus data-icon="inline-start" />
            {t('Nouvel investigateur')}
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t('Impossible de charger les investigateurs : {error}', { error: error.message })}</AlertDescription>
        </Alert>
      )}
      {isPending && <Skeleton className="h-32" />}
      {data && !data.length && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyTitle>{t('Aucun investigateur')}</EmptyTitle>
            <EmptyDescription>{t('Crée les investigateurs de tes joueurs, ou choisis des prétirés, avant de lancer une histoire.')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row flex-wrap justify-center">
            <Button render={<Link to="/characters/new" />} nativeButton={false}>{t('Créer un investigateur')}</Button>
            <PregensLink />
          </EmptyContent>
        </Empty>
      )}
      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => {
            return (
              <Card key={c.id} size="sm" className="relative">
                <CardHeader className="grid-cols-[auto_1fr] gap-x-3">
                  <button
                    type="button"
                    className="relative z-10 row-span-2 self-center rounded-full hover:[&>span]:border-foreground focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
                    aria-label={c.photo ? t('Changer la photo de {name}', { name: c.data.name }) : t('Ajouter une photo de {name}', { name: c.data.name })}
                    title={t('Photo')}
                    onClick={() => setPhotoOf(c)}
                  >
                    <Avatar name={c.data.name} photo={c.photo} className="size-11 text-sm" />
                  </button>
                  <CardTitle>
                    <Link to={`/characters/${c.id}`} className="after:absolute after:inset-0">{c.data.name}</Link>
                  </CardTitle>
                  <CardDescription>
                    {[c.data.occupation && t(c.data.occupation), c.data.age && t('{n} ans', { n: c.data.age }), c.player && t('joué par {name}', { name: c.player.name })].filter(Boolean).join(' · ')}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="flex flex-wrap gap-2">
                  {c.data.hp !== undefined && <Badge variant="outline">{t('PV')} {c.data.hp}</Badge>}
                  {c.data.san !== undefined && <Badge variant="outline">SAN {c.data.san}</Badge>}
                  {c.data.luck !== undefined && <Badge variant="outline">{t('Chance')} {c.data.luck}</Badge>}
                  <Button size="xs" variant="ghost" className="relative z-10 ml-auto" onClick={() => setNotebook(c)}>
                    <NotebookPen data-icon="inline-start" />
                    {t('Carnet ({n})', { n: counts.data?.[c.id] ?? 0 })}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
      {photoOf && (
        <PhotoDialog
          name={photoOf.data.name}
          photo={data?.find((c) => c.id === photoOf.id)?.photo ?? photoOf.photo}
          open
          onOpenChange={(open) => !open && setPhotoOf(null)}
          onSave={(photo) => savePhoto(photoOf.id, photo)}
        />
      )}
      {notebook && (
        <NotebookDialog
          characterId={notebook.id}
          name={notebook.data.name}
          open
          onOpenChange={(open) => !open && setNotebook(null)}
        />
      )}
    </section>
  )
}
