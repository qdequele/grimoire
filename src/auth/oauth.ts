import { useQuery } from '@tanstack/react-query'
import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase'

export type OAuthProvider = 'google' | 'apple'
export const OAUTH_PROVIDERS: OAuthProvider[] = ['google', 'apple']

/** The providers switched on in this Supabase project (Dashboard → Authentication → Providers, or
 *  `[auth.external.*]` in config.toml locally). Read from Auth's public settings, so a provider's
 *  button shows up as soon as it is configured, without a new deploy. */
export function useOAuthProviders() {
  return useQuery({
    queryKey: ['auth-settings'],
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<OAuthProvider[]> => {
      const res = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseAnonKey } })
      if (!res.ok) return []
      const settings = (await res.json()) as { external?: Record<string, boolean> }
      return OAUTH_PROVIDERS.filter((p) => settings.external?.[p])
    },
  })
}

/** Leaves the site for the provider, which sends the keeper back to this site, signed in.
 *  The return address must be in Auth's redirect allow-list (site URL / additional redirect URLs). */
export async function signInWith(provider: OAuthProvider) {
  return supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
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
