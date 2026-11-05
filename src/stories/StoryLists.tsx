import { BookOpen, FileUp, Feather, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useMarketplaceStories, useMyStories, type StoryRow } from './api'
import { StoryCard } from './StoryCard'
import { useT } from '@/i18n/t'

function StoryGrid({ stories, isPending, error, empty }: {
  stories: StoryRow[] | undefined
  isPending: boolean
  error: Error | null
  empty: ReactNode
}) {
  const t = useT()
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('Impossible de charger les histoires : {error}', { error: error.message })}</AlertDescription>
      </Alert>
    )
  }
  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}
      </div>
    )
  }
  if (!stories?.length) return empty
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stories.map((s) => <StoryCard key={s.id} story={s} />)}
    </div>
  )
}

export function MarketplacePage() {
  const t = useT()
  const { data, isPending, error } = useMarketplaceStories()
  return (
    <section className="flex flex-col gap-6">
      <p className="text-muted-foreground">{t("Des histoires prêtes à jouer, choisies par l'équipe Grimoire. Choisis-en une pour lancer une partie.")}</p>
      <StoryGrid
        stories={data}
        isPending={isPending}
        error={error}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Store /></EmptyMedia>
              <EmptyTitle>{t("La bibliothèque est vide pour l'instant")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
    </section>
  )
}

export function MyStoriesPage() {
  const t = useT()
  const { data, isPending, error } = useMyStories()
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-muted-foreground">{t('Visibles par toi seul : tes créations, tes imports et tes copies de la bibliothèque.')}</p>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link to="/stories/create" />} nativeButton={false}>
            <Feather data-icon="inline-start" />
            {t('Créer une histoire')}
          </Button>
          <Button variant="outline" render={<Link to="/stories/import" />} nativeButton={false}>
            <FileUp data-icon="inline-start" />
            {t('Importer une histoire')}
          </Button>
        </div>
      </header>
      <StoryGrid
        stories={data}
        isPending={isPending}
        error={error}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
              <EmptyTitle>{t('Aucune histoire personnelle')}</EmptyTitle>
              <EmptyDescription>
                {t("Crée une histoire originale avec l'aide de l'IA, importe les pages d'un scénario que tu possèdes, ou copie une histoire de la bibliothèque pour l'adapter.")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row flex-wrap justify-center">
              <Button render={<Link to="/stories/create" />} nativeButton={false}>{t('Créer une histoire')}</Button>
              <Button variant="outline" render={<Link to="/stories/import" />} nativeButton={false}>{t('Importer une histoire')}</Button>
            </EmptyContent>
          </Empty>
        }
      />
    </section>
  )
}
