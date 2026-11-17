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
/**
 * Whether the provider or Auth sent an error back in the return address (`?error=…` or `#error=…`,
 * with `error_code` and `error_description`), e.g. the keeper cancelled on Google's page, or a
 * confirmation link has expired. Only that it failed: anyone can write an address, so its
 * `error_description` is never shown on the page (the login page says it in its own words).
 */
export function oauthFailedIn(href: string): boolean {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  return [url.searchParams, hash].some((p) => !!p.get('error') || !!p.get('error_code'))
}

// Read once at start-up: with an error, the router sends signed-out visitors from `/` (where Google
// brings them back) to `/login`, dropping the query and hash on the way.
let oauthFailed = false
if (typeof window !== 'undefined' && oauthFailedIn(window.location.href)) {
  oauthFailed = true
  // What Auth said, for whoever is setting sign-in up (a return address missing from the allow-list…).
  const url = new URL(window.location.href)
  console.warn('Sign-in error returned in the address:', url.search, url.hash)
}

/** True from start-up until the keeper tries again or is signed in (forgetOAuthError). */
export const returnedOAuthError = (): boolean => oauthFailed

/** The error has been shown and acted on: "/" is the landing page again, and /login starts clean. */
export function forgetOAuthError() {
  oauthFailed = false
}

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
