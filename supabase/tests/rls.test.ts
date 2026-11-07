// Security rules (RLS) against the local Supabase stack. Run with `pnpm test:db` (needs `supabase start`).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Database, Json } from '../../src/lib/database.types'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

type Client = SupabaseClient<Database>
const service: Client = createClient<Database>(url, serviceKey, { auth: { persistSession: false } })

const story = (title: string, license = 'CC-BY-4.0'): Json => ({
  format: 'grimoire-story/1',
  meta: { id: title.toLowerCase().replace(/\W+/g, '-'), title, lang: 'en', license },
  acts: [{ id: 'one', title: 'One', scenes: [{ id: 'start', title: 'Start' }] }],
})

async function signUp(label: string): Promise<{ client: Client; id: string }> {
  const email = `${label}-${crypto.randomUUID()}@example.com`
  const client = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signUp({ email, password: 'correct-horse-battery' })
  if (error || !data.user) throw error ?? new Error('no user')
  return { client, id: data.user.id }
}

let alice: { client: Client; id: string }
let bob: { client: Client; id: string }
let admin: { client: Client; id: string }
let aliceStoryId: string
let marketplaceId: string

beforeAll(async () => {
  if (!url || !anonKey || !serviceKey) throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY')
  ;[alice, bob, admin] = await Promise.all([signUp('alice'), signUp('bob'), signUp('admin')])
  const { error } = await service.from('profiles').update({ is_admin: true }).eq('id', admin.id)
  if (error) throw error

  const { data, error: e2 } = await alice.client
    .from('stories')
    .insert({ owner_id: alice.id, visibility: 'private', content: story('Alice private', 'private') })
    .select('id')
    .single()
  if (e2) throw e2
  aliceStoryId = data.id

  const { data: m } = await service.from('stories').select('id').eq('visibility', 'marketplace').limit(1).single()
  marketplaceId = m!.id
})

describe('profiles', () => {
  it('are created on sign-up and readable by their owner only', async () => {
    const own = await alice.client.from('profiles').select('id, is_admin').eq('id', alice.id).single()
    expect(own.data).toEqual({ id: alice.id, is_admin: false })
    const other = await alice.client.from('profiles').select('id').eq('id', bob.id)
    expect(other.data).toEqual([])
  })

  it("can't be used to become admin", async () => {
    const { error } = await alice.client.from('profiles').update({ is_admin: true }).eq('id', alice.id)
    expect(error).not.toBeNull()
    const { data } = await service.from('profiles').select('is_admin').eq('id', alice.id).single()
    expect(data!.is_admin).toBe(false)
  })

  it('allow renaming yourself', async () => {
    const { error } = await alice.client.from('profiles').update({ display_name: 'Alice' }).eq('id', alice.id)
    expect(error).toBeNull()
  })

  it('allow setting and removing your own photo, image data only', async () => {
    const photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    expect((await alice.client.from('profiles').update({ photo }).eq('id', alice.id)).error).toBeNull()
    const bad = await alice.client.from('profiles').update({ photo: 'https://example.com/a.jpg' }).eq('id', alice.id)
    expect(bad.error).not.toBeNull()
    // Someone else's photo: RLS matches no row.
    await bob.client.from('profiles').update({ photo: null }).eq('id', alice.id)
    const { data } = await service.from('profiles').select('photo').eq('id', alice.id).single()
    expect(data!.photo).toBe(photo)
    expect((await alice.client.from('profiles').update({ photo: null }).eq('id', alice.id)).error).toBeNull()
  })
})

