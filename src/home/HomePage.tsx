import { Link } from 'react-router'
import { useProfile } from '@/auth/auth'
import { useCharacters } from '@/characters/api'
import { Button } from '@/components/ui/button'
import { useMyGames } from '@/games/api'
import { cn } from '@/lib/utils'
import { useMyStories } from '@/stories/api'
import { Epigraph, Masthead, SkinToggle } from '@/theme/Masthead'

/** A legacy home-menu entry: diamond bullet, display-font label, small line underneath. */
function MenuItem({ to, label, meta, primary }: { to: string; label: string; meta?: string; primary?: boolean }) {
  return (
    <li>
      <Link to={to} className="group flex items-baseline gap-3">
        <span aria-hidden="true" className="size-2.5 shrink-0 rotate-45 border border-gold/50 group-hover:bg-gold" />
        <span className="flex flex-col gap-1">
          <span className={cn('font-heading text-3xl leading-tight group-hover:text-gold', primary && 'text-gold')}>{label}</span>
          {meta && <span className="text-sm text-muted-foreground">{meta}</span>}
        </span>
      </Link>
    </li>
  )
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`
const ago = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

export function HomePage() {
  const profile = useProfile()
  const games = useMyGames()
  const stories = useMyStories()
  const characters = useCharacters()
  const last = games.data?.[0]
  const name = profile.data?.display_name

  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
      <div className="flex flex-col gap-10">
        <Masthead eyebrow="Écran du gardien" title="Grimoire" subtitle={name ? `Bonsoir, ${name}` : 'Bonsoir'} />
        <ul className="flex flex-col gap-6">
          {last && (
            <MenuItem
              to={`/games/${last.id}`}
              label="Reprendre la partie"
              meta={`${last.story?.content.meta.title ?? 'Histoire supprimée'} · ${ago(last.updated_at)}`}
              primary
            />
          )}
          <MenuItem to="/marketplace" label="Nouvelle partie" meta="choisir l'histoire puis les investigateurs" primary={!last} />
          <MenuItem to="/stories" label="Mes histoires" meta={stories.data ? plural(stories.data.length, 'histoire') : undefined} />
          <MenuItem to="/characters" label="Investigateurs" meta={characters.data ? plural(characters.data.length, 'investigateur') : undefined} />
          <MenuItem to="/import" label="Importer une histoire" meta="depuis les pages d'un scénario que tu possèdes" />
        </ul>
        <SkinToggle />
      </div>

      <div className="flex flex-col gap-4 lg:pt-2">
        {games.data?.length ? (
          <>
            <p className="eyebrow">Parties en cours</p>
            {games.data.map((g) => (
              <article key={g.id} className="flex flex-col gap-2 border border-border bg-card p-4">
                <h3 className="font-heading text-xl">{g.story?.content.meta.title ?? 'Histoire supprimée'}</h3>
                <p className="text-sm text-muted-foreground">
                  {ago(g.updated_at)} · {plural(g.state.party.length, 'investigateur')}
                </p>
                <Button className="w-fit" size="sm" render={<Link to={`/games/${g.id}`} />} nativeButton={false}>
                  Reprendre
                </Button>
              </article>
            ))}
          </>
        ) : (
          <Epigraph
            quote="La lampe du phare s'est éteinte il y a trois nuits. Quelqu'un doit aller voir."
            note="Aucune partie en cours. Crée tes investigateurs, puis lance une nouvelle partie."
          />
        )}
      </div>
    </div>
  )
}
