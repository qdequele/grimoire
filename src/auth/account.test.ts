import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KEEPER_DRAFT_KEY } from '@/characters/wizard/host'

vi.mock('@/lib/supabase', () => ({ supabase: {}, supabaseUrl: '', supabaseAnonKey: '' }))

const STORY = ['stories', 'one', 'story-1']
const DRAFT = JSON.stringify({ name: 'Unfinished' })

describe('what one account leaves in the browser for the next', () => {
  let store: Map<string, string>
  let cache: QueryClient
  /** A tab: its own module state (what it last saw), sharing the browser's storage. */
  const openTab = async () => {
    vi.resetModules()
    const [account, oauth] = await Promise.all([import('./account'), import('./oauth')])
    return { ...account, ...oauth }
  }

  beforeEach(() => {
    store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    cache = new QueryClient()
  })
  afterEach(() => vi.unstubAllGlobals())

  const asKeeperA = async () => {
    const tab = await openTab()
    tab.followAccount('keeper-a', cache)
    cache.setQueryData(STORY, { secret: 'private to A' })
    store.set(KEEPER_DRAFT_KEY, DRAFT)
    return tab
  }

  it('signing out empties the cached data and the unfinished investigator', async () => {
    const tab = await asKeeperA()
    tab.rememberNext('/stories/story-1')
    tab.followAccount(null, cache)
    expect(cache.getQueryData(STORY)).toBeUndefined()
    expect(store.has(KEEPER_DRAFT_KEY)).toBe(false)
    expect(tab.rememberedNext()).toBeNull()

    tab.followAccount('keeper-b', cache)
    expect(cache.getQueryData(STORY)).toBeUndefined()
  })

  it('another account signing in gets nothing of the first, even without a sign-out in between', async () => {
    const tab = await asKeeperA()
    tab.followAccount('keeper-b', cache)
    expect(cache.getQueryData(STORY)).toBeUndefined()
    expect(store.has(KEEPER_DRAFT_KEY)).toBe(false)
  })

  it('a session that ended while the site was closed counts as a sign-out at the next visit', async () => {
    await asKeeperA()
    const later = await openTab()
    later.followAccount(null, cache)
    expect(store.has(KEEPER_DRAFT_KEY)).toBe(false)
  })

  it('a tab that hears of a sign-out made in another tab empties its own cache', async () => {
    const tab = await asKeeperA()
    const other = await openTab()
    other.followAccount('keeper-a', new QueryClient())
    other.followAccount(null, new QueryClient())
    tab.followAccount(null, cache)
    expect(cache.getQueryData(STORY)).toBeUndefined()
  })

  it('the same account keeps everything (token refresh, reload, second tab)', async () => {
    const tab = await asKeeperA()
    tab.followAccount('keeper-a', cache)
    const reloaded = await openTab()
    reloaded.followAccount('keeper-a', cache)
    expect(cache.getQueryData(STORY)).toEqual({ secret: 'private to A' })
    expect(store.get(KEEPER_DRAFT_KEY)).toBe(DRAFT)
  })

  it('keeps what a visitor prepared before signing up or signing in', async () => {
    // The public investigator tool hands its draft over, and /login remembers where to go next.
    const tab = await openTab()
    tab.followAccount(null, cache)
    store.set(KEEPER_DRAFT_KEY, DRAFT)
    tab.rememberNext('/oauth/consent?authorization_id=abc')
    tab.followAccount('keeper-b', cache)
    expect(store.get(KEEPER_DRAFT_KEY)).toBe(DRAFT)
    expect(tab.rememberedNext()).toBe('/oauth/consent?authorization_id=abc')
  })

  // Start-up with an expired access token while offline, or while Supabase answers 502/503/504:
  // Auth reports no session and an error, but keeps the session: the keeper is still signed in.
  describe('a session that could not be checked at start-up', () => {
    const offline = new AuthRetryableFetchError('Failed to fetch', 0)
    const unsureStartUp = async () => {
      await asKeeperA()
      const tab = await openTab()
      tab.rememberNext('/stories/story-1')
      tab.followSession('getSession', null, cache, offline)
      tab.followSession('INITIAL_SESSION', null, cache)
      return tab
    }

    it('is not a sign-out: the keeper finds the draft, the page to return to and the data again', async () => {
      const tab = await unsureStartUp()
      expect(cache.getQueryData(STORY)).toEqual({ secret: 'private to A' })
      expect(store.get(KEEPER_DRAFT_KEY)).toBe(DRAFT)
      expect(tab.rememberedNext()).toBe('/stories/story-1')

      tab.followSession('TOKEN_REFRESHED', 'keeper-a', cache)
      const reloaded = await openTab()
      reloaded.followSession('getSession', 'keeper-a', cache, null)
      expect(cache.getQueryData(STORY)).toEqual({ secret: 'private to A' })
      expect(store.get(KEEPER_DRAFT_KEY)).toBe(DRAFT)
      expect(reloaded.rememberedNext()).toBe('/stories/story-1')
    })

    it('still leaves nothing for another account signing in afterwards', async () => {
      const tab = await unsureStartUp()
      tab.followSession('SIGNED_IN', 'keeper-b', cache)
      expect(cache.getQueryData(STORY)).toBeUndefined()
      expect(store.has(KEEPER_DRAFT_KEY)).toBe(false)
      expect(tab.rememberedNext()).toBeNull()
    })

    it.each([
      ['no error', null],
      ['a session Auth refused', new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found')],
    ])('but no session with %s is a sign-out', async (_name, error) => {
      await asKeeperA()
      const tab = await openTab()
      tab.followSession('getSession', null, cache, error)
      expect(cache.getQueryData(STORY)).toBeUndefined()
      expect(store.has(KEEPER_DRAFT_KEY)).toBe(false)
    })

    it('a sign-out event is one too, whatever came before', async () => {
      const tab = await unsureStartUp()
      tab.followSession('SIGNED_OUT', null, cache)
      expect(cache.getQueryData(STORY)).toBeUndefined()
      expect(store.has(KEEPER_DRAFT_KEY)).toBe(false)
    })
  })

  it('still works when the browser refuses storage', async () => {
    const blocked = () => {
      throw new Error('blocked')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked })
    const tab = await openTab()
    tab.followAccount('keeper-a', cache)
    cache.setQueryData(STORY, { secret: 'private to A' })
    tab.followAccount(null, cache)
    expect(cache.getQueryData(STORY)).toBeUndefined()
  })
})