describe('stories', () => {
  it('marketplace stories are visible to everyone signed in', async () => {
    const { data } = await bob.client.from('stories').select('id').eq('id', marketplaceId)
    expect(data).toHaveLength(1)
  })

  it('private stories are visible to their owner only, admins included', async () => {
    expect((await alice.client.from('stories').select('id').eq('id', aliceStoryId)).data).toHaveLength(1)
    expect((await bob.client.from('stories').select('id').eq('id', aliceStoryId)).data).toEqual([])
    expect((await admin.client.from('stories').select('id').eq('id', aliceStoryId)).data).toEqual([])
  })

  it("other users can't change or delete a private story", async () => {
    const upd = await bob.client.from('stories').update({ content: story('Hacked') }).eq('id', aliceStoryId).select('id')
    expect(upd.data ?? []).toEqual([])
    const del = await bob.client.from('stories').delete().eq('id', aliceStoryId).select('id')
    expect(del.data ?? []).toEqual([])
    const { data } = await service.from('stories').select('title').eq('id', aliceStoryId).single()
    expect(data!.title).toBe('Alice private')
  })

  it("a user can't create a story for someone else", async () => {
    const { error } = await bob.client.from('stories').insert({ owner_id: alice.id, visibility: 'private', content: story('Forged') })
    expect(error).not.toBeNull()
  })

  it("regular users can't publish to the marketplace", async () => {
    const { error } = await alice.client.from('stories').insert({ owner_id: null, visibility: 'marketplace', content: story('Mine') })
    expect(error).not.toBeNull()
    const move = await alice.client.from('stories').update({ visibility: 'marketplace', owner_id: null }).eq('id', aliceStoryId).select('id')
    expect(move.error ?? (move.data?.length === 0 ? 'no rows' : null)).not.toBeNull()
  })

  it("regular users can't edit or delete marketplace stories", async () => {
    const upd = await alice.client.from('stories').update({ content: story('Vandalised') }).eq('id', marketplaceId).select('id')
    expect(upd.data ?? []).toEqual([])
    const del = await alice.client.from('stories').delete().eq('id', marketplaceId).select('id')
    expect(del.data ?? []).toEqual([])
  })

  it('admins can publish to the marketplace', async () => {
    const { data, error } = await admin.client
      .from('stories')
      .insert({ owner_id: null, visibility: 'marketplace', content: story('Admin pick'), published_at: new Date().toISOString() })
      .select('id')
      .single()
    expect(error).toBeNull()
    await admin.client.from('stories').delete().eq('id', data!.id)
  })

  it('nobody, admins included, can publish a story licensed "private"', async () => {
    const { error } = await admin.client
      .from('stories')
      .insert({ owner_id: null, visibility: 'marketplace', content: story('Book import', 'private') })
    expect(error).not.toBeNull()
  })
})

describe('characters and games', () => {
  it('are private to their owner', async () => {
    const c = await alice.client.from('characters').insert({ data: { name: 'Ada' } }).select('id').single()
    expect(c.error).toBeNull()
    expect((await bob.client.from('characters').select('id').eq('id', c.data!.id)).data).toEqual([])

    const g = await alice.client.from('games').insert({ story_id: marketplaceId, state: { scene: 'x' } }).select('id').single()
    expect(g.error).toBeNull()
    expect((await bob.client.from('games').select('id').eq('id', g.data!.id)).data).toEqual([])
  })

  it("can't start a game on someone else's private story", async () => {
    const { error } = await bob.client.from('games').insert({ story_id: aliceStoryId, state: {} })
    expect(error).not.toBeNull()
  })
})

describe('imports', () => {
  it("users can't create or delete import records (the quota)", async () => {
    const ins = await alice.client.from('story_imports').insert({ owner_id: alice.id, page_count: 1 })
    expect(ins.error).not.toBeNull()

    const { data: row } = await service.from('story_imports').insert({ owner_id: alice.id, page_count: 3 }).select('id').single()
    await alice.client.from('story_imports').delete().eq('id', row!.id)
    const { data } = await service.from('story_imports').select('id').eq('id', row!.id)
    expect(data).toHaveLength(1)
    expect((await alice.client.from('story_imports').select('id').eq('id', row!.id)).data).toHaveLength(1)
    expect((await bob.client.from('story_imports').select('id').eq('id', row!.id)).data).toEqual([])
  })

  it("users can't create, change or delete story creations (the creator's quota), only read their own", async () => {
    const ins = await alice.client.from('story_creations').insert({ owner_id: alice.id, brief: {} })
    expect(ins.error).not.toBeNull()

    const { data: row } = await service.from('story_creations').insert({ owner_id: alice.id, brief: {} }).select('id').single()
    await alice.client.from('story_creations').update({ outline_count: 0, status: 'succeeded' }).eq('id', row!.id)
    await alice.client.from('story_creations').delete().eq('id', row!.id)
    const { data } = await service.from('story_creations').select('status').eq('id', row!.id)
    expect(data).toEqual([{ status: 'outlined' }])
    expect((await alice.client.from('story_creations').select('id').eq('id', row!.id)).data).toHaveLength(1)
    expect((await bob.client.from('story_creations').select('id').eq('id', row!.id)).data).toEqual([])
  })

  it('uploads are confined to your own folder', async () => {
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
    const own = await alice.client.storage.from('import-pages').upload(`${alice.id}/t/001.png`, png)
    expect(own.error).toBeNull()
    const other = await alice.client.storage.from('import-pages').upload(`${bob.id}/t/001.png`, png)
    expect(other.error).not.toBeNull()
    const peek = await bob.client.storage.from('import-pages').download(`${alice.id}/t/001.png`)
    expect(peek.error).not.toBeNull()
    await alice.client.storage.from('import-pages').remove([`${alice.id}/t/001.png`])
  })
})

