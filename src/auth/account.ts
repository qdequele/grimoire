import { isAuthRetryableFetchError, type AuthChangeEvent } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'
import { KEEPER_DRAFT_KEY } from '@/characters/wizard/host'
import { forgetNext } from './oauth'

// Signing out doesn't reload the page, and several keepers may share one browser. What the app
// keeps for the signed-in keeper outside the session (the query cache, the unfinished investigator
// of /characters/new, the page to return to after sign-in) must not be there for the next account.

/** The account this browser last had signed in (its user id), removed at sign-out. */
const ACCOUNT_KEY = 'grimoire-account'

/** What this tab last saw: another tab may already have updated the stored id (a sign-out made there). */
let seen: string | null = null

function storedAccount(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_KEY)
  } catch {
    return null
  }
}

/**
 * Called (through followSession) with every session the app learns of (start-up, sign-in, token
 * refresh, sign-out; null: signed out). When the account that was signed in is gone (signed out, session ended, also while
 * the site was closed) or another one takes its place, empties what the first one left.
 *
 * Signing in from a signed-out browser empties nothing: the public investigator tool writes its
 * draft under the keeper's key before sign-up, and `rememberNext` is written before sign-in.
 * The game screen's browser copies (`grimoire-game-<id>`) stay: they are only read once the game
 * row has loaded under RLS, and may hold a save that never reached the server.
 */
export function followAccount(userId: string | null, queryClient: QueryClient): void {
  const known = seen ?? storedAccount()
  seen = userId
  if (known === userId) return
  if (known !== null) {
    // Not clear(): pages already on screen (the login page's Google button) keep their queries, emptied and refetched.
    void queryClient.resetQueries()
    forgetNext()
  }
  try {
    if (known !== null) localStorage.removeItem(KEEPER_DRAFT_KEY)
    if (userId) localStorage.setItem(ACCOUNT_KEY, userId)
    else localStorage.removeItem(ACCOUNT_KEY)
  } catch {
    // Storage blocked: nothing was kept there either.
  }
}

/** Where the app learnt of a session: the start-up read (`getSession`, with its error) or an Auth event. */
export type SessionSource = AuthChangeEvent | 'getSession'

/**
 * Whether "no session" from this source means the account is really gone. Not at start-up when the
 * session could not be checked: with an expired access token and no network (or Supabase answering
 * 502/503/504), Auth reports no session and a retryable error but keeps the session, and the keeper
 * is signed in again at the next load. `INITIAL_SESSION` carries no error, so `getSession` decides.
 */
export function accountGone(source: SessionSource, error?: unknown): boolean {
  if (source === 'getSession') return !isAuthRetryableFetchError(error)
  return source !== 'INITIAL_SESSION'
}

/**
 * What `AuthProvider` calls with every session it learns of: `followAccount`, except for a missing
 * session that is no sign-out (`accountGone`). The stored account id then stays, so the same keeper
 * coming back keeps everything and another account signing in still gets nothing.
 */
export function followSession(source: SessionSource, userId: string | null, queryClient: QueryClient, error?: unknown): void {
  if (userId === null && !accountGone(source, error)) return
  followAccount(userId, queryClient)
}
