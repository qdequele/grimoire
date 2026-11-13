import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {}, supabaseUrl: '', supabaseAnonKey: '' }))
const { forgetNext, oauthFailedIn, rememberNext, rememberedNext } = await import('./oauth')

describe('page to return to after sign-in', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('comes back to the consent page within half an hour', () => {
    rememberNext('/oauth/consent?authorization_id=abc', 1_000)
    expect(rememberedNext(1_000 + 29 * 60_000)).toBe('/oauth/consent?authorization_id=abc')
    expect(rememberedNext(1_000 + 31 * 60_000)).toBeNull()
  })

  it('forgets it once used, or when the next page is the home page', () => {
    rememberNext('/settings', 1_000)
    forgetNext()
    expect(rememberedNext(1_000)).toBeNull()
    rememberNext('/settings', 1_000)
    rememberNext('/', 1_000)
    expect(rememberedNext(1_000)).toBeNull()
  })

  it('never sends the keeper to another site', () => {
    for (const next of ['//evil.example', '/\\evil.example', 'https://evil.example']) {
      localStorage.setItem('grimoire-after-login', JSON.stringify({ next, at: 1_000 }))
      expect(rememberedNext(1_000)).toBeNull()
    }
  })
})

describe('error sent back in the return address', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('is recognised in the query or the hash, by its error code', () => {
    expect(oauthFailedIn('https://grimoire.example/?error=access_denied&error_description=Cancelled')).toBe(true)
    expect(oauthFailedIn('https://grimoire.example/#error=access_denied&error_code=otp_expired&error_description=Expired')).toBe(true)
    expect(oauthFailedIn('https://grimoire.example/?error_code=bad_oauth_state')).toBe(true)
    expect(oauthFailedIn('https://grimoire.example/')).toBe(false)
    expect(oauthFailedIn('https://grimoire.example/login?next=%2Fsettings')).toBe(false)
  })

  it('never takes a message to show from the address', () => {
    expect(oauthFailedIn('https://grimoire.example/?error_description=Account%20suspended%3A%20write%20to%20x%40evil.example')).toBe(false)
  })

  /** The app starting at this address (the module reads it once). */
  const startAt = async (href: string) => {
    vi.resetModules()
    vi.stubGlobal('window', { location: { href } })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    return import('./oauth')
  }

  it('is kept until the login page has shown it, then forgotten for the rest of the visit', async () => {
    const oauth = await startAt('https://grimoire.example/?error=access_denied&error_description=Cancelled%20by%20user')
    expect(oauth.returnedOAuthError()).toBe(true)
    expect(oauth.returnedOAuthError()).toBe(true)
    oauth.forgetOAuthError()
    expect(oauth.returnedOAuthError()).toBe(false)
  })

  it('has nothing to show on an ordinary visit', async () => {
    const oauth = await startAt('https://grimoire.example/')
    expect(oauth.returnedOAuthError()).toBe(false)
  })
})
