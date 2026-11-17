// create-story Edge Function against the local stack, with a fake Claude API on ANTHROPIC_BASE_URL.
// Run with `pnpm test:import` (needs `supabase functions serve --env-file supabase/tests/functions.env`).
import { createServer, type Server } from 'node:http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../src/lib/database.types'
import { fakeAnswer, FAKE_IDEAS, FAKE_OUTLINE, FAKE_SCREEN } from './fake-creator'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const MOCK_PORT = Number(process.env.MOCK_ANTHROPIC_PORT ?? 4010)

const requests: Array<{ body: Record<string, unknown>; headers: Record<string, unknown> }> = []
/** For one test: the fake Claude answers late, with another text, or with an HTTP error. */
const fake = { delayMs: 0, text: null as string | null, status: 200 }
/** Calls Claude received whose structured output has this property (the kind of answer asked for). */
const callsAsking = (property: string) =>
  requests.filter((r) => property in ((r.body.output_config as { format?: { schema?: { properties?: object } } } | undefined)?.format?.schema?.properties ?? {})).length

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
      const { delayMs, text, status } = fake
      setTimeout(() => {
        if (status !== 200) {
          res.writeHead(status, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'refused by the fake API' } }))
          return
        }
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.end(sse(text ?? fakeAnswer(body) ?? '{}'))
      }, delayMs)
    })
  })
  await new Promise<void>((r) => mock.listen(MOCK_PORT, '0.0.0.0', r))
  user = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await user.auth.signUp({ email: `creator-${crypto.randomUUID()}@example.com`, password: 'correct-horse-battery' })
  if (error) throw error
  userId = data.user!.id
})

afterAll(() => new Promise<void>((r) => mock.close(() => r())))
afterEach(() => Object.assign(fake, { delayMs: 0, text: null, status: 200 }))

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

