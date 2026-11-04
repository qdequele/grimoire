// The in-game narrator: streams Claude's answer to the game engine's "Narrateur" panel.
//
// Response: text/event-stream with `data: {"text": "<delta>"}` events, then `data: {"done": true}`,
// or `data: {"error": {"code", "message"}}` if the answer fails midway. Errors before the stream
// starts are plain JSON with an HTTP status (401, 400, 429, 503).
//
// Secrets: ANTHROPIC_API_KEY (required). Optional: NARRATOR_MONTHLY_LIMIT (default 300).

import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import type { Database } from '../_shared/database.types.ts'
import { parseNarrateRequest, toApiMessages } from '../_shared/narrate.ts'

const MODEL = 'claude-opus-5-5'
const MONTHLY_LIMIT = Number(Deno.env.get('NARRATOR_MONTHLY_LIMIT') ?? 300)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const fail = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ error: { code, message } }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.')

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return fail(503, 'not_configured', "Le narrateur n'est pas configuré sur ce serveur.")

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const asUser = createClient<Database>(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: userData, error: userError } = await asUser.auth.getUser()
  if (userError || !userData.user) return fail(401, 'unauthorized', 'Reconnecte-toi pour utiliser le narrateur.')
  const userId = userData.user.id
  const admin = createClient<Database>(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  let messages: ReturnType<typeof parseNarrateRequest>
  try {
    messages = parseNarrateRequest(await req.json())
  } catch {
    return fail(400, 'bad_request', 'Body must be JSON.')
  }
  if (typeof messages === 'string') return fail(400, 'bad_request', messages)

  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', userId).single()
  if (!profile?.is_admin) {
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const { count } = await admin
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('kind', 'narrator')
      .gte('created_at', monthStart.toISOString())
    if ((count ?? 0) >= MONTHLY_LIMIT) {
      return fail(429, 'quota_exceeded', `Limite mensuelle du narrateur atteinte (${MONTHLY_LIMIT} réponses).`)
    }
  }

  const client = new Anthropic({ apiKey })
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // Low effort: the keeper is waiting at the table.
    output_config: { effort: 'low' },
    messages: toApiMessages(messages),
  })
  // The keeper pressed "stop" or closed the page.
  req.signal.addEventListener('abort', () => stream.abort())

  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') send({ text: event.delta.text })
        }
        const message = await stream.finalMessage()
        await admin.from('ai_usage').insert({
          owner_id: userId,
          kind: 'narrator',
          input_tokens: message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0),
          output_tokens: message.usage.output_tokens,
        })
        if (message.stop_reason === 'refusal') send({ error: { code: 'refused', message: 'Pas de réponse à cette demande.' } })
        else send({ done: true })
      } catch (e) {
        if (!req.signal.aborted) {
          console.error('narrate failed', e)
          const code = e instanceof Anthropic.RateLimitError ? 'rate_limited' : 'ai_error'
          send({ error: { code, message: "Le service d'IA n'a pas répondu." } })
        }
      } finally {
        controller.close()
      }
    },
  })
  return new Response(body, {
    headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
})
