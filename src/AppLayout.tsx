import { LogOut, Settings, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth, useProfile } from '@/auth/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { supabase } from '@/lib/supabase'
import { useT } from '@/i18n/t'
import { LegalLinks } from '@/legal/LegalPage'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/stories', label: 'Histoires' },
  { to: '/characters', label: 'Investigateurs' },
  { to: '/settings', label: 'Réglages' },
]

function AccountMenu() {
  const t = useT()
  const { session } = useAuth()
  const profile = useProfile()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t('Compte')} />}>
        <UserRound />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="eyebrow truncate">
            {profile.data?.display_name || session?.user.email}
            {profile.data?.is_admin && ' · admin'}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link to="/settings" />}>
            <Settings />
            {t('Réglages')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
            <LogOut />
            {t('Se déconnecter')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The login page, coming back here once signed in (?next=, read by LoginPage). */
function ToLogin() {
  const { pathname, search } = useLocation()
  const next = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`
  return <Navigate to={`/login${next}`} replace />
}

/** Signed-in pages without the app chrome (the game screen, the OAuth consent page). Signed-out visitors go to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth()
  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!session) return <ToLogin />
  return children
}

/** Shell for every signed-in page. Signed-out visitors go to /login. */
export function AppLayout() {
  const t = useT()
  const { session, ready } = useAuth()
  // The home screen has its own big title block, like the legacy menu: no top bar there.
  const isHome = useLocation().pathname === '/'

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!session) return <ToLogin />

  return (
    <div className="relative flex min-h-svh flex-col">
      {isHome ? (
        <div className="absolute top-4 right-4 sm:right-10">
          <AccountMenu />
        </div>
      ) : (
        <header className="app-header">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-10">
            <Link to="/" className="font-heading text-2xl text-gold">Grimoire</Link>
            <nav className="flex flex-1 gap-1 overflow-x-auto">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    cn(
                      'px-3 py-1.5 text-xs font-semibold tracking-[0.14em] whitespace-nowrap text-muted-foreground uppercase hover:text-gold',
                      isActive && 'text-gold',
                    )
                  }
                >
                  {t(n.label)}
                </NavLink>
              ))}
            </nav>
            <AccountMenu />
          </div>
        </header>
      )}
      <main className={cn('mx-auto w-full max-w-6xl flex-1 px-4 sm:px-10', isHome ? 'py-16 lg:py-[4.5rem]' : 'py-10')}>
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-10">
        <LegalLinks t={t} />
      </footer>
    </div>
  )
}
