import { BookOpen, FileUp, Play, Store, Users } from 'lucide-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router'
import { useProfile } from '@/auth/auth'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMyGames } from '@/games/api'

const ACTIONS: Array<{ to: string; title: string; description: string; icon: ComponentType }> = [
  { to: '/characters', title: 'Investigateurs', description: 'Crée et fais évoluer les personnages de tes joueurs.', icon: Users },
  { to: '/marketplace', title: 'Bibliothèque', description: 'Choisis une histoire prête à jouer.', icon: Store },
  { to: '/stories', title: 'Mes histoires', description: 'Tes imports et tes histoires personnelles.', icon: BookOpen },
  { to: '/import', title: 'Importer', description: "Transforme les pages d'un scénario en histoire jouable.", icon: FileUp },
]

export function HomePage() {
  const profile = useProfile()
  const games = useMyGames()

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-4xl">Bonsoir{profile.data?.display_name ? `, ${profile.data.display_name}` : ''}</h1>
        <p className="text-muted-foreground">Que préparons-nous pour la prochaine séance ?</p>
      </header>

      {games.data && games.data.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-2xl">Parties en cours</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {games.data.map((g) => (
              <Card key={g.id} size="sm">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <CardTitle>{g.story?.content.meta.title ?? 'Histoire supprimée'}</CardTitle>
                    <CardDescription>
                      {g.state.party.length} investigateur{g.state.party.length > 1 ? 's' : ''} ·{' '}
                      {new Date(g.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </CardDescription>
                  </div>
                  <Button render={<Link to={`/games/${g.id}`} />} nativeButton={false} size="sm">
                    <Play data-icon="inline-start" />
                    Reprendre
                  </Button>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {ACTIONS.map(({ to, title, description, icon: Icon }) => (
          <Card key={to} className="relative">
            <CardHeader>
              <Icon />
              <CardTitle>
                <Link to={to} className="after:absolute after:inset-0">{title}</Link>
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  )
}
