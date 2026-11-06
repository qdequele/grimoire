// mcp Edge Function (the ChatGPT / Claude connector) against the local stack, through the official
// MCP client. Tokens here come from a password sign-in: the function only needs a valid user JWT,
// which is also what Supabase's OAuth server issues (the OAuth flow itself is in e2e/mcp.spec.ts).
// Run with `pnpm test:import` (needs `supabase functions serve --env-file supabase/tests/functions.env`).
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../src/lib/database.types'
import { fakeScene, FAKE_OUTLINE } from './fake-creator'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const functionsUrl = process.env.FUNCTIONS_URL ?? `${url}/functions/v1`
const mcpUrl = `${functionsUrl}/mcp`
// Same value as MCP_STORIES_MONTHLY_LIMIT in supabase/tests/functions.env.
const MONTHLY_LIMIT = 5

const service = createClient<Database>(url, serviceKey, { auth: { persistSession: false } })
const brief = { lang: 'en', place: 'A mill town', tone: 'folk', threat: 'human', investigators: 3, length: 'short' }
const millerNpc = {
  id: 'miller', name: 'Abel Roe', kind: 'person', role: 'Miller', personality: 'Gruff.', knows: ['The cellar key'],
  stats: [{ key: 'STR', value: 60 }, { key: 'hp', value: 11 }],
}
const draftFor = (scenes: Array<[act: string, id: string]>, extra: Record<string, unknown> = {}) => ({
  acts: [...new Set(scenes.map(([a]) => a))].map((a) => ({ id: a, scenes: scenes.filter(([x]) => x === a).map(([, id]) => fakeScene(id)) })),
  ...extra,
})

interface Keeper {
  id: string
  db: SupabaseClient<Database>
  token: string
  mcp: Client
}
const keepers: Keeper[] = []

