import { Link } from 'react-router'
import { useProfile } from '@/auth/auth'
import { useCharacters, usePlayers } from '@/characters/api'
import { Button } from '@/components/ui/button'
import { useMyGames } from '@/games/api'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { useMyStories } from '@/stories/api'
import { Epigraph, Masthead } from '@/theme/Masthead'

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


export function HomePage() {
  const t = useT()
  const profile = useProfile()
  const games = useMyGames()
  const stories = useMyStories()
  const characters = useCharacters()
  const players = usePlayers()
  const last = games.data?.[0]
  const name = profile.data?.display_name

  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
      <div className="flex flex-col gap-10">
        <Masthead eyebrow={t('Écran du gardien')} title="Grimoire" subtitle={name ? t('Bonsoir, {name}', { name }) : t('Bonsoir')} />
        <ul className="flex flex-col gap-6">
          {last && (
            <MenuItem
              to={`/games/${last.id}`}
              label={t('Reprendre la partie')}
              meta={`${last.story?.content.meta.title ?? t('Histoire supprimée')} · ${t.date(last.updated_at)}`}
              primary
            />
          )}
          <MenuItem to="/stories" label={t('Nouvelle partie')} meta={t("choisir l'histoire puis les investigateurs")} primary={!last} />
          <MenuItem
            to="/stories/mine"
            label={t('Histoires')}
            meta={[t('bibliothèque'), stories.data && t.n(stories.data.length, '{n} histoire personnelle', '{n} histoires personnelles'), t('import')].filter(Boolean).join(' · ')}
          />
          <MenuItem
            to="/characters"
            label={t('Investigateurs')}
            meta={characters.data && players.data ? `${t.n(characters.data.length, '{n} investigateur', '{n} investigateurs')} · ${t.n(players.data.length, '{n} joueur', '{n} joueurs')}` : undefined}
          />
          <MenuItem to="/settings" label={t('Réglages')} meta={t('thème, langue')} />
        </ul>
      </div>

      <div className="flex flex-col gap-4 lg:pt-2">
        {games.data?.length ? (
          <>
            <p className="eyebrow">{t('Parties en cours')}</p>
            {games.data.map((g) => (
              <article key={g.id} className="flex flex-col gap-2 border border-border bg-card p-4">
                <h3 className="font-heading text-xl">{g.story?.content.meta.title ?? t('Histoire supprimée')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t.date(g.updated_at)} · {t.n(g.state.party.length, '{n} investigateur', '{n} investigateurs')}
                </p>
                <Button className="w-fit" size="sm" render={<Link to={`/games/${g.id}`} />} nativeButton={false}>
                  {t('Reprendre')}
                </Button>
              </article>
            ))}
          </>
        ) : (
          <Epigraph
            quote={t("La lampe du phare s'est éteinte il y a trois nuits. Quelqu'un doit aller voir.")}
            note={t('Aucune partie en cours. Crée tes investigateurs, puis lance une nouvelle partie.')}
          />
        )}
      </div>
    </div>
  )
}
