// AI help for the investigator profile (creation wizard, step 6).
//
// The browser sends what the wizard knows (occupation, characteristics, best skills, link, fields
// already written). Claude proposes the six profile statements; the function returns only the
// fields that were empty, or the single field asked for. Monthly limit per account.
//
// Secrets: ANTHROPIC_API_KEY (required). Optional: PROFILE_MONTHLY_LIMIT (default 50).

import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import type { Database } from '../_shared/database.types.ts'
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
  const { data: userData, error: userError } = await asUser.auth.getUser()
  if (userError || !userData.user) return fail(401, 'unauthorized', 'Connecte-toi pour utiliser l’aide IA.')
  const userId = userData.user.id
  const admin = createClient<Database>(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  let input: ReturnType<typeof parseProfileRequest>
  try {
    input = parseProfileRequest(await req.json())
  } catch {
    return fail(400, 'bad_request', 'Body must be JSON.')
  }
  if (typeof input === 'string') return fail(400, 'bad_request', input)

  try {
    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', userId).single()
    if (!profile?.is_admin) {
      const monthStart = new Date()
      monthStart.setUTCDate(1)
      monthStart.setUTCHours(0, 0, 0, 0)
      const { count, error } = await admin
        .from('ai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .eq('kind', 'profile')
        .gte('created_at', monthStart.toISOString())
      if (error) throw error
      if ((count ?? 0) >= MONTHLY_LIMIT) {
        return fail(429, 'quota_exceeded', `Limite mensuelle atteinte (${MONTHLY_LIMIT} suggestions).`)
      }
    }

    const client = new Anthropic({ apiKey })
    const message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format },
      system: PROFILE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: profileUserPrompt(input) }],
    })

    await admin.from('ai_usage').insert({
      owner_id: userId,
      kind: 'profile',
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    })

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