async function connect(token: string) {
  const client = new Client({ name: 'grimoire-test', version: '1.0.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }))
  return client
}

async function keeper(): Promise<Keeper> {
  const db = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await db.auth.signUp({ email: `mcp-${crypto.randomUUID()}@example.com`, password: 'correct-horse-battery' })
  if (error) throw error
  const token = data.session!.access_token
  const k = { id: data.user!.id, db, token, mcp: await connect(token) }
  keepers.push(k)
  return k
}

/** A tool call: the parsed JSON answer, or { error } with the tool's error text. */
async function call(k: Keeper, name: string, args: Record<string, unknown> = {}) {
  const res = await k.mcp.callTool({ name, arguments: args })
  const text = (res.content as Array<{ type: string; text: string }>)[0].text
  if (res.isError) return { error: text }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

let alice: Keeper
let bob: Keeper

beforeAll(async () => {
  alice = await keeper()
  bob = await keeper()
})

afterAll(async () => {
  await Promise.all(keepers.map((k) => k.mcp.close()))
})

describe('mcp: sign-in and discovery', () => {
  it('answers 401 with the resource metadata to a request without a token', async () => {
    const res = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    expect(res.status).toBe(401)
    const header = res.headers.get('www-authenticate') ?? ''
    expect(header).toMatch(/^Bearer resource_metadata="[^"]+\/mcp\/\.well-known\/oauth-protected-resource"/)
    const metadata = await (await fetch(header.match(/"([^"]+)"/)![1])).json()
    expect(metadata).toMatchObject({ resource: expect.stringMatching(/\/mcp$/), authorization_servers: [expect.stringMatching(/\/auth\/v1$/)] })
    // The authorization server it names publishes its OAuth metadata, dynamic registration included.
    const as = await (await fetch(`${metadata.authorization_servers[0]}/.well-known/oauth-authorization-server`)).json()
    expect(as.registration_endpoint).toMatch(/\/oauth\/clients\/register$/)
  })

  it('refuses an invalid token', async () => {
    await expect(connect('not-a-token')).rejects.toThrow()
    const res = await fetch(mcpUrl, { method: 'POST', headers: { Authorization: 'Bearer nope', 'Content-Type': 'application/json' }, body: '{}' })
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('error="invalid_token"')
  })

  it('lists the tools, with instructions for the model', async () => {
    const { tools } = await alice.mcp.listTools()
    expect(tools.map((t) => t.name)).toEqual(['grimoire_guide', 'save_outline', 'write_scenes', 'list_my_stories', 'get_story', 'edit_story'])
    expect(tools.find((t) => t.name === 'get_story')!.annotations).toMatchObject({ readOnlyHint: true })
    expect(tools.find((t) => t.name === 'edit_story')!.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true })
    expect(alice.mcp.getInstructions()).toContain('grimoire_guide')
    expect(alice.mcp.getServerVersion()).toMatchObject({ name: 'grimoire' })
  })

  it('serves the guide', async () => {
    expect(await call(alice, 'grimoire_guide', { topic: 'workflow' })).toContain('save_outline')
    expect(await call(alice, 'grimoire_guide', { topic: 'rules' })).toContain('Originality')
  })
})

describe('mcp: creating a story', () => {
  let creationId: string
  let storyId: string

  it('saves the outline and says which scenes to write', async () => {
    const res = await call(alice, 'save_outline', { brief, outline: FAKE_OUTLINE })
    expect(res).toMatchObject({ title: FAKE_OUTLINE.title, total: 3, next: ['arrival', 'mill', 'cellar'] })
    creationId = res.creationId
    const { data } = await service.from('story_creations').select('owner_id, status, source, outline_count, input_tokens').eq('id', creationId).single()
    expect(data).toEqual({ owner_id: alice.id, status: 'outlined', source: 'mcp', outline_count: 1, input_tokens: 0 })
    // The keeper asks for changes: the outline is replaced, same creation.
    const again = await call(alice, 'save_outline', { creationId, brief, outline: { ...FAKE_OUTLINE, title: 'The Silent Mill' } })
    expect(again).toMatchObject({ creationId, title: 'The Silent Mill' })
  })

  it('refuses scenes that are not in the outline, too many scenes, and forbidden names (nothing saved)', async () => {
    expect((await call(alice, 'write_scenes', { creationId, draft: draftFor([['act-1', 'elsewhere']]) })).error).toMatch(/^bad_request: .*elsewhere/)
    const five = draftFor([['act-1', 'arrival'], ['act-1', 'mill'], ['act-2', 'cellar'], ['act-1', 'arrival'], ['act-1', 'mill']])
    expect((await call(alice, 'write_scenes', { creationId, draft: five })).error).toMatch(/^bad_request: At most 4 scenes/)
    const named = draftFor([['act-1', 'arrival']])
    named.acts[0].scenes[0].lead = 'The road to Arkham.'
    expect((await call(alice, 'write_scenes', { creationId, draft: named })).error).toMatch(/^forbidden_names: .*Arkham/)
    const { data } = await service.from('story_creations').select('story_id, draft').eq('id', creationId).single()
    expect(data).toEqual({ story_id: null, draft: null })
  })

  it('writes the scenes in batches into a private story and its pack', async () => {
    const first = await call(alice, 'write_scenes', { creationId, draft: draftFor([['act-1', 'arrival'], ['act-1', 'mill']], { npcs: [millerNpc], title: 'Ignored' }) })
    expect(first).toMatchObject({ written: 2, total: 3, remaining: 1, next: ['cellar'], validationErrors: [] })
    storyId = first.storyId
    expect(first.url).toBe(`http://127.0.0.1:5173/stories/${storyId}`)

    const { data: story } = await alice.db.from('stories').select('visibility, owner_id, title, content').eq('id', storyId).single()
    expect(story).toMatchObject({ visibility: 'private', owner_id: alice.id, title: 'The Silent Mill' })
    const content = story!.content as { meta: Record<string, unknown>; npcs: Array<Record<string, unknown>> }
    expect(content.meta).toMatchObject({ license: 'private', lang: 'en', players: { min: 2, max: 4 }, tags: ['grimoire-creator'] })
    expect(content.npcs[0]).toMatchObject({ id: 'miller', personality: 'Gruff.', characteristics: { STR: 60 }, hp: 11 })

    // The outline is final once a scene is written.
    expect((await call(alice, 'save_outline', { creationId, brief, outline: FAKE_OUTLINE })).error).toMatch(/^already_writing/)

    const last = await call(alice, 'write_scenes', { creationId, draft: draftFor([['act-2', 'cellar']]) })
    expect(last).toMatchObject({ storyId, written: 3, total: 3, remaining: 0, next: [], validationErrors: [] })
    const { data: row } = await service.from('story_creations').select('status, finished_at').eq('id', creationId).single()
    expect(row!.status).toBe('succeeded')
    expect(row!.finished_at).not.toBeNull()

    const { data: file } = await alice.db.storage.from('story-packs').download(`${alice.id}/${storyId}/story.json`)
    const pack = JSON.parse(await file!.text())
    expect(pack.acts.map((a: { scenes: Array<{ id: string }> }) => a.scenes.map((s) => s.id))).toEqual([['arrival', 'mill'], ['cellar']])

    expect((await call(alice, 'write_scenes', { creationId, draft: draftFor([['act-2', 'cellar']]) })).error).toMatch(/^finished/)
  })

  it('refuses an outline with forbidden names', async () => {
    const res = await call(alice, 'save_outline', { brief, outline: { ...FAKE_OUTLINE, title: 'Shadows over Innsmouth' } })
    expect(res.error).toMatch(/^forbidden_names: .*Innsmouth/)
  })

  it('keeps creations private to their keeper', async () => {
    expect((await call(bob, 'write_scenes', { creationId, draft: draftFor([['act-2', 'cellar']]) })).error).toMatch(/^not_found/)
    expect((await call(bob, 'get_story', { storyId })).error).toMatch(/^not_found/)
    expect((await call(bob, 'list_my_stories')).stories).toEqual([])
  })

  describe('revising it', () => {
    it('lists and reads the story', async () => {
      const list = await call(alice, 'list_my_stories')
      expect(list.stories).toEqual([expect.objectContaining({ id: storyId, title: 'The Silent Mill', lang: 'en', beingWritten: false })])
      const sum = await call(alice, 'get_story', { storyId })
      expect(sum.version).toEqual(expect.any(String))
      expect(sum.acts).toEqual([
        { id: 'act-1', title: 'Arrival', scenes: [{ id: 'arrival', title: 'arrival' }, { id: 'mill', title: 'mill' }] },
        { id: 'act-2', title: 'Below', scenes: [{ id: 'cellar', title: 'cellar' }] },
      ])
      const scenes = await call(alice, 'get_story', { storyId, part: 'scenes', sceneIds: ['mill'] })
      expect(scenes.acts).toEqual([{ id: 'act-1', title: 'Arrival', scenes: [expect.objectContaining({ id: 'mill', lead: 'Lead.' })] }])
    })

    it('edits it, all operations or none, and only from the latest version', async () => {
      const { version, acts } = await call(alice, 'get_story', { storyId, part: 'scenes', sceneIds: ['mill'] })
      const mill = acts[0].scenes[0]
      const ok = await call(alice, 'edit_story', {
        storyId,
        version,
        ops: [
          { op: 'put_scene', scene: { ...mill, title: 'The old mill' } },
          { op: 'put_scene', actId: 'act-2', scene: { id: 'river', title: 'The river', lead: 'Cold water.' } },
          { op: 'set_info', info: { title: 'The Mill Below' } },
        ],
      })
      expect(ok).toMatchObject({ storyId, version: expect.any(String), validationErrors: [] })
      expect(ok.version).not.toBe(version)
      const { data } = await alice.db.from('stories').select('title').eq('id', storyId).single()
      expect(data!.title).toBe('The Mill Below')
      const { data: file } = await alice.db.storage.from('story-packs').download(`${alice.id}/${storyId}/story.json`)
      expect(JSON.parse(await file!.text()).acts[1].scenes.map((s: { id: string }) => s.id)).toEqual(['cellar', 'river'])

      // The old version is stale.
      expect((await call(alice, 'edit_story', { storyId, version, ops: [{ op: 'remove_scene', id: 'river' }] })).error).toMatch(/^conflict/)
      // A bad operation: nothing applies, the operation at fault is named.
      const bad = await call(alice, 'edit_story', { storyId, version: ok.version, ops: [{ op: 'set_info', info: { title: 'X' } }, { op: 'remove_scene', id: 'nowhere' }] })
      expect(bad.error).toMatch(/ops\[1\]/)
      // An edit that breaks the format is refused.
      const broken = await call(alice, 'edit_story', { storyId, version: ok.version, ops: [{ op: 'put_scene', scene: { id: 'river', title: 42 } }] })
      expect(broken.error).toMatch(/^invalid_story/)
      // So is a forbidden name.
      const named = await call(alice, 'edit_story', { storyId, version: ok.version, ops: [{ op: 'set_info', info: { summary: 'Near Dunwich.' } }] })
      expect(named.error).toMatch(/^forbidden_names: .*Dunwich/)
      const { data: after } = await alice.db.from('stories').select('title, updated_at').eq('id', storyId).single()
      expect(after).toEqual({ title: 'The Mill Below', updated_at: ok.version })
      // Every edit is counted (MCP_EDITS_DAILY_LIMIT).
      const { count } = await service.from('ai_usage').select('id', { count: 'exact', head: true }).eq('owner_id', alice.id).eq('kind', 'mcp-edit')
      expect(count).toBe(1)
    })

    it('does not edit a story a creation is still writing', async () => {
      const { creationId: id } = await call(alice, 'save_outline', { brief, outline: FAKE_OUTLINE })
      const { storyId: busy } = await call(alice, 'write_scenes', { creationId: id, draft: draftFor([['act-1', 'arrival']]) })
      const { version, beingWrittenBy } = await call(alice, 'get_story', { storyId: busy })
      expect(beingWrittenBy).toBe(id)
      expect((await call(alice, 'edit_story', { storyId: busy, version, ops: [{ op: 'set_info', info: { title: 'Y' } }] })).error).toMatch(/^busy/)
      const list = await call(alice, 'list_my_stories')
      expect(list.unfinishedCreations).toEqual([expect.objectContaining({ creationId: id, status: 'writing', storyId: busy })])
    })
  })
})

describe('mcp: limits', () => {
  it('counts new stories per month, apart from the website creator', async () => {
    const carol = await keeper()
    // A website creation doesn't count against the connector's limit.
    await service.from('story_creations').insert({ owner_id: carol.id, brief, status: 'outlined', source: 'web' })
    for (let i = 0; i < MONTHLY_LIMIT; i++) expect((await call(carol, 'save_outline', { brief, outline: FAKE_OUTLINE })).creationId).toEqual(expect.any(String))
    expect((await call(carol, 'save_outline', { brief, outline: FAKE_OUTLINE })).error).toMatch(/^quota_exceeded/)
  })

  it('refuses a request body over the size limit', async () => {
    const res = await fetch(mcpUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${alice.token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'grimoire_guide', arguments: { topic: 'x'.repeat(600_000) } } }),
    })
    expect(res.status).toBe(413)
  })
})
