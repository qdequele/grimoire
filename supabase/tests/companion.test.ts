// Player companion: security rules and invariants of links, notebooks and live points.
// Run with `pnpm test:db` (needs `supabase start`).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Database, Json } from '../../src/lib/database.types'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!

type Client = SupabaseClient<Database>
type User = { client: Client; id: string }

async function signUp(label: string): Promise<User> {
  const email = `${label}-${crypto.randomUUID()}@example.com`
  const client = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signUp({ email, password: 'correct-horse-battery' })
  if (error || !data.user) throw error ?? new Error('no user')
  return { client, id: data.user.id }
}

const story: Json = {
  format: 'grimoire-story/1',
  meta: { id: 'companion-test', title: 'Companion test', lang: 'en', license: 'private' },
  acts: [{ id: 'one', title: 'One', scenes: [{ id: 'start', title: 'Start' }] }],
}

async function seedKeeper(user: User) {
  const { data: st, error: e1 } = await user.client
    .from('stories').insert({ owner_id: user.id, visibility: 'private', content: story }).select('id').single()
  if (e1) throw e1
  const { data: game, error: e2 } = await user.client
    .from('games').insert({ story_id: st.id }).select('id, channel').single()
  if (e2) throw e2
  const { data: ch, error: e3 } = await user.client
    .from('characters').insert({ data: { name: 'Investigator' } }).select('id').single()
  if (e3) throw e3
  return { gameId: game.id, characterId: ch.id }
}

let alice: User
let bob: User
let a: { gameId: string; characterId: string }
let b: { gameId: string; characterId: string }

beforeAll(async () => {
  if (!url || !anonKey) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY')
  ;[alice, bob] = await Promise.all([signUp('alice'), signUp('bob')])
  ;[a, b] = await Promise.all([seedKeeper(alice), seedKeeper(bob)])
})

describe('companion', () => {
  it('keeper rows: links, notes and points are readable by their owner only', async () => {
    const link = await alice.client.from('table_links').insert({ game_id: a.gameId, character_id: a.characterId }).select('id').single()
    expect(link.error).toBeNull()
    const note = await alice.client.from('character_notes').insert({ character_id: a.characterId, body: 'Hello' }).select('id').single()
    expect(note.error).toBeNull()
    const pts = await alice.client
      .from('game_points')
      .insert({ game_id: a.gameId, character_id: a.characterId, pv: 10, san: 50, chance: 40, pm: 8, source: 'keeper' })
      .select('game_id')
      .single()
    expect(pts.error).toBeNull()

    expect((await alice.client.from('table_links').select('id')).data).toHaveLength(1)
    expect((await bob.client.from('table_links').select('id')).data).toEqual([])
    expect((await bob.client.from('character_notes').select('id')).data).toEqual([])
    expect((await bob.client.from('game_points').select('game_id')).data).toEqual([])
  })

  it("a note can't point at someone else's investigator", async () => {
    const { error } = await alice.client.from('character_notes').insert({ character_id: b.characterId, body: 'Nope' })
    expect(error).not.toBeNull()
  })

  it('tokens are long and URL-safe', async () => {
    const { data, error } = await alice.client.from('table_links').select('token')
    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
    for (const row of data!) expect(row.token).toMatch(/^[A-Za-z0-9_-]{32,}$/)
  })

  it('only one active table link per game', async () => {
    const first = await alice.client.from('table_links').insert({ game_id: a.gameId }).select('id').single()
    expect(first.error).toBeNull()
    const second = await alice.client.from('table_links').insert({ game_id: a.gameId })
    expect(second.error?.code).toBe('23505')

    const { error } = await alice.client.rpc('revoke_table_link', { p_link: first.data!.id })
    expect(error).toBeNull()
    const third = await alice.client.from('table_links').insert({ game_id: a.gameId })
    expect(third.error).toBeNull()
  })

  it('revoking rotates the game channel', async () => {
    const before = (await alice.client.from('games').select('channel').eq('id', a.gameId).single()).data!.channel
    const active = await alice.client.from('table_links').select('id').eq('game_id', a.gameId).is('revoked_at', null).limit(1).single()
    const existing = active.data!.id
    const { error } = await alice.client.rpc('revoke_table_link', { p_link: existing })
    expect(error).toBeNull()
    const after = (await alice.client.from('games').select('channel').eq('id', a.gameId).single()).data!.channel
    expect(after).not.toBe(before)
  })
})
