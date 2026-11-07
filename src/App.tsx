import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, Navigate, RouterProvider, useLocation, useParams } from 'react-router'
import { AppLayout, RequireAuth } from '@/AppLayout'
import { AuthProvider } from '@/auth/auth'
import { LoginPage } from '@/auth/LoginPage'
import { OAuthConsentPage } from '@/auth/OAuthConsentPage'
import { CharactersPage } from '@/characters/CharactersPage'
import { PlayersPage } from '@/characters/PlayersPage'
import { CharacterWizardPage } from '@/characters/wizard/CharacterWizardPage'
import { Toaster } from '@/components/ui/sonner'
import { CompanionLayout } from '@/companion/CompanionLayout'
import { NewInvestigatorPage } from '@/companion/NewInvestigatorPage'
import { Notebook } from '@/companion/Notebook'
import { PickPage } from '@/companion/PickPage'
import { DiceTab } from '@/companion/Dice'
import { ProfileTab, SheetPage, SheetTab } from '@/companion/SheetPage'
import { GamePage } from '@/games/GamePage'
import { ScreenPage } from '@/screen/ScreenPage'
import { HomePage } from '@/home/HomePage'
import { ImportPage } from '@/import/ImportPage'
import { LegalPage } from '@/legal/LegalPage'
import { LEGAL_PATHS, type LegalKind } from '@/legal/paths'
import { MarketplacePage, MyStoriesPage } from '@/stories/StoryLists'
import { StoryPage } from '@/stories/StoryPage'
import { CreateStoryPage } from '@/stories/create/CreateStoryPage'
import { SettingsPage } from '@/settings/SettingsPage'
import { Section } from '@/theme/Section'

/** Old addresses (bookmarks, links in tests) → their place in the new menu, query string kept. */
function Moved({ to }: { to: string }) {
  return <Navigate to={{ pathname: to, search: useLocation().search }} replace />
}

/** One GamePage per game: going from /games/a to /games/b starts the new game from scratch. */
function GameRoute() {
  const { id } = useParams()
  return <GamePage key={id} />
}

const STORY_TABS = [
  { to: '/stories', label: 'Bibliothèque', end: true },
  { to: '/stories/mine', label: 'Mes histoires' },
  { to: '/stories/create', label: 'Créer' },
  { to: '/stories/import', label: 'Importer' },
]
const INVESTIGATOR_TABS = [
  { to: '/characters', label: 'Investigateurs', end: true },
  { to: '/characters/joueurs', label: 'Joueurs' },
]

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Privacy policy, terms and connector help: public, one address per language (the ChatGPT and
  // Claude directories link to them).
  ...(Object.keys(LEGAL_PATHS) as LegalKind[]).flatMap((kind) =>
    (['fr', 'en'] as const).map((lang) => ({ path: LEGAL_PATHS[kind][lang], element: <LegalPage key={`${kind}-${lang}`} kind={kind} lang={lang} /> })),
  ),
  // ChatGPT or Claude asks to use the MCP connector (Supabase Auth's OAuth server sends the keeper here).
  { path: '/oauth/consent', element: <RequireAuth><OAuthConsentPage /></RequireAuth> },
  // Full-screen game screen, outside the app chrome.
  { path: '/games/:id', element: <RequireAuth><GameRoute /></RequireAuth> },
  // Ambiance screen: a TV or tablet in the middle of the table, opened from the keeper's link (no account).
  { path: '/screen/:token', element: <ScreenPage /> },
  // Dev only (never in a production build): the drawn décors, from query params.
  ...(import.meta.env.DEV
    ? [{ path: '/dev/places', lazy: () => import('@/screen/PlacesGallery').then((m) => ({ Component: m.PlacesGallery })) }]
    : []),
  // Player companion: public pages opened from a table link (no account).
  {
    path: '/t/:token',
    element: <CompanionLayout />,
    children: [
      { index: true, element: <PickPage /> },
      { path: 'nouveau', element: <NewInvestigatorPage /> },
      {
        path: 'c/:characterId',
        element: <SheetPage />,
        children: [
          { index: true, element: <SheetTab /> },
          { path: 'des', element: <DiceTab /> },
          { path: 'carnet', element: <Notebook /> },
          { path: 'profil', element: <ProfileTab /> },
        ],
      },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'stories',
        element: <Section title="Histoires" tabs={STORY_TABS} />,
        children: [
          { index: true, element: <MarketplacePage /> },
          { path: 'mine', element: <MyStoriesPage /> },
          { path: 'create', element: <CreateStoryPage /> },
          { path: 'import', element: <ImportPage /> },
        ],
      },
      { path: 'stories/:id', element: <StoryPage /> },
      {
        path: 'characters',
        element: <Section title="Investigateurs" tabs={INVESTIGATOR_TABS} />,
        children: [
          { index: true, element: <CharactersPage /> },
          { path: 'joueurs', element: <PlayersPage /> },
        ],
      },
      { path: 'characters/:id', element: <CharacterWizardPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'marketplace', element: <Moved to="/stories" /> },
      { path: 'import', element: <Moved to="/stories/import" /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        {/* Top toasts (players' rolls on the game screen) sit under the game's toolbar; the others stay bottom-right. */}
        <Toaster offset={{ top: 80 }} mobileOffset={{ top: 72 }} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
