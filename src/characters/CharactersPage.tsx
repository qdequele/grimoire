import { UserPlus, Users } from 'lucide-react'
import { Link } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useCharacters } from './api'

export function CharactersPage() {
  const { data, isPending, error } = useCharacters()

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl">Investigateurs</h1>
          <p className="text-muted-foreground">Ils gardent leur progression d'une histoire à l'autre.</p>
        </div>
        <Button render={<Link to="/characters/new" />} nativeButton={false}>
          <UserPlus data-icon="inline-start" />
          Nouvel investigateur
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger les investigateurs : {error.message}</AlertDescription>
        </Alert>
      )}
      {isPending && <Skeleton className="h-32" />}
      {data && !data.length && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyTitle>Aucun investigateur</EmptyTitle>
            <EmptyDescription>Crée les investigateurs de tes joueurs avant de lancer une histoire.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link to="/characters/new" />} nativeButton={false}>Créer un investigateur</Button>
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
                    {[c.data.occupation, c.data.age && `${c.data.age} ans`, c.data.player && `joué par ${c.data.player}`].filter(Boolean).join(' · ')}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="flex flex-wrap gap-2">
                  {c.data.hp !== undefined && <Badge variant="outline">PV {c.data.hp}</Badge>}
                  {c.data.san !== undefined && <Badge variant="outline">SAN {c.data.san}</Badge>}
                  {c.data.luck !== undefined && <Badge variant="outline">Chance {c.data.luck}</Badge>}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