/** Several calls at once. */
const burst = (n: number, body: Record<string, unknown>) => Promise.all(Array.from({ length: n }, () => invoke(body)))

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
    expect(sent.model).toBe('claude-haiku-5-5')
    expect(sent.fallbacks).toBeUndefined() // no server-side fallback on Haiku
    const { data } = await service.from('ai_usage').select('kind').eq('owner_id', userId)
    expect(data).toEqual([{ kind: 'story-ideas' }])
  })

  it('writes an outline in two calls, then the scenes one by one, into a private story with its pack', async () => {
    const frame = await invoke({ action: 'outline', brief })
    expect(frame.status).toBe(200)
    expect(frame.body.outline.title).toBe(FAKE_OUTLINE.title)
    expect(frame.body.outline.acts[0].scenes[0].clues).toEqual([])
    expect(frame.body.outlinesLeft).toBe(4)
    const creationId = frame.body.creationId as string

    // What was sent: the answers, cached instructions, structured output, fallbacks
    const sent = requests.at(-1)!
    expect(sent.body.model).toBe('claude-sonnet-5-5')
    expect((sent.body.system as Array<{ cache_control?: unknown }>)[0].cache_control).toEqual({ type: 'ephemeral' })
    expect((sent.body.output_config as { format: { type: string } }).format.type).toBe('json_schema')
    expect(sent.body.fallbacks).toBe('default')
    expect(String(sent.headers['anthropic-beta'])).toContain('server-side-fallback-2026-07-01')
    expect(JSON.stringify(sent.body.messages)).toContain('spiders')

    // Second call: clues, links and overview, from the stored frame
    const outline = await invoke({ action: 'outline-details', creationId })
    expect(outline.status).toBe(200)
    expect(outline.body.outline).toEqual(FAKE_OUTLINE)
    expect(outline.body.outlinesLeft).toBe(4)
    expect(JSON.stringify(requests.at(-1)!.body.messages)).toContain('For EVERY scene')

    // The keeper renames the story and drops a scene before writing
    const edited = { ...outline.body.outline, title: 'My Mill', acts: [outline.body.outline.acts[0], { ...outline.body.outline.acts[1], scenes: [] }] }
    const first = await invoke({ action: 'write', creationId, outline: edited })
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ written: 1, total: 2, remaining: 1, validationErrors: [] })
    const scenesCall = requests.at(-1)!.body
    expect(JSON.stringify(scenesCall.messages)).toContain('these scenes in full, and only these: \\"arrival\\" (act \\"act-1\\").')
    // No structured output for the scenes (the draft grammar is too large): the schema is in the prompt
    expect(scenesCall.output_config).toEqual({ effort: 'medium' })
    expect(JSON.stringify(scenesCall.messages)).toContain('\\"crypt\\"')
    expect(JSON.stringify(scenesCall.messages)).toContain('\\"ritual\\"')
    const second = await invoke({ action: 'write', creationId })
    expect(second.body).toMatchObject({ written: 2, total: 2, remaining: 0, validationErrors: [], storyId: first.body.storyId })

    const { data: story } = await user.from('stories').select('visibility, owner_id, title, content').eq('id', first.body.storyId).single()
    expect(story).toMatchObject({ visibility: 'private', owner_id: userId, title: 'My Mill' })
    const meta = (story!.content as { meta: Record<string, unknown> }).meta
    expect(meta).toMatchObject({ license: 'private', lang: 'en', players: { min: 2, max: 4 }, tags: ['grimoire-creator'], contentWarnings: ['missing people'] })
    const npc = (story!.content as { npcs: Array<Record<string, unknown>> }).npcs[0]
    expect(npc).toMatchObject({ id: 'miller', characteristics: { STR: 60 }, hp: 11 })
    // The model's choices for the ambiance screen reach the story
    const scenes = (story!.content as { acts: Array<{ scenes: Array<{ id: string; screen?: unknown }> }> }).acts.flatMap((x) => x.scenes)
    expect(scenes.map((sc) => [sc.id, sc.screen ?? null])).toEqual([['arrival', FAKE_SCREEN.arrival], ['mill', null]])

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

    await invoke({ action: 'outline-details', creationId })

    const a = await invoke({ action: 'write', creationId })
    expect(a.body).toMatchObject({ written: 1, total: 3, remaining: 2 })
    expect((await invoke({ action: 'write', creationId })).body).toMatchObject({ written: 2, total: 3, remaining: 1 })
    const b = await invoke({ action: 'write', creationId })
    expect(b.body).toMatchObject({ written: 3, total: 3, remaining: 0, storyId: a.body.storyId })
    const { data } = await user.from('stories').select('content').eq('id', b.body.storyId).single()
    const acts = (data!.content as { acts: Array<{ id: string; scenes: Array<{ id: string }> }> }).acts
    expect(acts.map((x) => [x.id, x.scenes.map((s) => s.id)])).toEqual([['act-1', ['arrival', 'mill']], ['act-2', ['cellar']]])
  })

  it('counts the map attempts of a creation: calls at once and failed answers included', async () => {
    const { data: rows } = await user.from('story_creations').select('id').eq('status', 'succeeded').order('created_at', { ascending: false }).limit(1)
    const creationId = rows![0].id
    // One attempt left (twice the maps a story may have). Four calls at once: Claude is called once.
    await service.from('story_creations').update({ map_attempts: 5 }).eq('id', creationId)
    // The AI service refused the call itself: nothing was generated, the attempt is given back
    fake.status = 400
    const refused = await invoke({ action: 'scene-map', creationId })
    expect([refused.status, refused.body.error?.code]).toEqual([502, 'ai_error'])
    expect((await service.from('story_creations').select('map_attempts').eq('id', creationId).single()).data).toEqual({ map_attempts: 5 })
    fake.status = 200
    const before = callsAsking('ground')
    fake.text = 'not a map' // the answer can't be read: the attempt is spent all the same
    const statuses = (await burst(4, { action: 'scene-map', creationId })).map((r) => r.status).sort()
    expect(callsAsking('ground') - before).toBe(1)
    expect(statuses[3]).toBe(502)
    expect(statuses.slice(0, 3).every((s) => s === 409 || s === 429)).toBe(true)
    // Used up: refused before Claude is called
    const over = await invoke({ action: 'scene-map', creationId })
    expect([over.status, over.body.error?.code]).toEqual([429, 'too_many_maps'])
    expect(callsAsking('ground') - before).toBe(1)
    const { data: row } = await service.from('story_creations').select('map_attempts').eq('id', creationId).single()
    expect(row).toEqual({ map_attempts: 6 })
    await service.from('story_creations').update({ map_attempts: 0 }).eq('id', creationId)
  })

  it('draws the maps the scenes asked for once every scene is written: two pictures and two handouts', async () => {
    const { data: rows } = await user.from('story_creations').select('id, story_id').eq('status', 'succeeded').order('created_at', { ascending: false }).limit(1) // the long story: its cellar asks for a map
    const creationId = rows![0].id
    // The story is finished: the keeper already retitles a scene. The map must join the story as it is now.
    const { data: stored } = await user.from('stories').select('content').eq('id', rows![0].story_id!).single()
    const edited = structuredClone(stored!.content) as { acts: Array<{ scenes: Array<{ title: string }> }> }
    edited.acts[0].scenes[0].title = 'Renamed by the keeper'
    expect((await user.from('stories').update({ content: edited }).eq('id', rows![0].story_id!)).error).toBeNull()
    const res = await invoke({ action: 'scene-map', creationId })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ scene: 'cellar', remaining: 0, storyId: rows![0].story_id })
    const { data } = await user.from('stories').select('content, pack_files').eq('id', res.body.storyId).single()
    expect(data!.pack_files).toEqual(expect.arrayContaining(['images/map-cellar.svg', 'images/map-cellar-keeper.svg']))
    const content = data!.content as { handouts: Array<{ id: string; image?: string; scene?: string }>; acts: Array<{ scenes: Array<{ id: string; title: string; handouts?: string[] }> }> }
    expect(content.handouts.filter((h) => h.id.startsWith('map-'))).toEqual([
      expect.objectContaining({ id: 'map-cellar', image: 'images/map-cellar.svg', scene: 'cellar' }),
      expect.objectContaining({ id: 'map-cellar-keeper', image: 'images/map-cellar-keeper.svg', scene: 'cellar' }),
    ])
    expect(content.acts.flatMap((a) => a.scenes).find((s) => s.id === 'cellar')!.handouts).toEqual(expect.arrayContaining(['map-cellar', 'map-cellar-keeper']))
    expect(content.acts[0].scenes[0].title).toBe('Renamed by the keeper')
    const { data: packJson } = await service.storage.from('story-packs').download(`${userId}/${res.body.storyId}/story.json`)
    const packed = JSON.parse(await packJson!.text())
    expect([packed.acts[0].scenes[0].title, packed.handouts.map((h: { id: string }) => h.id)]).toEqual(['Renamed by the keeper', ['map-cellar', 'map-cellar-keeper']])
    const { data: file } = await user.storage.from('story-packs').download(`${userId}/${res.body.storyId}/images/map-cellar.svg`)
    const svg = await file!.text()
    expect(svg).toMatch(/^<svg/)
    expect(svg).not.toContain('#9a3020') // the players' copy: no secret in red
    // Nothing left to draw; maps aren't charged to the keeper's monthly map quota.
    expect((await invoke({ action: 'scene-map', creationId })).body).toMatchObject({ scene: null, remaining: 0 })
    const { count } = await service.from('ai_usage').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('kind', 'map')
    expect(count).toBe(0)
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

  it('refuses a creation started through the MCP connector: those never use the paid writer', async () => {
    const { data: done } = await service.from('story_creations').select('draft, story_id').eq('owner_id', userId).eq('status', 'succeeded').order('created_at', { ascending: false }).limit(1).single()
    const base = { owner_id: userId, brief, outline: FAKE_OUTLINE, outline_count: 1, source: 'mcp' }
    const { data: rows, error } = await service
      .from('story_creations')
      .insert([
        { ...base, status: 'outlined' },
        // Every scene written, one still asks for its map
        { ...base, status: 'succeeded', story_id: done!.story_id, draft: { ...(done!.draft as object), handouts: [] } },
      ])
      .select('id, status')
    expect(error).toBeNull()
    const outlined = rows!.find((r) => r.status === 'outlined')!.id
    const written = rows!.find((r) => r.status === 'succeeded')!.id
    const before = requests.length
    for (const [action, creationId] of [['outline', outlined], ['outline-details', outlined], ['write', outlined], ['scene-map', written]]) {
      const res = await invoke({ action, creationId })
      expect([action, res.status, res.body.error?.code]).toEqual([action, 404, 'not_found'])
    }
    expect(requests.length).toBe(before) // Claude was never called
    await service.from('story_creations').delete().in('id', [outlined, written])
  })

  it('counts the outline-details calls of a creation, calls at once included', async () => {
    // One call left out of 10 (twice the outlines a story may have)
    const { data: row, error } = await service
      .from('story_creations')
      .insert({ owner_id: userId, brief, outline: FAKE_OUTLINE, outline_count: 1, details_count: 9 })
      .select('id')
      .single()
    expect(error).toBeNull()
    const creationId = row!.id
    // The AI service refused the call itself: nothing was generated, the call is given back
    fake.status = 400
    const refused = await invoke({ action: 'outline-details', creationId })
    expect([refused.status, refused.body.error?.code]).toEqual([502, 'ai_error'])
    expect((await service.from('story_creations').select('details_count').eq('id', creationId).single()).data).toEqual({ details_count: 9 })
    fake.status = 200
    const before = callsAsking('overview')
    const statuses = (await burst(4, { action: 'outline-details', creationId })).map((r) => r.status).sort()
    expect(callsAsking('overview') - before).toBe(1)
    expect(statuses[0]).toBe(200)
    expect(statuses.slice(1).every((s) => s === 409 || s === 429)).toBe(true)
    // Used up: refused before Claude is called
    const over = await invoke({ action: 'outline-details', creationId })
    expect([over.status, over.body.error?.code]).toEqual([429, 'too_many_details'])
    expect(callsAsking('overview') - before).toBe(1)
    const { data: after } = await service.from('story_creations').select('details_count').eq('id', creationId).single()
    expect(after).toEqual({ details_count: 10 })
    await service.from('story_creations').delete().eq('id', creationId)
  })

  it('reserves a map before Claude is called: calls at once stay under the limit, an unreadable answer counts', async () => {
    const mapsCounted = async () => (await service.from('ai_usage').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('kind', 'map')).count
    const request = { action: 'map', description: 'A small house with two rooms.' }
    // One map left this month. Four calls at once: one is drawn, three are refused, Claude is called once.
    await service.from('ai_usage').insert(Array.from({ length: 29 }, () => ({ owner_id: userId, kind: 'map' })))
    fake.delayMs = 300
    let before = requests.length
    expect((await burst(4, request)).map((r) => r.status).sort()).toEqual([200, 429, 429, 429])
    expect(requests.length - before).toBe(1)
    expect(await mapsCounted()).toBe(30)
    const { data: drawn } = await service.from('ai_usage').select('input_tokens, output_tokens').eq('owner_id', userId).eq('kind', 'map').not('input_tokens', 'is', null)
    expect(drawn).toEqual([{ input_tokens: 20500, output_tokens: 700 }]) // the reserved row gets the tokens
    await service.from('ai_usage').delete().eq('owner_id', userId).eq('kind', 'map')

    // Claude answered something unreadable: generated and billed, so counted
    Object.assign(fake, { delayMs: 0, text: 'not a map' })
    expect((await invoke(request)).status).toBe(502)
    expect(await mapsCounted()).toBe(1)
    // The AI service refused the call itself: nothing was generated, nothing is counted
    Object.assign(fake, { text: null, status: 400 })
    before = requests.length
    const refused = await invoke(request)
    expect([refused.status, refused.body.error?.code]).toEqual([502, 'ai_error'])
    expect(requests.length - before).toBe(1)
    expect(await mapsCounted()).toBe(1)
    await service.from('ai_usage').delete().eq('owner_id', userId).eq('kind', 'map')
  })

  it('reserves an idea suggestion the same way', async () => {
    const { count } = await service.from('ai_usage').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('kind', 'story-ideas')
    await service.from('ai_usage').insert(Array.from({ length: 49 - count! }, () => ({ owner_id: userId, kind: 'story-ideas' })))
    fake.delayMs = 300
    const before = requests.length
    expect((await burst(4, { action: 'ideas', brief })).map((r) => r.status).sort()).toEqual([200, 429, 429, 429])
    expect(requests.length - before).toBe(1)
  })

  it('composes a map from a description, checked by the map kit, within its own monthly limit', async () => {
    const res = await invoke({ action: 'map', description: 'A small house with two rooms.', kind: 'building', lang: 'en' })
    expect(res.status).toBe(200)
    expect(res.body.map).toMatchObject({ v: 1, kind: 'building', title: 'Test House', cols: 10, rows: 7 })
    // The unknown stamp is dropped and said so; the rest is kept.
    expect(res.body.map.items.map((i: { t: string }) => i.t)).toEqual(['bed', 'chest'])
    expect(res.body.problems.join(' ')).toMatch(/dropped/)
    const sent = requests.at(-1)!.body as { system: Array<{ text: string }>; output_config: { format: { schema: { properties: object } } }; messages: Array<{ content: string }> }
    expect(sent.system[0].text).toContain('You draw maps')
    expect(Object.keys(sent.output_config.format.schema.properties)).toContain('ground')
    expect(sent.messages[0].content).toContain('A small house with two rooms.')
    const { count } = await service.from('ai_usage').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('kind', 'map')
    expect(count).toBe(1)

    expect((await invoke({ action: 'map', description: 'short' })).status).toBe(400)
    await service.from('ai_usage').insert(Array.from({ length: 30 }, () => ({ owner_id: userId, kind: 'map' })))
    const over = await invoke({ action: 'map', description: 'A small house with two rooms.' })
    expect(over.status).toBe(429)
    expect(over.body.error.code).toBe('quota_exceeded')
  })

  it('takes a revision before Claude is called: revisions at once stay under the limit', async () => {
    const frame = await invoke({ action: 'outline', brief })
    const creationId = frame.body.creationId as string
    const outlines = async () => (await service.from('story_creations').select('outline_count').eq('id', creationId).single()).data!.outline_count
    // One revision left out of 5
    await service.from('story_creations').update({ outline_count: 4 }).eq('id', creationId)
    // The AI service refused the call itself: nothing was generated, the revision is given back
    fake.status = 400
    const refused = await invoke({ action: 'outline', creationId })
    expect([refused.status, refused.body.error?.code]).toEqual([502, 'ai_error'])
    expect(await outlines()).toBe(4)
    // Four revisions at once: one is written, Claude is called once
    Object.assign(fake, { status: 200, delayMs: 300 })
    const before = requests.length
    const statuses = (await burst(4, { action: 'outline', creationId })).map((r) => r.status).sort()
    expect(requests.length - before).toBe(1)
    expect(statuses[0]).toBe(200)
    expect(statuses.slice(1).every((s) => s === 409 || s === 429)).toBe(true)
    expect(await outlines()).toBe(5)
    const over = await invoke({ action: 'outline', creationId })
    expect([over.status, over.body.error?.code]).toEqual([429, 'too_many_outlines'])
    expect(requests.length - before).toBe(1)
  })

  it('reserves a new creation before Claude is called: calls at once stay under the monthly limit', async () => {
    const webCreations = async () => (await service.from('story_creations').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('source', 'web')).count!
    // Two creations left this month
    await service.from('story_creations').insert(Array.from({ length: 8 - (await webCreations()) }, () => ({ owner_id: userId, brief: {} })))
    // The AI service refused the call itself: nothing was generated, the creation is given back
    fake.status = 400
    let before = requests.length
    const refused = await invoke({ action: 'outline', brief })
    expect([refused.status, refused.body.error?.code]).toEqual([502, 'ai_error'])
    expect(requests.length - before).toBe(1)
    expect(await webCreations()).toBe(8)
    // An unreadable answer was generated: it counts, kept as a failed creation without an outline
    Object.assign(fake, { status: 200, text: 'not an outline' })
    const unreadable = await invoke({ action: 'outline', brief })
    expect([unreadable.status, unreadable.body.error?.code]).toEqual([502, 'invalid_output'])
    expect(await webCreations()).toBe(9)
    const { data: failed } = await service
      .from('story_creations')
      .select('status, error, outline, outline_count')
      .eq('owner_id', userId)
      .eq('source', 'web')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    expect(failed).toEqual({ status: 'failed', error: 'invalid_output', outline: null, outline_count: 1 })
    // One left. Four calls at once: one outline, three refusals, Claude is called once.
    Object.assign(fake, { text: null, delayMs: 300 })
    before = requests.length
    expect((await burst(4, { action: 'outline', brief })).map((r) => r.status).sort()).toEqual([200, 429, 429, 429])
    expect(requests.length - before).toBe(1)
    expect(await webCreations()).toBe(10)
  })

  it('enforces the monthly limit on new stories', async () => {
    await service.from('story_creations').insert(Array.from({ length: 10 }, () => ({ owner_id: userId, brief: {} })))
    const res = await invoke({ action: 'outline', brief })
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('quota_exceeded')
  })
})
