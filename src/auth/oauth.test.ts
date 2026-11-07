import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {}, supabaseUrl: '', supabaseAnonKey: '' }))
const { forgetNext, rememberNext, rememberedNext } = await import('./oauth')

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
