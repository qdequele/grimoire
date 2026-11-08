import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { useT, type T } from '@/i18n/t'
import { LANG_LABEL, type Lang } from '@/settings/lang'
import { scenarioPath, TOOL_PATHS } from '../pages'
import { ToolArticle, ToolIntro, ToolLayout } from '../ToolLayout'
import { STORY_METAS, type StoryMeta } from './stories'

// The free scenarios: every original story of stories/, the page's language first.

function playersText(t: T, m: StoryMeta): string | undefined {
  const { min, max } = m.players ?? {}
  if (!min || !max) return undefined
  return min === max ? t.n(min, '{n} joueur', '{n} joueurs') : t('{min} à {max} joueurs', { min, max })
}

export function StoryTile({ m }: { m: StoryMeta }) {
  const t = useT()
  const facts = [playersText(t, m), m.duration, m.era].filter(Boolean).join(' · ')
  return (
    <li className="flex">
      <Link to={scenarioPath(m.id)} lang={m.lang} className="group flex w-full flex-col gap-3 border border-border bg-card p-5 hover:border-gold/60">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-2xl leading-tight group-hover:text-gold">{m.title}</h3>
          <Badge variant="outline" className="shrink-0">{LANG_LABEL[m.lang === 'en' ? 'en' : 'fr']}</Badge>
        </div>
        {facts && <p className="text-xs tracking-[0.1em] text-muted-foreground uppercase">{facts}</p>}
        {m.summary && <p className="line-clamp-4 font-serif text-lg leading-relaxed text-muted-foreground">{m.summary}</p>}
        <span className="mt-auto text-sm text-gold">{t('Lire le scénario')} →</span>
      </Link>
    </li>
  )
}

export function ScenarioListPage({ lang }: { lang: Lang }) {
  const t = useT()
  const other: Lang = lang === 'fr' ? 'en' : 'fr'
  const sorted = [...STORY_METAS].sort((a, b) => Number(a.lang !== lang) - Number(b.lang !== lang))
  return (
    <ToolLayout lang={lang} alternate={TOOL_PATHS.scenarios[other]}>
      <ToolIntro
        eyebrow={t('Bibliothèque gratuite')}
        title={t('Scénarios gratuits à imprimer')}
        crumbs={[[t('Outils'), TOOL_PATHS.hub[lang]], [t('Scénarios'), TOOL_PATHS.scenarios[lang]]]}
      >
        <p>{t('Des histoires originales pour les jeux d’enquête et d’horreur au d100, écrites pour Grimoire et publiées sous licence libre. Chacune se lit en entier ici : le secret, les scènes, les PNJ et les documents à remettre aux joueurs. Imprime-la, ou joue-la dans Grimoire.')}</p>
      </ToolIntro>
      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((m) => <StoryTile key={m.id} m={m} />)}
      </ul>
      <ToolArticle title={t('Comment jouer un de ces scénarios')}>
        <p>{t('Lis le scénario en entier avant la partie : le secret d’abord, puis les scènes. Chaque scène a un texte à lire aux joueurs, son fil (ce qui se passe, les jets à faire et leurs résultats) et ses PNJ.')}</p>
        <p>{t('Les investigateurs se créent avec le créateur gratuit ou sur la fiche vierge. Le lanceur de dés suffit pour jouer sans matériel.')}</p>
        <p>{t('Dans Grimoire, les mêmes scénarios se jouent scène par scène : les jets se lancent d’un clic, les joueurs suivent leur fiche sur leur téléphone, et la télé de la table montre le décor de la scène.')}</p>
      </ToolArticle>
    </ToolLayout>
  )
}
