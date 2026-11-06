// create-story Edge Function against the local stack, with a fake Claude API on ANTHROPIC_BASE_URL.
// Run with `pnpm test:import` (needs `supabase functions serve --env-file supabase/tests/functions.env`).
import { createServer, type Server } from 'node:http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../src/lib/database.types'
import { fakeAnswer, FAKE_IDEAS, FAKE_OUTLINE, FAKE_SCREEN } from './fake-creator'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const MOCK_PORT = Number(process.env.MOCK_ANTHROPIC_PORT ?? 4010)

const requests: Array<{ body: Record<string, unknown>; headers: Record<string, unknown> }> = []

/** Streams one Messages API response the way the real API does (SSE). */
function sse(text: string) {
  const events: Array<[string, unknown]> = [
    ['message_start', { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 500, output_tokens: 1, cache_read_input_tokens: 20000 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 700 } }],
    ['message_stop', { type: 'message_stop' }],
  ]
  return events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('')
}

let mock: Server
let user: SupabaseClient<Database>
let userId: string
const service = createClient<Database>(url, serviceKey, { auth: { persistSession: false } })

beforeAll(async () => {
  mock = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const body = JSON.parse(raw || '{}')
      requests.push({ body, headers: req.headers })
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.end(sse(fakeAnswer(body) ?? '{}'))
    })
  })
  await new Promise<void>((r) => mock.listen(MOCK_PORT, '0.0.0.0', r))
  user = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await user.auth.signUp({ email: `creator-${crypto.randomUUID()}@example.com`, password: 'correct-horse-battery' })
  if (error) throw error
  userId = data.user!.id
})

afterAll(() => new Promise<void>((r) => mock.close(() => r())))

// FUNCTIONS_URL: run against a function served elsewhere (e.g. `deno run` of index.ts).
const functionsUrl = process.env.FUNCTIONS_URL ?? `${url}/functions/v1`

