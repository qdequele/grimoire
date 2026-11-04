import { LogOut, UserRound } from 'lucide-react'
import { Link, Navigate, NavLink, Outlet } from 'react-router'
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
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/marketplace', label: 'Bibliothèque' },
  { to: '/stories', label: 'Mes histoires' },
  { to: '/characters', label: 'Investigateurs' },
  { to: '/import', label: 'Importer' },
]

/** Shell for every signed-in page. Signed-out visitors go to /login. */
export function AppLayout() {
  const { session, ready } = useAuth()
  const profile = useProfile()

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="font-heading text-xl">Grimoire</Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn('rounded-md px-3 py-1.5 text-sm whitespace-nowrap hover:bg-muted', isActive && 'bg-muted font-medium')
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Compte" />}>
              <UserRound />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {profile.data?.display_name || session.user.email}
                  {profile.data?.is_admin && <span className="text-muted-foreground"> · admin</span>}
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
                  <LogOut />
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
