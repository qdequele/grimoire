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

// ------------------------------------------------------------------ create from a link, live broadcast
describe('companion: create an investigator and broadcast', () => {
  it('a player creates an investigator that joins the game', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    const { data, error } = await anon.rpc('companion_create_character', {
      p_token: l.token,
      p_data: { name: 'Newcomer', hp: 11, san: 55, luck: 45, mp: 9 },
      p_player_name: 'Zoé',
    })
    expect(error).toBeNull()
    const id = data as unknown as string
    expect(id).toEqual(expect.any(String))

    const game = (await alice.client.from('games').select('state').eq('id', g.gameId).single()).data!
    const party = (game.state as { party: Array<{ characterId: string }> }).party
    expect(party.map((m) => m.characterId)).toEqual([...g.ids, id])

    const ch = (await alice.client.from('characters').select('owner_id, player_id, data').eq('id', id).single()).data!
    expect(ch.owner_id).toBe(alice.id)
    expect(ch.player_id).not.toBeNull()
    const pl = (await alice.client.from('players').select('name').eq('id', ch.player_id!).single()).data!
    expect(pl.name).toBe('Zoé')

    const pts = (await alice.client.from('game_points').select('*').eq('game_id', g.gameId).eq('character_id', id).single()).data!
    expect(pts).toMatchObject({ pv: 11, san: 55, chance: 45, pm: 9, source: 'phone', owner_id: alice.id })

    // Defaults when the sheet gives no points.
    const d = await anon.rpc('companion_create_character', { p_token: l.token, p_data: { name: 'Bare' }, p_player_name: '' })
    expect(d.error).toBeNull()
    const dp = (await alice.client.from('game_points').select('pv, san, chance, pm').eq('character_id', d.data as unknown as string).single()).data!
    expect(dp).toEqual({ pv: 10, san: 50, chance: 50, pm: 10 })
    const dc = (await alice.client.from('characters').select('player_id').eq('id', d.data as unknown as string).single()).data!
    expect(dc.player_id).toBeNull()

    // The new investigator shows up when the link is opened.
    const o = (await anon.rpc('companion_open', { p_token: l.token })).data as unknown as Opened
    expect(o.party.map((p) => p.id)).toContain(id)
  })

  it("the player's typed name reuses the keeper's player, case-insensitively", async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    const lea = await alice.client.from('players').insert({ name: 'Léa' }).select('id').single()
    expect(lea.error).toBeNull()
    const before = (await alice.client.from('players').select('id')).data!.length
    const { data, error } = await anon.rpc('companion_create_character', {
      p_token: l.token, p_data: { name: 'Léa’s investigator' }, p_player_name: ' léa ',
    })
    expect(error).toBeNull()
    const ch = (await alice.client.from('characters').select('player_id').eq('id', data as unknown as string).single()).data!
    expect(ch.player_id).toBe(lea.data!.id)
    expect((await alice.client.from('players').select('id')).data).toHaveLength(before)
  })

  it("personal links can't create, and bad data is refused", async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const personal = await link(alice, g.gameId, g.ids[0])
    const r = await anon.rpc('companion_create_character', { p_token: personal.token, p_data: { name: 'X' }, p_player_name: '' })
    expect(r.error?.message).toContain('not_in_game')
    const table = await link(alice, g.gameId)
    for (const p_data of [{ name: '  ' }, {}, [], 'x'] as Json[]) {
      const bad = await anon.rpc('companion_create_character', { p_token: table.token, p_data, p_player_name: '' })
      expect(bad.error?.message).toContain('bad_value')
    }
    for (const extra of [{ hp: 11.5 }, { hp: 'abc' }, { san: 100 }, { luck: -1 }, { mp: null }] as Json[]) {
      const bad = await anon.rpc('companion_create_character', { p_token: table.token, p_data: { name: 'X', ...(extra as object) }, p_player_name: '' })
      expect(bad.error?.message).toContain('bad_value')
    }
    const nope = await anon.rpc('companion_create_character', { p_token: 'nope', p_data: { name: 'X' }, p_player_name: '' })
    expect(nope.error?.message).toContain('link_invalid')
  })

  it('a 13th investigator is refused', async () => {
    const g = await newGame(alice, Array.from({ length: 12 }, (_, i) => ({ name: `I${i}` })))
    const l = await link(alice, g.gameId)
    const r = await anon.rpc('companion_create_character', { p_token: l.token, p_data: { name: 'Late' }, p_player_name: '' })
    expect(r.error?.message).toContain('party_full')
  })

  it("anonymous visitors can't write the tables to create a character", async () => {
    const r = await anon.from('characters').insert({ data: { name: 'Sneaky' } })
    expect(r.error).not.toBeNull()
  })

  async function waitFor<T>(subscribe: (resolve: (v: T) => void) => Promise<() => Promise<void>>, act: () => Promise<void>): Promise<T> {
    let off: () => Promise<void> = async () => {}
    try {
      return await new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('no broadcast within 5 s')), 5000)
        subscribe((v) => { clearTimeout(timer); resolve(v) })
          .then((o) => { off = o; return act() })
          .catch(reject)
      })
    } finally {
      await off()
    }
  }

  async function listen(channel: string, event: string, onMessage: (payload: unknown) => void) {
    const client = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
    const ch = client.channel(`companion:${channel}`)
    ch.on('broadcast', { event }, (m) => onMessage(m.payload))
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('not SUBSCRIBED within 5 s')), 5000)
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve() }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error(status)) }
      })
    })
    return async () => { await client.removeChannel(ch); await client.realtime.disconnect() }
  }

  it("points changes are broadcast on the game's topic", async () => {
    const g = await newGame(alice, [{ name: 'One', hp: 12 }])
    const l = await link(alice, g.gameId)
    const channel = (await alice.client.from('games').select('channel').eq('id', g.gameId).single()).data!.channel
    const payload = await waitFor<Record<string, unknown>>(
      (resolve) => listen(channel, 'points', (p) => resolve(p as Record<string, unknown>)),
      async () => {
        const { error } = await anon.rpc('companion_set_points', { p_token: l.token, p_character: g.ids[0], p_pv: 7, p_san: 44, p_chance: 30, p_pm: 5 })
        expect(error).toBeNull()
      },
    )
    expect(payload).toMatchObject({ characterId: g.ids[0], pv: 7, san: 44, chance: 30, pm: 5, checks: [], source: 'phone' })
    expect(payload.updatedAt).toEqual(expect.any(String))
  })

  it('notes and new members are broadcast too', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    const channel = (await alice.client.from('games').select('channel').eq('id', g.gameId).single()).data!.channel
    const note = await waitFor<Record<string, unknown>>(
      (resolve) => listen(channel, 'notes', (p) => resolve(p as Record<string, unknown>)),
      async () => {
        const { error } = await anon.rpc('companion_add_note', { p_token: l.token, p_character: g.ids[0], p_body: 'live' })
        expect(error).toBeNull()
      },
    )
    expect(note).toMatchObject({ characterId: g.ids[0] })

    let created = ''
    const member = await waitFor<Record<string, unknown>>(
      (resolve) => listen(channel, 'member', (p) => resolve(p as Record<string, unknown>)),
      async () => {
        const { data, error } = await anon.rpc('companion_create_character', { p_token: l.token, p_data: { name: 'Live' }, p_player_name: '' })
        expect(error).toBeNull()
        created = data as unknown as string
      },
    )
    expect(member).toMatchObject({ characterId: created })
  })

  it("notes pings don't leak to another keeper's game that lists the character", async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    const { data: st } = await bob.client.from('stories').select('id').limit(1).single()
    const bobGame = await bob.client
      .from('games').insert({ story_id: st!.id, state: { party: [{ characterId: g.ids[0] }] } }).select('channel').single()
    expect(bobGame.error).toBeNull()
    const aliceChannel = (await alice.client.from('games').select('channel').eq('id', g.gameId).single()).data!.channel

    const onBob: unknown[] = []
    const offBob = await listen(bobGame.data!.channel, 'notes', (p) => onBob.push(p))
    try {
      const got = await waitFor<Record<string, unknown>>(
        (resolve) => listen(aliceChannel, 'notes', (p) => resolve(p as Record<string, unknown>)),
        async () => {
          const { error } = await anon.rpc('companion_add_note', { p_token: l.token, p_character: g.ids[0], p_body: 'private' })
          expect(error).toBeNull()
        },
      )
      expect(got).toMatchObject({ characterId: g.ids[0] })
      // Alice's ping arrived: bob's would have been sent in the same statement.
      await new Promise((r) => setTimeout(r, 500))
      expect(onBob).toEqual([])
    } finally {
      await offBob()
    }
  })
})

