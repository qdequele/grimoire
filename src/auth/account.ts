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
 * Called with every session the app learns of (start-up, sign-in, token refresh, sign-out; null:
 * signed out). When the account that was signed in is gone (signed out, session ended, also while
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
