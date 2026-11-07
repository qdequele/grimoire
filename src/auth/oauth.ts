import { useQuery } from '@tanstack/react-query'
import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase'

/** Whether Google sign-in is switched on in this Supabase project (Dashboard → Authentication →
 *  Providers, or `[auth.external.google]` in config.toml locally). Read from Auth's public
 *  settings, so the button shows up as soon as it is configured, without a new deploy. */
export function useGoogleEnabled() {
  return useQuery({
    queryKey: ['auth-settings'],
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<boolean> => {
      const res = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseAnonKey } })
      if (!res.ok) return false
      const settings = (await res.json()) as { external?: Record<string, boolean> }
      return !!settings.external?.google
    },
  })
}

/** Leaves the site for Google, which sends the keeper back to this site, signed in; then on to
 *  `next` (rememberNext). The return address must be in Auth's redirect allow-list (site URL /
 *  additional redirect URLs). */
export async function signInWithGoogle(next = '/') {
  rememberNext(next)
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
}
/** An error the provider or Auth sent back in the return address (`?error_description=…` or
 *  `#error_description=…`), e.g. the keeper cancelled on Google's page. */
export function oauthErrorFromUrl(href: string): string | null {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  return url.searchParams.get('error_description') ?? hash.get('error_description')
}

/** Read once at start-up: the router sends signed-out visitors from `/` to `/login` and drops the
 *  query and hash on the way. */
export const returnedOAuthError = typeof window === 'undefined' ? null : oauthErrorFromUrl(window.location.href)

// Google sign-in and the sign-up confirmation e-mail come back to the site's root, not to the page
// that sent the keeper to /login (?next=). The OAuth consent page needs that return: a chat app
// (Claude, ChatGPT) waits for it. So the page is remembered here before leaving, for a short while.
const NEXT_KEY = 'grimoire-after-login'
const NEXT_TTL_MS = 30 * 60 * 1000

/** Remembers where to go once signed in (a path on this site, '/' forgets it). */
export function rememberNext(next: string, now = Date.now()) {
  try {
    if (next === '/') localStorage.removeItem(NEXT_KEY)
    else localStorage.setItem(NEXT_KEY, JSON.stringify({ next, at: now }))
  } catch {
    // Storage blocked: the keeper lands on the home page, as before.
  }
}

/** The remembered page, if recent; '/'-relative paths only. Doesn't forget it: see forgetNext. */
export function rememberedNext(now = Date.now()): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(NEXT_KEY) ?? 'null') as { next?: unknown; at?: unknown } | null
    if (!saved || typeof saved.next !== 'string' || typeof saved.at !== 'number') return null
    if (now - saved.at > NEXT_TTL_MS || now < saved.at) return null
    return saved.next.startsWith('/') && !saved.next.startsWith('//') && !saved.next.startsWith('/\\') ? saved.next : null
  } catch {
    return null
  }
}

export function forgetNext() {
  try {
    localStorage.removeItem(NEXT_KEY)
  } catch {
    // nothing to forget
  }
}
