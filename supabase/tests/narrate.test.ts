// narrate Edge Function against the local stack, with a fake Claude API (streaming) on ANTHROPIC_BASE_URL.
// Run with `pnpm test:import` (needs `supabase functions serve --env-file supabase/tests/functions.env`).
import { createServer, type Server } from 'node:http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../src/lib/database.types'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const MOCK_PORT = Number(process.env.MOCK_ANTHROPIC_PORT ?? 4010)

const PIECES = ['La pluie ', 'redouble ', 'sur le port.']
const requests: Array<Record<string, unknown>> = []
/** For one test: the fake Claude streams slowly (ms between events), or answers with an HTTP error. */
const fake = { gapMs: 0, status: 200, pieces: PIECES }

function sse(pieces: string[]): string[] {
  const ev = (e: string, d: unknown) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`
  return [
    ev('message_start', { type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 400, output_tokens: 1, cache_read_input_tokens: 9000 } } }),
    ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
    ...pieces.map((text) => ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })),
    ev('content_block_stop', { type: 'content_block_stop', index: 0 }),
    ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 12 } }),
    ev('message_stop', { type: 'message_stop' }),
  ]
}

let mock: Server
let token: string
let userId: string
const service = createClient<Database>(url, serviceKey, { auth: { persistSession: false } })

beforeAll(async () => {
  mock = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      requests.push(JSON.parse(raw || '{}'))
      const { gapMs, status } = fake
      if (status !== 200) {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'refused by the fake API' } }))
        return
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      const events = sse(fake.pieces)
      if (!gapMs) return res.end(events.join(''))
      const next = () => {
        if (res.destroyed) return
        res.write(events.shift())
        if (events.length) setTimeout(next, gapMs)
        else res.end()
      }
      next()
    })
  })
  await new Promise<void>((r) => mock.listen(MOCK_PORT, '0.0.0.0', r))
  const user: SupabaseClient<Database> = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await user.auth.signUp({ email: `narrator-${crypto.randomUUID()}@example.com`, password: 'correct-horse-battery' })
  if (error) throw error
  token = data.session!.access_token
  userId = data.user!.id
})

afterAll(() => new Promise<void>((r) => mock.close(() => r())))
afterEach(() => Object.assign(fake, { gapMs: 0, status: 200, pieces: PIECES }))

const post = (body: unknown, auth: string, signal?: AbortSignal) =>
  fetch(`${url}/functions/v1/narrate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth}`, apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

const counted = async () =>
  (await service.from('ai_usage').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('kind', 'narrator')).count

async function narrate(body: unknown, auth = token) {
  const res = await post(body, auth)
  return { status: res.status, text: await res.text() }
}

const conversation = {
  messages: [
    { role: 'user', content: 'Tu assistes le gardien.\n\nRÈGLES…\n\nCONTEXTE ACTUEL DE LA PARTIE :\nScène « Le port »' },
    { role: 'assistant', content: 'Bien.' },
    { role: 'user', content: 'Décris la scène.' },
  ],
}

describe('narrate', () => {
  it('streams the answer piece by piece, then done', async () => {
    const res = await narrate(conversation)
    expect(res.status).toBe(200)
    const events = res.text.split('\n\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)))
    expect(events.filter((e) => e.text).map((e) => e.text)).toEqual(PIECES)
    expect(events.at(-1)).toEqual({ done: true })
  })

  it('caches the engine instructions and sends the game context fresh', () => {
    const sent = requests.at(-1)!
    expect(sent.model).toBe('claude-opus-5-5')
    expect(sent.stream).toBe(true)
    const first = (sent.messages as Array<{ content: Array<{ text: string; cache_control?: unknown }> }>)[0].content
    expect(first[0]).toMatchObject({ text: 'Tu assistes le gardien.\n\nRÈGLES…', cache_control: { type: 'ephemeral' } })
    expect(first[1].text).toContain('Scène « Le port »')
  })

  it('counts the answer for the monthly limit', async () => {
    const { data } = await service.from('ai_usage').select('kind, input_tokens').eq('owner_id', userId)
    expect(data).toEqual([{ kind: 'narrator', input_tokens: 9400 }])
  })

  it('rejects bad conversations and missing sessions', async () => {
    expect((await narrate({ messages: [{ role: 'assistant', content: 'x' }] })).status).toBe(400)
    expect((await narrate(conversation, anonKey)).status).toBe(401)
  })

  it('counts an answer the keeper stopped', async () => {
    // A long answer (30 pieces, 4.5 s), stopped after its first piece
    Object.assign(fake, { gapMs: 150, pieces: Array.from({ length: 30 }, (_, i) => `mot${i} `) })
    const stop = new AbortController()
    const res = await post(conversation, token, stop.signal)
    const reader = res.body!.getReader()
    const first = new TextDecoder().decode((await reader.read()).value)
    expect(first).toContain('mot0 ')
    stop.abort()
    await reader.closed.catch(() => undefined)
    // Counted as soon as it started; and still once, well after the answer would have ended
    expect(await counted()).toBe(2)
    await new Promise((r) => setTimeout(r, 6000))
    expect(await counted()).toBe(2)
  })

  it("doesn't count an answer the AI service refused to start", async () => {
    fake.status = 400
    const before = requests.length
    const res = await narrate(conversation)
    expect(res.status).toBe(200)
    expect(JSON.parse(res.text.trim().slice(5)).error.code).toBe('ai_error')
    expect(requests.length - before).toBe(1)
    expect(await counted()).toBe(2)
  })

  it('reserves the answer before it starts: calls at once stay under the limit', async () => {
    // One answer left this month. Four calls at once: one answer, three refusals, Claude called once.
    await service.from('ai_usage').insert(Array.from({ length: 299 - (await counted())! }, () => ({ owner_id: userId, kind: 'narrator' })))
    fake.gapMs = 100
    const before = requests.length
    const answers = await Promise.all(Array.from({ length: 4 }, () => narrate(conversation)))
    expect(answers.map((a) => a.status).sort()).toEqual([200, 429, 429, 429])
    expect(requests.length - before).toBe(1)
    expect(await counted()).toBe(300)
  })

  it('enforces the monthly limit', async () => {
    await service.from('ai_usage').insert(Array.from({ length: 300 }, () => ({ owner_id: userId, kind: 'narrator' })))
    const res = await narrate(conversation)
    expect(res.status).toBe(429)
    expect(JSON.parse(res.text).error.code).toBe('quota_exceeded')
  })
})
