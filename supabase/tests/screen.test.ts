// Ambiance screen: security rules of screen links, the anonymous screen_open RPC, live broadcast and
// the screen-images bucket. Run with `pnpm test:db` (needs `supabase start`).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Database, Json } from '../../src/lib/database.types'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!

type Client = SupabaseClient<Database>
type User = { client: Client; id: string }

const newClient = () => createClient<Database>(url, anonKey, { auth: { persistSession: false } })

async function signUp(label: string): Promise<User> {
  const client = newClient()
  const { data, error } = await client.auth.signUp({ email: `${label}-${crypto.randomUUID()}@example.com`, password: 'correct-horse-battery' })
  if (error || !data.user) throw error ?? new Error('no user')
  return { client, id: data.user.id }
}

const story: Json = {
  format: 'grimoire-story/1',
  meta: { id: 'screen-test', title: 'Screen test', lang: 'en', license: 'private' },
  acts: [{ id: 'one', title: 'One', scenes: [{ id: 'start', title: 'Start' }] }],
}

async function newGame(user: User) {
  const { data: st, error: e1 } = await user.client
    .from('stories').insert({ owner_id: user.id, visibility: 'private', content: story }).select('id').single()
  if (e1) throw e1
  const { data: game, error: e2 } = await user.client
    .from('games').insert({ story_id: st.id, state: { party: [] } }).select('id, screen_channel').single()
  if (e2) throw e2
  return { gameId: game.id, channel: game.screen_channel }
}

async function screenLink(user: User, gameId: string) {
  const { data, error } = await user.client.from('screen_links').insert({ game_id: gameId }).select('id, token').single()
  if (error) throw error
  return data
}

const shown = { v: 1, follow: true, sound: false, scene: { preset: 'fog', image: null, sounds: [] }, override: null, handout: null }

let alice: User
let bob: User
const anon: Client = newClient()

beforeAll(async () => {
  if (!url || !anonKey) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY')
  ;[alice, bob] = await Promise.all([signUp('alice'), signUp('bob')])
})

describe('screen links (keeper)', () => {
  it('are readable by their owner only, and only on their own games', async () => {
    const a = await newGame(alice)
    const b = await newGame(bob)
    const l = await screenLink(alice, a.gameId)
    expect(l.token).toMatch(/^[A-Za-z0-9_-]{32,}$/)
    expect((await alice.client.from('screen_links').select('id').eq('id', l.id)).data).toHaveLength(1)
    expect((await bob.client.from('screen_links').select('id').eq('id', l.id)).data).toEqual([])
    expect((await anon.from('screen_links').select('id')).data).toEqual([])

    const onOther = await alice.client.from('screen_links').insert({ game_id: b.gameId })
    expect(onOther.error).not.toBeNull()
  })

  it('one active link per game; revoking rotates the screen topic, not the companion one', async () => {
    const a = await newGame(alice)
    const first = await screenLink(alice, a.gameId)
    const second = await alice.client.from('screen_links').insert({ game_id: a.gameId })
    expect(second.error?.code).toBe('23505')

    const before = (await alice.client.from('games').select('channel, screen_channel').eq('id', a.gameId).single()).data!
    // Someone else can't revoke it.
    await bob.client.rpc('revoke_screen_link', { p_link: first.id })
    expect((await anon.rpc('screen_open', { p_token: first.token })).error).toBeNull()
    // Anonymous visitors can't even call it.
    expect((await anon.rpc('revoke_screen_link', { p_link: first.id })).error).not.toBeNull()

    expect((await alice.client.rpc('revoke_screen_link', { p_link: first.id })).error).toBeNull()
    const after = (await alice.client.from('games').select('channel, screen_channel').eq('id', a.gameId).single()).data!
    expect(after.screen_channel).not.toBe(before.screen_channel)
    expect(after.channel).toBe(before.channel)
    expect((await alice.client.from('screen_links').insert({ game_id: a.gameId })).error).toBeNull()
  })
})

