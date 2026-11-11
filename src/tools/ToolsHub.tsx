import { Dices, FileText, Map as MapIcon, ScrollText, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useT } from '@/i18n/t'
import type { Lang } from '@/settings/lang'
import { TOOL_PATHS, type ToolKind } from './pages'
import { StoryTile } from './scenarios/ScenarioListPage'
import { STORY_METAS } from './scenarios/stories'
import { ToolIntro, ToolLayout } from './ToolLayout'

// /outils, /tools: the free tools, and a few of the free scenarios.

function ToolCard({ kind, lang, icon, title, children }: { kind: ToolKind; lang: Lang; icon: ReactNode; title: string; children: ReactNode }) {
  const t = useT()
  return (
    <li className="flex">
      <Link to={TOOL_PATHS[kind][lang]} className="group flex w-full flex-col gap-3 border border-border bg-card p-5 hover:border-gold/60">
        <span className="text-gold [&_svg]:size-7" aria-hidden="true">{icon}</span>
        <h2 className="font-heading text-2xl leading-tight group-hover:text-gold">{title}</h2>
        <p className="font-serif text-lg leading-relaxed text-muted-foreground">{children}</p>
        <span className="mt-auto text-sm text-gold">{t('Ouvrir')} →</span>
      </Link>
    </li>
  )
}

export function ToolsHub({ lang }: { lang: Lang }) {
  const t = useT()
  const other: Lang = lang === 'fr' ? 'en' : 'fr'
  const stories = [...STORY_METAS].sort((a, b) => Number(a.lang !== lang) - Number(b.lang !== lang)).slice(0, 3)
  return (
    <ToolLayout lang={lang} alternate={TOOL_PATHS.hub[other]}>
      <ToolIntro eyebrow={t('Gratuit, sans compte')} title={t('Outils pour le gardien et les joueurs')}>
        <p>{t('De quoi préparer et mener une partie d’enquête et d’horreur des années 1920 : des dés, des investigateurs, des fiches à imprimer, des plans et des scénarios complets. Tout marche dans le navigateur, sans inscription.')}</p>
      </ToolIntro>
      <ul className="grid gap-6 sm:grid-cols-2">
        <ToolCard kind="dice" lang={lang} icon={<Dices />} title={t('Lanceur de dés')}>
          {t('Un d100 contre une compétence, avec dés bonus ou de pénalité et le niveau de réussite. Tous les dés du D3 au D100, en 3D.')}
        </ToolCard>
        <ToolCard kind="investigator" lang={lang} icon={<UserRound />} title={t('Créer un investigateur')}>
          {t('Pas à pas ou au hasard : occupation, caractéristiques, compétences et profil, vérifiés à chaque étape. La fiche s’imprime.')}
        </ToolCard>
        <ToolCard kind="sheet" lang={lang} icon={<FileText />} title={t('Fiche d’investigateur vierge')}>
          {t('Deux pages A4 à remplir au crayon : caractéristiques, toutes les compétences avec leur valeur de base, armes, profil.')}
        </ToolCard>
        <ToolCard kind="map" lang={lang} icon={<MapIcon />} title={t('Générateur de plans')}>
          {t('Le plan d’un manoir, d’une crypte ou d’un village, pièce par pièce, avec ses secrets. À télécharger ou imprimer.')}
        </ToolCard>
        <ToolCard kind="scenarios" lang={lang} icon={<ScrollText />} title={t('Scénarios gratuits')}>
          {t('Des histoires originales, complètes et sous licence libre, à lire, imprimer ou jouer dans Grimoire.')}
        </ToolCard>
      </ul>
      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-3xl">{t('Quelques scénarios')}</h2>
          <Link to={TOOL_PATHS.scenarios[lang]} className="text-sm text-gold hover:underline">{t('Tous les scénarios')} →</Link>
        </div>
        <ul className="grid gap-6 md:grid-cols-3">
          {stories.map((m) => <StoryTile key={m.id} m={m} />)}
        </ul>
      </section>
    </ToolLayout>
  )
}