describe('story packs (Storage)', () => {
  const json = () => new Blob(['{}'], { type: 'application/json' })

  it('a keeper writes and reads only their own packs', async () => {
    const own = await alice.client.storage.from('story-packs').upload(`${alice.id}/s1/story.json`, json(), { upsert: true })
    expect(own.error).toBeNull()
    expect((await alice.client.storage.from('story-packs').download(`${alice.id}/s1/story.json`)).error).toBeNull()
    expect((await bob.client.storage.from('story-packs').download(`${alice.id}/s1/story.json`)).error).not.toBeNull()
    expect((await bob.client.storage.from('story-packs').upload(`${alice.id}/s1/images/x.png`, json())).error).not.toBeNull()
    await bob.client.storage.from('story-packs').remove([`${alice.id}/s1/story.json`])
    expect((await alice.client.storage.from('story-packs').download(`${alice.id}/s1/story.json`)).error).toBeNull()
  })

  it('everyone reads marketplace packs, only admins write them', async () => {
    const path = `marketplace/${marketplaceId}/story.json`
    expect((await admin.client.storage.from('story-packs').upload(path, json(), { upsert: true })).error).toBeNull()
    expect((await bob.client.storage.from('story-packs').download(path)).error).toBeNull()
    expect((await alice.client.storage.from('story-packs').upload(`marketplace/${marketplaceId}/images/x.png`, json())).error).not.toBeNull()
  })
})

describe('players', () => {
  it('are private to their keeper, with one name per keeper', async () => {
    const p = await alice.client.from('players').insert({ name: 'Camille' }).select('id, owner_id').single()
    expect(p.error).toBeNull()
    expect(p.data!.owner_id).toBe(alice.id)
    expect((await bob.client.from('players').select('id').eq('id', p.data!.id)).data).toEqual([])
    expect((await alice.client.from('players').insert({ name: ' camille ' })).error?.code).toBe('23505')
    expect((await bob.client.from('players').insert({ name: 'Camille' })).error).toBeNull()
    expect((await bob.client.from('players').insert({ owner_id: alice.id, name: 'Forged' })).error).not.toBeNull()
  })

  it("an investigator can only be given to one of its keeper's players", async () => {
    const mine = await alice.client.from('players').insert({ name: 'Dominique' }).select('id').single()
    const theirs = await bob.client.from('players').insert({ name: 'Eden' }).select('id').single()
    const c = await alice.client.from('characters').insert({ data: { name: 'Ada' }, player_id: mine.data!.id }).select('id').single()
    expect(c.error).toBeNull()
    const steal = await alice.client.from('characters').update({ player_id: theirs.data!.id }).eq('id', c.data!.id)
    expect(steal.error).not.toBeNull()
  })

  it('removing a player keeps their investigators, without player', async () => {
    const p = await alice.client.from('players').insert({ name: 'Frédérique' }).select('id').single()
    const c = await alice.client.from('characters').insert({ data: { name: 'Bea' }, player_id: p.data!.id }).select('id').single()
    expect((await alice.client.from('players').delete().eq('id', p.data!.id)).error).toBeNull()
    const { data } = await alice.client.from('characters').select('player_id, owner_id').eq('id', c.data!.id).single()
    expect(data).toEqual({ player_id: null, owner_id: alice.id })
  })
})
