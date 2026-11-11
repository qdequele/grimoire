// The free public tools: their addresses (one per language, the page's language comes from it), and
// what search engines and link previews show for each. Read by the router, by the pages themselves
// (document title), and at build time by scripts/prerender.mjs (static HTML, sitemap.xml).
import type { Lang } from '@/settings/lang'
import { STORY_METAS, type StoryMeta } from './scenarios/stories'

export type ToolKind = 'hub' | 'dice' | 'investigator' | 'sheet' | 'cards' | 'scenarios'

export const TOOL_PATHS: Record<ToolKind, Record<Lang, string>> = {
  hub: { fr: '/outils', en: '/tools' },
  dice: { fr: '/outils/lanceur-de-des', en: '/tools/dice-roller' },
  investigator: { fr: '/outils/creer-un-investigateur', en: '/tools/investigator-generator' },
  sheet: { fr: '/outils/fiche-investigateur-vierge', en: '/tools/blank-investigator-sheet' },
  cards: { fr: '/outils/cartes-objets', en: '/tools/item-cards' },
  scenarios: { fr: '/scenarios', en: '/free-scenarios' },
}

/** One story's page: a single address, in the story's own language (a story is never translated). */
export const scenarioPath = (id: string) => `/scenarios/${id}`

interface Head {
  title: string
  description: string
}

/** Written whole in each language (like the legal pages): these are what a search result shows. */
const HEADS: Record<ToolKind, Record<Lang, Head>> = {
  hub: {
    fr: {
      title: 'Outils gratuits pour le jeu de rôle d’horreur et d’enquête',
      description: 'Lanceur de dés d100, créateur d’investigateur, fiche vierge et cartes d’objets à imprimer, scénarios gratuits pour les jeux d’enquête et d’horreur des années 1920. Sans compte.',
    },
    en: {
      title: 'Free tools for investigation and horror roleplaying games',
      description: 'A d100 dice roller, an investigator generator, a printable blank character sheet, printable item cards and free scenarios for 1920s investigation and horror games. No account needed.',
    },
  },
  dice: {
    fr: {
      title: 'Lanceur de dés en ligne : d100, dés bonus et de pénalité, D3 à D100',
      description: 'Lance un d100 contre une compétence et lis le niveau de réussite (normale, majeure, extrême), avec dés bonus ou de pénalité. Et tous les dés du D3 au D100, en 3D. Gratuit.',
    },
    en: {
      title: 'Online dice roller: d100 with bonus and penalty dice, D3 to D100',
      description: 'Roll a d100 against a skill and read the success level (regular, hard, extreme), with bonus or penalty dice. Plus every die from D3 to D100, in 3D. Free.',
    },
  },
  investigator: {
    fr: {
      title: 'Créer un investigateur années 20 : générateur de personnage gratuit',
      description: 'Crée un investigateur pas à pas ou au hasard : caractéristiques, occupation, compétences, valeurs dérivées et profil. Fiche prête à imprimer, sans compte.',
    },
    en: {
      title: '1920s investigator generator: free character creator',
      description: 'Create an investigator step by step or at random: characteristics, occupation, skills, derived values and background. A sheet ready to print, no account needed.',
    },
  },
  sheet: {
    fr: {
      title: 'Fiche d’investigateur vierge à imprimer (d100, années 20)',
      description: 'Une fiche de personnage vierge pour les jeux d’enquête et d’horreur au d100 : caractéristiques avec leurs moitiés et cinquièmes, compétences et valeurs de base, armes, profil. À imprimer ou en PDF.',
    },
    en: {
      title: 'Printable blank investigator sheet (d100, 1920s)',
      description: 'A blank character sheet for d100 investigation and horror games: characteristics with half and fifth values, skills with base values, weapons, background. Print it or save it as a PDF.',
    },
  },
  cards: {
    fr: {
      title: 'Cartes d’objets à imprimer pour le jeu de rôle d’horreur années 20',
      description: 'Près de cent cartes d’objets illustrées : armes, munitions, lanternes, outils, soins, lettres, clés et artefacts étranges, avec leurs règles au d100. À imprimer neuf par page ou à télécharger en PNG. Gratuit.',
    },
    en: {
      title: 'Printable item cards for 1920s horror roleplaying games',
      description: 'Nearly a hundred illustrated item cards: weapons, ammunition, lanterns, tools, medical kits, letters, keys and strange artefacts, with their d100 rules. Print them nine to a page or download them as PNG. Free.',
    },
  },
  scenarios: {
    fr: {
      title: 'Scénarios gratuits de jeu de rôle d’horreur à imprimer',
      description: 'Des scénarios originaux et gratuits pour les jeux d’enquête et d’horreur au d100 : one-shots et campagnes courtes, avec scènes, PNJ et documents. À lire, imprimer ou jouer dans Grimoire.',
    },
    en: {
      title: 'Free horror roleplaying scenarios to print',
      description: 'Original, free scenarios for d100 investigation and horror games: one-shots and short campaigns with scenes, NPCs and handouts. Read them, print them or play them in Grimoire.',
    },
  },
}

