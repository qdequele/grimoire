// AI help for the investigator profile (creation wizard, step 6).
//
// The browser sends what the wizard knows (occupation, characteristics, best skills, link, fields
// already written), with the keeper's session or, from a player's phone, the table link as `link`
// (the game owner's quota then applies). Claude proposes the six profile statements; the function returns only the
// fields that were empty, or the single field asked for. Monthly limit per account: the call is
// reserved in ai_usage before Claude is asked (_shared/ai-usage.ts), so calls made at once can't pass it.
//
// Secrets: ANTHROPIC_API_KEY (required). Optional: PROFILE_MONTHLY_LIMIT (default 50).

import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import type { Database } from '../_shared/database.types.ts'
import { recordUsage, refusedUpstream, releaseUsage, reserveUsage } from '../_shared/ai-usage.ts'
import {
  parseProfileRequest,
  pickSuggestions,
  PROFILE_SYSTEM_PROMPT,
  profileSchema,
  profileUserPrompt,
  type Profile,
} from '../_shared/profile.ts'

const MODEL = 'claude-opus-5-5'
const MONTHLY_LIMIT = Number(Deno.env.get('PROFILE_MONTHLY_LIMIT') ?? 50)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, status)

const format = { type: 'json_schema' as const, schema: profileSchema() }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.')

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return fail(503, 'not_configured', "L'aide IA n'est pas configurée sur ce serveur.")

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const asUser = createClient<Database>(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const admin = createClient<Database>(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const body: unknown = await req.json().catch(() => undefined)

  // The keeper's session, or a player's table link (no account): then the game owner's quota.
  const { data: userData } = await asUser.auth.getUser()
  let userId = userData.user?.id
  const link = body && typeof body === 'object' ? (body as { link?: unknown }).link : undefined
  if (!userId && typeof link === 'string') {
    const { data: owner, error } = await admin.rpc('companion_owner', { p_token: link })
    // An unknown or revoked link: the RPC raises `link_invalid` (or returns null).
    if ((error && error.message === 'link_invalid') || (!error && !owner)) {
      return fail(401, 'link_invalid', "Ce lien n'est plus valide.")
    }
    if (error) {
      console.error('companion_owner failed', error)
      return fail(500, 'internal', 'Suggestion impossible.')
    }
    userId = owner!
  }
  if (!userId) return fail(401, 'unauthorized', 'Connecte-toi pour utiliser l’aide IA.')

  if (body === undefined) return fail(400, 'bad_request', 'Body must be JSON.')
  const input = parseProfileRequest(body)
  if (typeof input === 'string') return fail(400, 'bad_request', input)

  try {
    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', userId).single()
    // Reserved before the call (admins: no limit, still recorded).
    const usageId = await reserveUsage(admin, userId, 'profile', profile?.is_admin ? null : MONTHLY_LIMIT)
    if (!usageId) return fail(429, 'quota_exceeded', `Limite mensuelle atteinte (${MONTHLY_LIMIT} suggestions).`)

    const client = new Anthropic({ apiKey })
    let message: Anthropic.Beta.BetaMessage
    try {
      message = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format },
        system: PROFILE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: profileUserPrompt(input) }],
      })
    } catch (e) {
      // The AI service refused the call: nothing generated, the reservation is given back.
      if (refusedUpstream(e)) await releaseUsage(admin, usageId)
      throw e
    }
    await recordUsage(admin, usageId, { input: message.usage.input_tokens, output: message.usage.output_tokens })

    if (message.stop_reason === 'refusal') return fail(422, 'refused', 'Pas de suggestion possible pour ce profil.')
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    let output: Partial<Profile>
    try {
      output = JSON.parse(text) as Partial<Profile>
    } catch {
      return fail(502, 'invalid_output', 'Réponse de l’IA illisible. Réessaie.')
    }
    return json({ suggestions: pickSuggestions(input, output) })
  } catch (e) {
    console.error('suggest-profile failed', e)
    if (e instanceof Anthropic.RateLimitError) return fail(429, 'busy', "Le service d'IA est occupé. Réessaie dans une minute.")
    if (e instanceof Anthropic.APIError) return fail(502, 'ai_error', `Erreur du service d'IA (${e.status ?? 'réseau'}).`)
    return fail(500, 'internal', 'Suggestion impossible.')
  }
})
