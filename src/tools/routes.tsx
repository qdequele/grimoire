import type { ReactElement } from 'react'
import { PageLang } from '@/i18n/t'
import type { Lang } from '@/settings/lang'
import { BlankSheetPage } from './BlankSheetPage'
import { DiceRollerPage } from './DiceRollerPage'
import { InvestigatorToolPage } from './InvestigatorToolPage'
import { MapMakerPage } from './MapMakerPage'
import { ItemCardsPage } from './ItemCardsPage'
import { TOOL_PATHS, type ToolKind } from './pages'
import { ScenarioListPage } from './scenarios/ScenarioListPage'
import { ScenarioPage } from './scenarios/ScenarioPage'
import { ToolsHub } from './ToolsHub'
import './print.css'

// The free public tools' routes: the app's router and the build's prerender (src/tools/prerender.tsx)
// use the same list. Public, no account, no Supabase.

const PAGES: Record<ToolKind, (props: { lang: Lang }) => ReactElement> = {
  hub: ToolsHub,
  dice: DiceRollerPage,
  investigator: InvestigatorToolPage,
  sheet: BlankSheetPage,
  map: MapMakerPage,
  cards: ItemCardsPage,
  scenarios: ScenarioListPage,
}

export const toolRoutes: { path: string; element: ReactElement }[] = [
  ...(Object.keys(TOOL_PATHS) as ToolKind[]).flatMap((kind) =>
    (['fr', 'en'] as const).map((lang) => {
      const Page = PAGES[kind]
      // PageLang here too: the page component itself translates (ToolLayout sets it for its children).
      return { path: TOOL_PATHS[kind][lang], element: <PageLang key={`${kind}-${lang}`} value={lang}><Page lang={lang} /></PageLang> }
    }),
  ),
  { path: '/scenarios/:id', element: <ScenarioPage /> },
]