describe('screen_open (anonymous)', () => {
  it('returns only the topic and what to show', async () => {
    const a = await newGame(alice)
    const l = await screenLink(alice, a.gameId)
    const empty = await anon.rpc('screen_open', { p_token: l.token })
    expect(empty.error).toBeNull()
    expect(empty.data).toEqual({ channel: a.channel, screen: null })

    expect((await alice.client.from('games').update({ screen: shown }).eq('id', a.gameId)).error).toBeNull()
    const { data } = await anon.rpc('screen_open', { p_token: l.token })
    expect(data).toEqual({ channel: a.channel, screen: shown })
    expect(Object.keys(data as object).sort()).toEqual(['channel', 'screen'])
  })

  it('refuses unknown and revoked links', async () => {
    const a = await newGame(alice)
    const l = await screenLink(alice, a.gameId)
    expect((await anon.rpc('screen_open', { p_token: 'nope' })).error?.message).toBe('link_invalid')
    await alice.client.rpc('revoke_screen_link', { p_link: l.id })
    expect((await anon.rpc('screen_open', { p_token: l.token })).error?.message).toBe('link_invalid')
  })

  it("a screen link is not a player link: it can't open the companion or write anything", async () => {
    const a = await newGame(alice)
    const l = await screenLink(alice, a.gameId)
    expect((await anon.rpc('companion_open', { p_token: l.token })).error?.message).toContain('link_invalid')
    const create = await anon.rpc('companion_create_character', { p_token: l.token, p_data: { name: 'Sneaky' }, p_player_name: '' })
    expect(create.error?.message).toContain('link_invalid')
    // And nobody but the keeper changes what the screen shows.
    await anon.from('games').update({ screen: { v: 1, hacked: true } }).eq('id', a.gameId)
    await bob.client.from('games').update({ screen: { v: 1, hacked: true } }).eq('id', a.gameId)
    expect((await anon.rpc('screen_open', { p_token: l.token })).data).toEqual({ channel: a.channel, screen: null })
  })

  it("the keeper's changes are broadcast on the screen's topic", async () => {
    const a = await newGame(alice)
    const listener = newClient()
    const ch = listener.channel(`screen:${a.channel}`)
    const received = new Promise<unknown>((resolve) => ch.on('broadcast', { event: 'screen' }, (m) => resolve(m.payload)))
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('not SUBSCRIBED within 5 s')), 5000)
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve() }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error(status)) }
      })
    })
    try {
      const handout = { ...shown, handout: { key: 'h', title: 'A letter', text: 'Hi', image: null } }
      expect((await alice.client.from('games').update({ screen: handout }).eq('id', a.gameId)).error).toBeNull()
      const payload = await Promise.race([received, new Promise((_, r) => setTimeout(() => r(new Error('no broadcast within 5 s')), 5000))])
      expect(payload).toMatchObject(handout) // Realtime adds an id
    } finally {
      await listener.removeChannel(ch)
      await listener.realtime.disconnect()
    }
  })
})

describe('screen-images bucket', () => {
  const png = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })

  it('the keeper writes and signs pictures in their own folder only', async () => {
    const a = await newGame(alice)
    const path = `${alice.id}/${a.gameId}/${crypto.randomUUID()}.png`
    expect((await alice.client.storage.from('screen-images').upload(path, png, { contentType: 'image/png' })).error).toBeNull()
    const signed = await alice.client.storage.from('screen-images').createSignedUrl(path, 60)
    expect(signed.error).toBeNull()
    expect((await fetch(signed.data!.signedUrl)).status).toBe(200)

    // Others can't read, sign, list or write there.
    expect((await bob.client.storage.from('screen-images').download(path)).error).not.toBeNull()
    expect((await bob.client.storage.from('screen-images').createSignedUrl(path, 60)).error).not.toBeNull()
    expect((await anon.storage.from('screen-images').download(path)).error).not.toBeNull()
    expect((await bob.client.storage.from('screen-images').list(`${alice.id}/${a.gameId}`)).data ?? []).toEqual([])
    const intrude = await bob.client.storage.from('screen-images').upload(`${alice.id}/${a.gameId}/x.png`, png, { contentType: 'image/png' })
    expect(intrude.error).not.toBeNull()
    const anonWrite = await anon.storage.from('screen-images').upload(`${alice.id}/x.png`, png, { contentType: 'image/png' })
    expect(anonWrite.error).not.toBeNull()
  })

  it('only pictures', async () => {
    const path = `${alice.id}/page.html`
    const r = await alice.client.storage.from('screen-images').upload(path, new Blob(['<script>1</script>'], { type: 'text/html' }), { contentType: 'text/html' })
    expect(r.error).not.toBeNull()
  })
})