describe('companion: keeper saves', () => {
  const partyOf = async (gameId: string) =>
    ((await alice.client.from('games').select('state').eq('id', gameId).single()).data!.state as { party: Array<{ characterId: string }> })
      .party.map((m) => m.characterId)

  it("saving the engine's state keeps investigators who joined from a phone, unless removed", async () => {
    const g = await newGame(alice, [{ name: 'A' }])
    const [A] = g.ids
    const l = await link(alice, g.gameId)
    const { data, error } = await anon.rpc('companion_create_character', { p_token: l.token, p_data: { name: 'B' }, p_player_name: '' })
    expect(error).toBeNull()
    const B = data as unknown as string

    // The keeper's engine hasn't seen B yet.
    const engineState = { scene: 'start', done: ['x'], party: [{ characterId: A }], legacy: { v: 1 } }
    const s1 = await alice.client.rpc('save_game_state', { p_game: g.gameId, p_state: engineState, p_removed: [] })
    expect(s1.error).toBeNull()
    expect(await partyOf(g.gameId)).toEqual([A, B])
    const saved = (await alice.client.from('games').select('state').eq('id', g.gameId).single()).data!.state
    expect(saved).toMatchObject({ scene: 'start', done: ['x'], legacy: { v: 1 } })
    // B still reaches the game from the phone.
    expect((await anon.rpc('companion_set_points', { p_token: l.token, p_character: B, p_pv: 5, p_san: 5, p_chance: 5, p_pm: 5 })).error).toBeNull()

    // Removed by the keeper in the engine: gone.
    const s2 = await alice.client.rpc('save_game_state', { p_game: g.gameId, p_state: engineState, p_removed: [B] })
    expect(s2.error).toBeNull()
    expect(await partyOf(g.gameId)).toEqual([A])
  })

  it("only the game's owner can save it", async () => {
    const g = await newGame(alice, [{ name: 'A' }])
    await bob.client.rpc('save_game_state', { p_game: g.gameId, p_state: { party: [] }, p_removed: g.ids })
    expect(await partyOf(g.gameId)).toEqual(g.ids)
    const r = await anon.rpc('save_game_state', { p_game: g.gameId, p_state: { party: [] }, p_removed: g.ids })
    expect(r.error).not.toBeNull()
  })

  it('points get the server time, not the client one', async () => {
    const g = await newGame(alice, [{ name: 'A' }])
    const r = await alice.client.from('game_points').upsert({
      game_id: g.gameId, character_id: g.ids[0], pv: 1, san: 1, chance: 1, pm: 1, source: 'keeper', updated_at: '2099-01-01T00:00:00Z',
    }).select('updated_at').single()
    expect(r.error).toBeNull()
    expect(Date.parse(r.data!.updated_at)).toBeLessThan(Date.parse('2090-01-01T00:00:00Z'))
  })
})
