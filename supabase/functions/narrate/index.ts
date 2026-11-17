// The in-game narrator: streams Claude's answer to the game engine's "Narrateur" panel.
//
// Response: text/event-stream with `data: {"text": "<delta>"}` events, then `data: {"done": true}`,
// or `data: {"error": {"code", "message"}}` if the answer fails midway. Errors before the stream
// starts are plain JSON with an HTTP status (401, 400, 429, 503).
//
// The answer is counted when it STARTS: a row is reserved in ai_usage before Claude is asked
// (_shared/ai-usage.ts), so an answer the keeper stops, one that is cut midway and answers asked at
// the same time all count against the monthly limit. Only an answer the AI service refused before
// writing anything gives its reservation back.
//
// Secrets: ANTHROPIC_API_KEY (required). Optional: NARRATOR_MONTHLY_LIMIT (default 300).

import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import type { Database } from '../_shared/database.types.ts'
import { recordUsage, releaseUsage, reserveUsage } from '../_shared/ai-usage.ts'
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
  // Reserved before the answer starts (admins: no limit, still recorded).
  let usageId: string | null
  try {
    usageId = await reserveUsage(admin, userId, 'narrator', profile?.is_admin ? null : MONTHLY_LIMIT)
  } catch (e) {
    console.error('narrate: reservation failed', e)
    return fail(503, 'unavailable', 'Le narrateur est indisponible pour le moment. Réessaie.')
  }
  if (!usageId) return fail(429, 'quota_exceeded', `Limite mensuelle du narrateur atteinte (${MONTHLY_LIMIT} réponses).`)
  const reserved = usageId

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
      // What the answer used so far, read from the stream: a stopped answer has no final message.
      const usage = { input: 0, output: 0 }
      let started = false
      let release = false
      try {
        for await (const event of stream) {
          if (event.type === 'message_start') {
            started = true
            usage.input = event.message.usage.input_tokens + (event.message.usage.cache_read_input_tokens ?? 0)
            usage.output = event.message.usage.output_tokens
          } else if (event.type === 'message_delta') {
            usage.output = event.usage.output_tokens
          } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            send({ text: event.delta.text })
          }
        }
        const message = await stream.finalMessage()
        if (message.stop_reason === 'refusal') send({ error: { code: 'refused', message: 'Pas de réponse à cette demande.' } })
        else send({ done: true })
      } catch (e) {
        // The AI service failed before the answer started, and the keeper didn't stop it: not counted.
        release = !started && !req.signal.aborted
        // Whatever broke the loop (the keeper gone, the AI service), stop paying for the rest.
        stream.abort()
        if (!req.signal.aborted) {
          console.error('narrate failed', e)
          const code = e instanceof Anthropic.RateLimitError ? 'rate_limited' : 'ai_error'
          try {
            send({ error: { code, message: "Le service d'IA n'a pas répondu." } })
          } catch {
            /* the keeper is gone */
          }
        }
      } finally {
        // Best effort: after a stop the runtime may end the worker first; the reserved row counts anyway.
        if (release) await releaseUsage(admin, reserved)
        else if (started) await recordUsage(admin, reserved, usage)
        try {
          controller.close()
        } catch {
          /* already closed by the keeper's stop */
        }
      }
    },
  })
  return new Response(body, {
    headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
})
