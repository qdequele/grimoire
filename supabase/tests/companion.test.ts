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

  it("links and points can't point at someone else's game or investigator", async () => {
    const onGame = await alice.client.from('table_links').insert({ game_id: b.gameId })
    expect(onGame.error).not.toBeNull()
    const onCharacter = await alice.client.from('table_links').insert({ game_id: a.gameId, character_id: b.characterId })
    expect(onCharacter.error).not.toBeNull()
    const pointsOnGame = await alice.client
      .from('game_points')
      .insert({ game_id: b.gameId, character_id: a.characterId, source: 'keeper' })
    expect(pointsOnGame.error).not.toBeNull()
    const pointsOnCharacter = await alice.client
      .from('game_points')
      .insert({ game_id: a.gameId, character_id: b.characterId, source: 'keeper' })
    expect(pointsOnCharacter.error).not.toBeNull()
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

// ------------------------------------------------------------------ anonymous RPCs
const anon: Client = createClient<Database>(url, anonKey, { auth: { persistSession: false } })

async function newGame(user: User, characters: Array<Record<string, Json>>) {
  const { data: st, error: e1 } = await user.client
    .from('stories').insert({ owner_id: user.id, visibility: 'private', content: story }).select('id').single()
  if (e1) throw e1
  const ids: string[] = []
  for (const data of characters) {
    const { data: ch, error } = await user.client.from('characters').insert({ data }).select('id').single()
    if (error) throw error
    ids.push(ch.id)
  }
  const state: Json = { party: ids.map((characterId) => ({ characterId })) }
  const { data: game, error: e2 } = await user.client
    .from('games').insert({ story_id: st.id, state }).select('id').single()
  if (e2) throw e2
  return { gameId: game.id, ids }
}

async function link(user: User, gameId: string, characterId?: string) {
  const { data, error } = await user.client
    .from('table_links').insert({ game_id: gameId, character_id: characterId ?? null }).select('id, token').single()
  if (error) throw error
  return data
}

interface Opened {
  game: { id: string; channel: string; title: string }
  focus: string | null
  canCreate: boolean
  party: Array<{ id: string; data: Record<string, unknown>; player: string | null }>
  points: Array<{ characterId: string; pv: number; san: number; chance: number; pm: number; checks: string[]; source: string; updatedAt: string }>
  notes: Array<{ id: string; characterId: string; body: string; createdAt: string }>
}

describe('companion RPCs (anonymous)', () => {
  it('opening a table link returns the party, its points and notes, without creation data', async () => {
    const g = await newGame(alice, [
      { name: 'One', hp: 12, creation: { secret: true } },
      { name: 'Two' },
    ])
    const l = await link(alice, g.gameId)
    await alice.client.from('game_points').insert({ game_id: g.gameId, character_id: g.ids[0], pv: 9, san: 50, chance: 40, pm: 8, source: 'keeper' })
    await alice.client.from('character_notes').insert({ character_id: g.ids[1], body: 'A clue' })

    const { data, error } = await anon.rpc('companion_open', { p_token: l.token })
    expect(error).toBeNull()
    const o = data as unknown as Opened
    expect(o.game.id).toBe(g.gameId)
    expect(o.game.title).toBe('Companion test')
    expect(o.focus).toBeNull()
    expect(o.canCreate).toBe(true)
    expect(o.party.map((p) => p.id).sort()).toEqual([...g.ids].sort())
    for (const p of o.party) expect(p.data).not.toHaveProperty('creation')
    expect(o.points).toHaveLength(1)
    expect(o.points[0]).toMatchObject({ characterId: g.ids[0], pv: 9, san: 50, chance: 40, pm: 8, checks: [], source: 'keeper' })
    expect(o.notes).toHaveLength(1)
    expect(o.notes[0]).toMatchObject({ characterId: g.ids[1], body: 'A clue' })
  })

  it('a personal link focuses its investigator but still lists the party', async () => {
    const g = await newGame(alice, [{ name: 'One' }, { name: 'Two' }])
    const l = await link(alice, g.gameId, g.ids[1])
    const { data, error } = await anon.rpc('companion_open', { p_token: l.token })
    expect(error).toBeNull()
    const o = data as unknown as Opened
    expect(o.focus).toBe(g.ids[1])
    expect(o.canCreate).toBe(false)
    expect(o.party).toHaveLength(2)
  })

  it('a revoked link, or a deleted game, gives link_invalid', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    expect((await anon.rpc('companion_open', { p_token: l.token })).error).toBeNull()
    await alice.client.rpc('revoke_table_link', { p_link: l.id })
    expect((await anon.rpc('companion_open', { p_token: l.token })).error?.message).toContain('link_invalid')

    const g2 = await newGame(alice, [{ name: 'One' }])
    const l2 = await link(alice, g2.gameId)
    await alice.client.from('games').delete().eq('id', g2.gameId)
    expect((await anon.rpc('companion_open', { p_token: l2.token })).error?.message).toContain('link_invalid')
    expect((await anon.rpc('companion_open', { p_token: 'nope' })).error?.message).toContain('link_invalid')
  })

  it("a link can't reach another game's investigators", async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const other = await newGame(alice, [{ name: 'Other' }])
    const l = await link(alice, g.gameId)
    const pts = await anon.rpc('companion_set_points', { p_token: l.token, p_character: other.ids[0], p_pv: 1, p_san: 1, p_chance: 1, p_pm: 1 })
    expect(pts.error?.message).toContain('not_in_game')
    const note = await anon.rpc('companion_add_note', { p_token: l.token, p_character: other.ids[0], p_body: 'x' })
    expect(note.error?.message).toContain('not_in_game')
    const bobs = await anon.rpc('companion_add_note', { p_token: l.token, p_character: b.characterId, p_body: 'x' })
    expect(bobs.error?.message).toContain('not_in_game')
  })

  it("a personal link can't write to another party member", async () => {
    const g = await newGame(alice, [{ name: 'One' }, { name: 'Two' }])
    const l = await link(alice, g.gameId, g.ids[0])
    const pts = await anon.rpc('companion_set_points', { p_token: l.token, p_character: g.ids[1], p_pv: 1, p_san: 1, p_chance: 1, p_pm: 1 })
    expect(pts.error?.message).toContain('not_in_game')
    const note = await anon.rpc('companion_add_note', { p_token: l.token, p_character: g.ids[1], p_body: 'x' })
    expect(note.error?.message).toContain('not_in_game')
    const own = await anon.rpc('companion_add_note', { p_token: l.token, p_character: g.ids[0], p_body: 'mine' })
    expect(own.error).toBeNull()
    expect(own.data).toEqual(expect.any(String))
  })

  it('points are bounded', async () => {
    const g = await newGame(alice, [{ name: 'One', hp: 12 }])
    const l = await link(alice, g.gameId)
    const call = (o: Partial<Record<'p_pv' | 'p_san' | 'p_chance' | 'p_pm', number>>) =>
      anon.rpc('companion_set_points', { p_token: l.token, p_character: g.ids[0], p_pv: 12, p_san: 99, p_chance: 99, p_pm: 99, ...o })
    expect((await call({})).error).toBeNull()
    expect((await call({ p_san: 100 })).error?.message).toContain('bad_value')
    expect((await call({ p_pv: 13 })).error?.message).toContain('bad_value')
    expect((await call({ p_pv: -1 })).error?.message).toContain('bad_value')
    expect((await call({ p_chance: 100 })).error?.message).toContain('bad_value')
    expect((await call({ p_pm: -1 })).error?.message).toContain('bad_value')
  })

  it('a deleted investigator disappears from the companion', async () => {
    const g = await newGame(alice, [{ name: 'One' }, { name: 'Two' }])
    const l = await link(alice, g.gameId)
    await alice.client.from('characters').delete().eq('id', g.ids[1])
    const o = (await anon.rpc('companion_open', { p_token: l.token })).data as unknown as Opened
    expect(o.party.map((p) => p.id)).toEqual([g.ids[0]])
    const pts = await anon.rpc('companion_set_points', { p_token: l.token, p_character: g.ids[1], p_pv: 1, p_san: 1, p_chance: 1, p_pm: 1 })
    expect(pts.error?.message).toContain('not_in_game')
  })

  it('phone points are stored with source phone and update persisted SAN', async () => {
    const g = await newGame(alice, [{ name: 'One', hp: 10, progress: { san: 60, other: 1 } }, { name: 'Two' }])
    const l = await link(alice, g.gameId)
    await alice.client.from('game_points').insert({ game_id: g.gameId, character_id: g.ids[0], pv: 10, san: 60, chance: 40, pm: 8, checks: ['Fouiller'], source: 'keeper' })
    const { error } = await anon.rpc('companion_set_points', { p_token: l.token, p_character: g.ids[0], p_pv: 7, p_san: 44, p_chance: 30, p_pm: 5 })
    expect(error).toBeNull()
    const row = (await alice.client.from('game_points').select('*').eq('game_id', g.gameId).eq('character_id', g.ids[0]).single()).data!
    expect(row).toMatchObject({ pv: 7, san: 44, chance: 30, pm: 5, source: 'phone', checks: ['Fouiller'] })
    const ch = (await alice.client.from('characters').select('data').eq('id', g.ids[0]).single()).data!.data as { progress: Record<string, unknown> }
    expect(ch.progress).toEqual({ san: 44, other: 1 })
    // No progress yet: none is invented; a missing points row is created.
    await anon.rpc('companion_set_points', { p_token: l.token, p_character: g.ids[1], p_pv: 3, p_san: 20, p_chance: 10, p_pm: 2 })
    const two = (await alice.client.from('characters').select('data').eq('id', g.ids[1]).single()).data!.data as Record<string, unknown>
    expect(two).not.toHaveProperty('progress')
    const row2 = (await alice.client.from('game_points').select('source').eq('character_id', g.ids[1]).single()).data!
    expect(row2.source).toBe('phone')
  })

  it("anonymous visitors can't call internals or read the tables directly", async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    expect((await anon.rpc('companion_owner', { p_token: l.token })).error).not.toBeNull()
    expect((await anon.rpc('companion_link', { p_token: l.token })).error).not.toBeNull()
    expect((await anon.rpc('companion_party', { p_game: g.gameId })).error).not.toBeNull()
    for (const table of ['table_links', 'character_notes', 'game_points', 'games', 'characters'] as const) {
      const r = await anon.from(table).select('*')
      expect(r.data ?? []).toEqual([])
    }
    // Authenticated users can't call companion_owner either (service role only).
    expect((await alice.client.rpc('companion_owner', { p_token: l.token })).error).not.toBeNull()
  })
})
