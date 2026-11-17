// End-to-end test of the import-story Edge Function against the local stack, with a fake Claude API.
//
// A tiny HTTP server stands in for api.anthropic.com and streams back a fixed draft
// (fixtures/draft-batch.json). The function reaches it through ANTHROPIC_BASE_URL, so the
// function code is the real one. Run with `pnpm test:import` (see package.json).
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../src/lib/database.types'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const MOCK_PORT = Number(process.env.MOCK_ANTHROPIC_PORT ?? 4010)

const draft = readFileSync(new URL('./fixtures/draft-batch.json', import.meta.url), 'utf8')
const requests: Array<{ body: Record<string, unknown>; headers: Record<string, unknown> }> = []
/** How the fake Claude answers the next requests (reset after each test): the fixture draft by default. */
let reply: { text?: string; status?: number; before?: () => Promise<void> } = {}

/** Streams one Messages API response the way the real API does (SSE). */
function sse(text: string) {
  const events: Array<[string, unknown]> = [
    ['message_start', { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 1, cache_read_input_tokens: 30000 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 900 } }],
    ['message_stop', { type: 'message_stop' }],
  ]
  return events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('')
}

let mock: Server
let user: SupabaseClient<Database>
let userId: string
const service = createClient<Database>(url, serviceKey, { auth: { persistSession: false } })
const png = () => new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })

beforeAll(async () => {
  mock = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', async () => {
      requests.push({ body: JSON.parse(raw || '{}'), headers: req.headers })
      const { text, status, before } = reply
      await before?.()
      if (status) {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'test' } }))
        return
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.end(sse(text ?? draft))
    })
  })
  await new Promise<void>((r) => mock.listen(MOCK_PORT, '0.0.0.0', r))

  user = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await user.auth.signUp({ email: `importer-${crypto.randomUUID()}@example.com`, password: 'correct-horse-battery' })
  if (error) throw error
  userId = data.user!.id
})

afterAll(() => new Promise<void>((r) => mock.close(() => r())))
afterEach(() => {
  reply = {}
})

async function invoke(body: Record<string, unknown>, as: SupabaseClient<Database> = user) {
  const { data, error } = await as.functions.invoke('import-story', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    return { status: ctx?.status ?? 0, body: ctx ? await ctx.json() : null }
  }
  return { status: 200, body: data }
}

