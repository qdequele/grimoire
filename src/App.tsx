import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router'
import { AppLayout, RequireAuth } from '@/AppLayout'
import { AuthProvider } from '@/auth/auth'
import { LoginPage } from '@/auth/LoginPage'
import { CharactersPage } from '@/characters/CharactersPage'
import { PlayersPage } from '@/characters/PlayersPage'
import { CharacterWizardPage } from '@/characters/wizard/CharacterWizardPage'
import { Toaster } from '@/components/ui/sonner'
import { GamePage } from '@/games/GamePage'
import { HomePage } from '@/home/HomePage'
import { ImportPage } from '@/import/ImportPage'
import { MarketplacePage, MyStoriesPage } from '@/stories/StoryLists'
import { StoryPage } from '@/stories/StoryPage'
import { SettingsPage } from '@/settings/SettingsPage'
import { Section } from '@/theme/Section'

/** Old addresses (bookmarks, links in tests) → their place in the new menu, query string kept. */
function Moved({ to }: { to: string }) {
  return <Navigate to={{ pathname: to, search: useLocation().search }} replace />
}

const STORY_TABS = [
  { to: '/stories', label: 'Bibliothèque', end: true },
  { to: '/stories/mine', label: 'Mes histoires' },
  { to: '/stories/import', label: 'Importer' },
]
const INVESTIGATOR_TABS = [
  { to: '/characters', label: 'Investigateurs', end: true },
  { to: '/characters/joueurs', label: 'Joueurs' },
]

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Full-screen game screen, outside the app chrome.
  { path: '/games/:id', element: <RequireAuth><GamePage /></RequireAuth> },
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
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  )
}
