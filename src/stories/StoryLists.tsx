import { BookOpen, FileUp, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useMarketplaceStories, useMyStories, type StoryRow } from './api'
import { StoryCard } from './StoryCard'

function StoryGrid({ stories, isPending, error, empty }: {
  stories: StoryRow[] | undefined
  isPending: boolean
  error: Error | null
  empty: ReactNode
}) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Impossible de charger les histoires : {error.message}</AlertDescription>
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
  const { data, isPending, error } = useMarketplaceStories()
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl">Bibliothèque</h1>
        <p className="text-muted-foreground">Des histoires prêtes à jouer, choisies par l'équipe Grimoire.</p>
      </header>
      <StoryGrid
        stories={data}
        isPending={isPending}
        error={error}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Store /></EmptyMedia>
              <EmptyTitle>La bibliothèque est vide pour l'instant</EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
    </section>
  )
}

export function MyStoriesPage() {
  const { data, isPending, error } = useMyStories()
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl">Mes histoires</h1>
          <p className="text-muted-foreground">Visibles par toi seul : tes imports et tes copies de la bibliothèque.</p>
        </div>
        <Button render={<Link to="/import" />} nativeButton={false}>
          <FileUp data-icon="inline-start" />
          Importer des pages
        </Button>
      </header>
      <StoryGrid
        stories={data}
        isPending={isPending}
        error={error}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
              <EmptyTitle>Aucune histoire personnelle</EmptyTitle>
              <EmptyDescription>
                Importe les pages d'un scénario que tu possèdes, ou copie une histoire de la bibliothèque pour l'adapter.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button render={<Link to="/import" />} nativeButton={false}>Importer des pages</Button>
            </EmptyContent>
          </Empty>
        }
      />
    </section>
  )
}
