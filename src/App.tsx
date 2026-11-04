import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppLayout, RequireAuth } from '@/AppLayout'
import { AuthProvider } from '@/auth/auth'
import { LoginPage } from '@/auth/LoginPage'
import { CharactersPage } from '@/characters/CharactersPage'
import { CharacterWizardPage } from '@/characters/wizard/CharacterWizardPage'
import { Toaster } from '@/components/ui/sonner'
import { GamePage } from '@/games/GamePage'
import { HomePage } from '@/home/HomePage'
import { ImportPage } from '@/import/ImportPage'
import { MarketplacePage, MyStoriesPage } from '@/stories/StoryLists'
import { StoryPage } from '@/stories/StoryPage'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Full-screen game screen, outside the app chrome.
  { path: '/games/:id', element: <RequireAuth><GamePage /></RequireAuth> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'marketplace', element: <MarketplacePage /> },
      { path: 'stories', element: <MyStoriesPage /> },
      { path: 'stories/:id', element: <StoryPage /> },
      { path: 'characters', element: <CharactersPage /> },
      { path: 'characters/:id', element: <CharacterWizardPage /> },
      { path: 'import', element: <ImportPage /> },
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