describe('import-story', () => {
  it('turns uploaded pages into a private story and deletes the pages', async () => {
    const folder = `${userId}/${crypto.randomUUID()}`
    const paths = [`${folder}/001.png`, `${folder}/002.png`]
    for (const p of paths) {
      const { error } = await user.storage.from('import-pages').upload(p, png(), { contentType: 'image/png' })
      expect(error).toBeNull()
    }

    const res = await invoke({ pagePaths: paths, firstPage: 1, totalPages: 2, lang: 'en', title: 'My clock story' })
    expect(res.status).toBe(200)
    expect(res.body.validationErrors).toEqual([])
    expect(res.body.story.meta).toMatchObject({ title: 'My clock story', lang: 'en', license: 'private' })
    expect(res.body.story.acts[0].scenes[0].ambience).toEqual(['clock', 'rain-window'])
    expect(res.body.story.npcs[0]).toMatchObject({ characteristics: { DEX: 70 }, hp: 9, skills: { 'mechanical-repair': 80 } })

    // Saved as the caller's private story
    const { data: saved } = await user.from('stories').select('visibility, owner_id, title').eq('id', res.body.storyId).single()
    expect(saved).toEqual({ visibility: 'private', owner_id: userId, title: 'My clock story' })

    // Pages are gone from storage
    const { data: left } = await service.storage.from('import-pages').list(folder)
    expect(left).toEqual([])

    // Quota row recorded
    const { data: imp } = await user.from('story_imports').select('status, page_count').eq('id', res.body.importId).single()
    expect(imp).toEqual({ status: 'succeeded', page_count: 2 })
    // … and what the Importer page shows as "pages imported this month"
    const { data: used } = await user.rpc('import_pages_used', { p_owner: userId })
    expect(used).toBe(2)

    // What was sent to Claude: images, the draft schema as text (its grammar is too large for a
    // structured output), cached instructions, fallbacks
    const sent = requests.at(-1)!
    expect(sent.body.model).toBe('claude-opus-5-5')
    const content = (sent.body.messages as Array<{ content: Array<{ type: string }> }>)[0].content
    expect(content.filter((b) => b.type === 'image')).toHaveLength(2)
    expect(sent.body.output_config).toEqual({ effort: 'medium' })
    expect(JSON.stringify(content)).toContain('ANSWER FORMAT')
    expect((sent.body.system as Array<{ cache_control?: unknown }>)[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(sent.body.fallbacks).toBe('default')
    expect(String(sent.headers['anthropic-beta'])).toContain('server-side-fallback-2026-07-01')
  })

  it('adds a second batch to the same story', async () => {
    const folder = `${userId}/${crypto.randomUUID()}`
    await user.storage.from('import-pages').upload(`${folder}/001.png`, png(), { contentType: 'image/png' })
    const first = await invoke({ pagePaths: [`${folder}/001.png`], firstPage: 1, totalPages: 2, lang: 'en' })
    await user.storage.from('import-pages').upload(`${folder}/002.png`, png(), { contentType: 'image/png' })
    const second = await invoke({ importId: first.body.importId, pagePaths: [`${folder}/002.png`], firstPage: 2, totalPages: 2, lang: 'en' })
    expect(second.status).toBe(200)
    expect(second.body.storyId).toBe(first.body.storyId)
    // The second call told Claude what already exists, so ids stay consistent
    const prompt = JSON.stringify(requests.at(-1)!.body.messages)
    expect(prompt).toContain('front-room')
    expect(prompt).toContain('pages 2-2 of 2')
  })

  it("refuses pages outside the caller's folder", async () => {
    const res = await invoke({ pagePaths: ['someone-else/x/001.png'], lang: 'en' })
    expect(res.status).toBe(403)
  })

  it('rejects requests without a session', async () => {
    const anon = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
    const { error } = await anon.functions.invoke('import-story', { body: { pagePaths: ['a'], lang: 'en' } })
    expect((error as { context?: Response }).context?.status).toBe(401)
  })

  it('enforces the monthly page limit', async () => {
    // Fill the quota directly (the function counts this month's pages).
    await service.from('story_imports').insert({ owner_id: userId, page_count: 1000, status: 'succeeded' })
    const folder = `${userId}/${crypto.randomUUID()}`
    await user.storage.from('import-pages').upload(`${folder}/001.png`, png(), { contentType: 'image/png' })
    const res = await invoke({ pagePaths: [`${folder}/001.png`], lang: 'en' })
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('quota_exceeded')
    // Even a refused page is deleted
    const { data: left } = await service.storage.from('import-pages').list(folder)
    expect(left).toEqual([])
  })

  // ---- quota accounting, each test with its own keeper
  async function keeper() {
    const client = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
    const { data, error } = await client.auth.signUp({ email: `importer-${crypto.randomUUID()}@example.com`, password: 'correct-horse-battery' })
    if (error) throw error
    const id = data.user!.id
    /** Uploads n pages and returns their paths. */
    const pages = async (n: number) => {
      const folder = `${id}/${crypto.randomUUID()}`
      const paths = Array.from({ length: n }, (_, i) => `${folder}/${String(i + 1).padStart(3, '0')}.png`)
      for (const p of paths) await client.storage.from('import-pages').upload(p, png(), { contentType: 'image/png' })
      return { folder, paths }
    }
    /** Pages counted the old way (story_imports.page_count), as before batches were recorded. */
    const earlier = async (pageCount: number, createdAt = new Date()) => {
      const { data: row, error: e } = await service
        .from('story_imports')
        .insert({ owner_id: id, page_count: pageCount, status: 'succeeded', created_at: createdAt.toISOString() })
        .select('id')
        .single()
      if (e) throw e
      return row.id
    }
    const lastImport = async () =>
      (await service.from('story_imports').select('status, error, page_count').eq('owner_id', id).order('created_at', { ascending: false }).limit(1).single()).data
    return { client, id, pages, earlier, lastImport }
  }

  it('counts pages added this month to an import started in an earlier month', async () => {
    const k = await keeper()
    const old = await k.earlier(0, new Date(Date.now() - 40 * 24 * 3600 * 1000))
    await k.earlier(58)
    // 58 + 2 = the limit of 60: accepted, and counted although the import's row is last month's
    const first = await invoke({ importId: old, pagePaths: (await k.pages(2)).paths, lang: 'en' }, k.client)
    expect(first.status).toBe(200)
    const second = await invoke({ importId: old, pagePaths: (await k.pages(1)).paths, lang: 'en' }, k.client)
    expect(second.status).toBe(429)
    expect(second.body.error).toMatchObject({ code: 'quota_exceeded', message: expect.stringContaining('60/60') })
  })

  it('does not count the pages of earlier months', async () => {
    const k = await keeper()
    await k.earlier(1000, new Date(Date.now() - 40 * 24 * 3600 * 1000))
    const res = await invoke({ pagePaths: (await k.pages(1)).paths, lang: 'en' }, k.client)
    expect(res.status).toBe(200)
  })

  it('counts a batch Claude answered but that could not be used', async () => {
    const k = await keeper()
    await k.earlier(59)
    reply = { text: 'not a draft' }
    const unreadable = await invoke({ pagePaths: (await k.pages(1)).paths, lang: 'en' }, k.client)
    expect(unreadable.status).toBe(502)
    expect(unreadable.body.error.code).toBe('invalid_output')
    reply = {}
    const next = await invoke({ pagePaths: (await k.pages(1)).paths, lang: 'en' }, k.client)
    expect(next.status).toBe(429)
  })

  it('does not count a batch the AI service turned down, and marks the import failed', async () => {
    const k = await keeper()
    await k.earlier(59)
    reply = { status: 400 }
    const refused = await invoke({ pagePaths: (await k.pages(1)).paths, lang: 'en' }, k.client)
    expect(refused.status).toBe(502)
    expect(refused.body.error.code).toBe('ai_error')
    expect(await k.lastImport()).toMatchObject({ status: 'failed', error: 'ai_error', page_count: 0 })
    reply = {}
    const next = await invoke({ pagePaths: (await k.pages(1)).paths, lang: 'en' }, k.client)
    expect(next.status).toBe(200)
  })

  it('has deleted the pages before Claude is asked', async () => {
    const k = await keeper()
    const { folder, paths } = await k.pages(2)
    let duringCall: unknown
    reply = { before: async () => void (duringCall = (await service.storage.from('import-pages').list(folder)).data) }
    const res = await invoke({ pagePaths: paths, lang: 'en' }, k.client)
    expect(res.status).toBe(200)
    expect(duringCall).toEqual([])
  })

  // The functions are served with a short deadline (IMPORT_AI_DEADLINE_MS in functions.env): the
  // fake Claude answers after it.
  it('stops waiting for Claude at the deadline', async () => {
    const k = await keeper()
    const deadline = Number(readFileSync(new URL('./functions.env', import.meta.url), 'utf8').match(/^IMPORT_AI_DEADLINE_MS=(\d+)$/m)?.[1])
    expect(deadline).toBeGreaterThan(0)
    reply = { before: () => new Promise((r) => setTimeout(r, deadline + 5000)) }
    const res = await invoke({ pagePaths: (await k.pages(1)).paths, lang: 'en' }, k.client)
    expect(res.status).toBe(504)
    expect(res.body.error.code).toBe('timeout')
    expect(await k.lastImport()).toMatchObject({ status: 'failed', error: 'timeout' })
    // The tokens were spent: the page counts
    const { data: used } = await k.client.rpc('import_pages_used', { p_owner: k.id })
    expect(used).toBe(1)
  }, 60_000)
})