async function invoke(body: Record<string, unknown>, client = user) {
  const { data: { session } } = await client.auth.getSession()
  const res = await fetch(`${functionsUrl}/create-story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${session?.access_token ?? anonKey}` },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

const brief = {
  lang: 'en', era: '', place: 'A mill town', tone: 'folk', threat: 'human', hook: 'People vanish.',
  ideas: '', avoid: 'spiders', investigators: 3, length: 'short',
}

describe('create-story', () => {
  it('suggests ideas only for the empty fields', async () => {
    const res = await invoke({ action: 'ideas', brief })
    expect(res.status).toBe(200)
    expect(res.body.ideas).toEqual({ era: FAKE_IDEAS.era, ideas: FAKE_IDEAS.ideas })
    const sent = requests.at(-1)!.body
    expect((sent.output_config as { effort: string }).effort).toBe('low')
    const { data } = await service.from('ai_usage').select('kind').eq('owner_id', userId)
    expect(data).toEqual([{ kind: 'story-ideas' }])
  })

  it('writes an outline, then the scenes in batches, into a private story with its pack', async () => {
    const outline = await invoke({ action: 'outline', brief })
    expect(outline.status).toBe(200)
    expect(outline.body.outline.title).toBe(FAKE_OUTLINE.title)
    expect(outline.body.outlinesLeft).toBe(4)
    const creationId = outline.body.creationId as string

    // What was sent: the answers, cached instructions, structured output, fallbacks
    const sent = requests.at(-1)!
    expect(sent.body.model).toBe('claude-opus-5-5')
    expect((sent.body.system as Array<{ cache_control?: unknown }>)[0].cache_control).toEqual({ type: 'ephemeral' })
    expect((sent.body.output_config as { format: { type: string } }).format.type).toBe('json_schema')
    expect(sent.body.fallbacks).toBe('default')
    expect(String(sent.headers['anthropic-beta'])).toContain('server-side-fallback-2026-07-01')
    expect(JSON.stringify(sent.body.messages)).toContain('spiders')

    // The keeper renames the story and drops a scene before writing
    const edited = { ...outline.body.outline, title: 'My Mill', acts: [outline.body.outline.acts[0], { ...outline.body.outline.acts[1], scenes: [] }] }
    const first = await invoke({ action: 'write', creationId, outline: edited })
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ written: 2, total: 2, remaining: 0, validationErrors: [] })
    expect(JSON.stringify(requests.at(-1)!.body.messages)).toContain('\\"arrival\\" (act \\"act-1\\"), \\"mill\\" (act \\"act-1\\")')

    const { data: story } = await user.from('stories').select('visibility, owner_id, title, content').eq('id', first.body.storyId).single()
    expect(story).toMatchObject({ visibility: 'private', owner_id: userId, title: 'My Mill' })
    const meta = (story!.content as { meta: Record<string, unknown> }).meta
    expect(meta).toMatchObject({ license: 'private', lang: 'en', players: { min: 2, max: 4 }, tags: ['grimoire-creator'], contentWarnings: ['missing people'] })
    const npc = (story!.content as { npcs: Array<Record<string, unknown>> }).npcs[0]
    expect(npc).toMatchObject({ id: 'miller', characteristics: { STR: 60 }, hp: 11 })
    // The model's choices for the ambiance screen reach the story
    const scenes = (story!.content as { acts: Array<{ scenes: Array<{ id: string; screen?: unknown }> }> }).acts.flatMap((x) => x.scenes)
    expect(scenes.map((sc) => [sc.id, sc.screen ?? null])).toEqual([['arrival', FAKE_SCREEN.arrival], ['mill', null]])
    const sceneSchema = JSON.stringify((requests.at(-1)!.body.output_config as { format: { schema: unknown } }).format.schema)
    expect(sceneSchema).toContain('"crypt"')
    expect(sceneSchema).toContain('"ritual"')

    // story.json written to the pack
    const { data: pack } = await service.storage.from('story-packs').download(`${userId}/${first.body.storyId}/story.json`)
    expect(JSON.parse(await pack!.text()).meta.title).toBe('My Mill')

    const { data: row } = await user.from('story_creations').select('status, story_id, outline_count').eq('id', creationId).single()
    expect(row).toEqual({ status: 'succeeded', story_id: first.body.storyId, outline_count: 1 })

    // Once written, the outline can't be redone
    expect((await invoke({ action: 'outline', creationId })).status).toBe(409)
  })

  it('writes long stories over several calls and revises an outline with notes', async () => {
    const outline = await invoke({ action: 'outline', brief })
    const creationId = outline.body.creationId as string
    const revised = await invoke({ action: 'outline', creationId, notes: 'Less gore' })
    expect(revised.body.outlinesLeft).toBe(3)
    expect(JSON.stringify(requests.at(-1)!.body.messages)).toContain('Less gore')

    const a = await invoke({ action: 'write', creationId })
    expect(a.body).toMatchObject({ written: 2, total: 3, remaining: 1 })
    const b = await invoke({ action: 'write', creationId })
    expect(b.body).toMatchObject({ written: 3, total: 3, remaining: 0, storyId: a.body.storyId })
    const { data } = await user.from('stories').select('content').eq('id', b.body.storyId).single()
    const acts = (data!.content as { acts: Array<{ id: string; scenes: Array<{ id: string }> }> }).acts
    expect(acts.map((x) => [x.id, x.scenes.map((s) => s.id)])).toEqual([['act-1', ['arrival', 'mill']], ['act-2', ['cellar']]])
  })

  it("can't touch someone else's creation, or work without a session", async () => {
    const other = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
    await other.auth.signUp({ email: `other-${crypto.randomUUID()}@example.com`, password: 'correct-horse-battery' })
    const { data } = await user.from('story_creations').select('id').limit(1).single()
    expect((await invoke({ action: 'write', creationId: data!.id }, other)).status).toBe(404)
    // RLS: the other keeper doesn't even see it
    const { data: seen } = await other.from('story_creations').select('id')
    expect(seen).toEqual([])

    const anon = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
    expect((await invoke({ action: 'outline', brief }, anon)).status).toBe(401)
  })

  it('enforces the monthly limit on new stories', async () => {
    await service.from('story_creations').insert(Array.from({ length: 10 }, () => ({ owner_id: userId, brief: {} })))
    const res = await invoke({ action: 'outline', brief })
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('quota_exceeded')
  })
})
