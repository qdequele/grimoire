// The monthly limits counted in ai_usage (profile suggestions, narrator answers, story ideas, maps).
//
// A call is RESERVED before Claude is asked: reserve_ai_usage (a service-role RPC) counts the
// month's rows and inserts one under a lock, so calls made at the same time can't all pass the
// limit, and a call that is stopped or fails after Claude started still counts. The tokens are
// written on the reserved row afterwards. Only a call the AI service refused outright (an HTTP
// error: nothing generated, nothing billed) gives its reservation back.
import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import type { Database } from './database.types.ts'

type Admin = SupabaseClient<Database>
export type UsageKind = 'profile' | 'narrator' | 'story-ideas' | 'map'

/** The first instant of this month (UTC): the limits count from there. */
export const monthStart = () => {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * Reserve one call of this kind for this month. The row's id, or null when the limit is reached.
 * `limit` null: no limit (admins), the call is still recorded.
 */
export async function reserveUsage(admin: Admin, ownerId: string, kind: UsageKind, limit: number | null): Promise<string | null> {
  const { data, error } = await admin.rpc('reserve_ai_usage', { p_owner: ownerId, p_kind: kind, p_since: monthStart(), ...(limit === null ? {} : { p_limit: limit }) })
  if (error) throw error
  return data ?? null
}

/** Write what the call used on its reserved row. Best effort: the row already counts. */
export async function recordUsage(admin: Admin, id: string, tokens: { input: number; output: number }) {
  const { error } = await admin.from('ai_usage').update({ input_tokens: tokens.input, output_tokens: tokens.output }).eq('id', id)
  if (error) console.error('ai_usage update failed', error)
}

/** Give a reservation back (the call cost nothing). */
export async function releaseUsage(admin: Admin, id: string) {
  const { error } = await admin.from('ai_usage').delete().eq('id', id)
  if (error) console.error('ai_usage release failed', error)
}

/**
 * True when the AI service answered the request itself with an HTTP error (bad request, rate
 * limit, overload): nothing was generated. A timeout, a cut connection or an error in the middle
 * of the stream has no status and may have been billed: those keep their reservation.
 */
export const refusedUpstream = (e: unknown) => e instanceof Anthropic.APIError && typeof e.status === 'number'
