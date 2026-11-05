import { NotebookPen, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/i18n/t'
import { useCharacters, type CharacterRow } from './api'
import { NotebookDialog } from './NotebookDialog'
import { useNoteCounts } from './notes'

export function CharactersPage() {
  const t = useT()
  const { data, isPending, error } = useCharacters()
  const counts = useNoteCounts()
  const [notebook, setNotebook] = useState<CharacterRow | null>(null)

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-muted-foreground">{t("Ils gardent leur progression d'une histoire à l'autre.")}</p>
        <Button render={<Link to="/characters/new" />} nativeButton={false}>
          <UserPlus data-icon="inline-start" />
          {t('Nouvel investigateur')}
        </Button>
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
            <EmptyDescription>{t('Crée les investigateurs de tes joueurs avant de lancer une histoire.')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link to="/characters/new" />} nativeButton={false}>{t('Créer un investigateur')}</Button>
          </EmptyContent>
        </Empty>
      )}
      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => {
            return (
              <Card key={c.id} size="sm" className="relative">
                <CardHeader>
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
