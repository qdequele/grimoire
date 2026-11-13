// The story creator page's logic that needs no React: its saved progress and what to do with it.
import { briefSchema, type Brief, type Outline } from './brief'

/**
 * The creator's progress is kept in the browser, per account: it holds the answers and the plan,
 * the story's secret included, which the next keeper to sign in on this browser must not see.
 */
export const storeKey = (userId: string) => `grimoire-story-creator-${userId}`

/** The key used before progress was per account. Whose progress it holds is unknown: it is dropped. */
const SHARED_KEY = 'grimoire-story-creator'

export interface Saved {
  brief: Brief
  creationId: string | null
  outline: Outline | null
  outlinesLeft: number | null
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function loadSaved(store: Store, userId: string): Saved | null {
  try {
    store.removeItem(SHARED_KEY)
    const raw = store.getItem(storeKey(userId))
    if (raw) {
      const s = JSON.parse(raw) as Saved
      if (briefSchema.safeParse(s.brief).success) return s
    }
  } catch {
    /* unavailable or corrupt: start fresh */
  }
  return null
}

export function saveState(store: Store, userId: string, s: Saved | null) {
  try {
    if (s) store.setItem(storeKey(userId), JSON.stringify(s))
    else store.removeItem(storeKey(userId))
  } catch {
    /* not remembered, that's fine */
  }
}

/**
 * The saved creation id points to nothing this account can read (deleted, or another account's):
 * true only once the server has answered so, not while loading or after a failed request.
 */
export function creationLost(creationId: string | null, query: { isSuccess: boolean; data: unknown }): boolean {
  return !!creationId && query.isSuccess && query.data === null
}

/** The browser's localStorage, reached only when used: reading the property itself can throw (blocked storage). */
export const browserStore: Store = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
  removeItem: (k) => localStorage.removeItem(k),
}