export interface PublicPage {
  path: string
  lang: Lang
  title: string
  description: string
  /** The same page in the other language. */
  alternate?: { lang: Lang; path: string }
  /** schema.org data for search engines. */
  jsonLd?: Record<string, unknown>
}

export const SITE = 'https://www.legrimoire.quest'

function toolJsonLd(kind: ToolKind, lang: Lang, head: Head): Record<string, unknown> {
  const url = SITE + TOOL_PATHS[kind][lang]
  if (kind === 'hub' || kind === 'scenarios' || kind === 'cards') return { '@context': 'https://schema.org', '@type': 'CollectionPage', name: head.title, description: head.description, url, inLanguage: lang }
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: head.title,
    description: head.description,
    url,
    inLanguage: lang,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  }
}

/** Title suffix of a story's page, in the story's language. */
const SCENARIO_SUFFIX: Record<string, string> = { fr: 'scénario gratuit à imprimer', en: 'free scenario to print' }

export function scenarioHead(m: StoryMeta): Head {
  const lang = m.lang === 'en' ? 'en' : 'fr'
  return { title: `${m.title} · ${SCENARIO_SUFFIX[lang]}`, description: m.summary ?? HEADS.scenarios[lang].description }
}

/** Every public page, in the order of the sitemap. */
export function publicPages(): PublicPage[] {
  const tools = (Object.keys(TOOL_PATHS) as ToolKind[]).flatMap((kind) =>
    (['fr', 'en'] as const).map((lang): PublicPage => {
      const other: Lang = lang === 'fr' ? 'en' : 'fr'
      const head = HEADS[kind][lang]
      return { path: TOOL_PATHS[kind][lang], lang, ...head, alternate: { lang: other, path: TOOL_PATHS[kind][other] }, jsonLd: toolJsonLd(kind, lang, head) }
    }),
  )
  const stories = STORY_METAS.map((m): PublicPage => {
    const lang: Lang = m.lang === 'en' ? 'en' : 'fr'
    const head = scenarioHead(m)
    return {
      path: scenarioPath(m.id),
      lang,
      ...head,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: m.title,
        description: m.summary,
        url: SITE + scenarioPath(m.id),
        inLanguage: lang,
        genre: 'Horror roleplaying scenario',
        isAccessibleForFree: true,
        ...(m.license?.startsWith('CC') ? { license: m.license } : {}),
        ...(m.author ? { author: { '@type': 'Organization', name: m.author } } : {}),
      },
    }
  })
  return [...tools, ...stories]
}

/** The page at this address, if it is one of the public tools. */
export function publicPage(path: string): PublicPage | undefined {
  const clean = path.replace(/\/+$/, '') || '/'
  return publicPages().find((p) => p.path === clean)
}
