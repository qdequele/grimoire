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
    const pts = await anon.rpc('companion_set_point', { p_token: l.token, p_character: other.ids[0], p_field: 'pm', p_value: 1 })
    expect(pts.error?.message).toContain('not_in_game')
    const note = await anon.rpc('companion_add_note', { p_token: l.token, p_character: other.ids[0], p_body: 'x' })
    expect(note.error?.message).toContain('not_in_game')
    const bobs = await anon.rpc('companion_add_note', { p_token: l.token, p_character: b.characterId, p_body: 'x' })
    expect(bobs.error?.message).toContain('not_in_game')
  })

  it("a personal link can't write to another party member", async () => {
    const g = await newGame(alice, [{ name: 'One' }, { name: 'Two' }])
    const l = await link(alice, g.gameId, g.ids[0])
    const pts = await anon.rpc('companion_set_point', { p_token: l.token, p_character: g.ids[1], p_field: 'pm', p_value: 1 })
    expect(pts.error?.message).toContain('not_in_game')
    const note = await anon.rpc('companion_add_note', { p_token: l.token, p_character: g.ids[1], p_body: 'x' })
    expect(note.error?.message).toContain('not_in_game')
    const own = await anon.rpc('companion_add_note', { p_token: l.token, p_character: g.ids[0], p_body: 'mine' })
    expect(own.error).toBeNull()
    expect(own.data).toEqual(expect.any(String))
  })

  it('set_point writes one field and keeps a keeper change made in the meantime', async () => {
    const g = await newGame(alice, [{ name: 'One', hp: 11, progress: { san: 52 } }])
    const l = await link(alice, g.gameId)
    const set = (p_field: string, p_value: number) =>
      anon.rpc('companion_set_point', { p_token: l.token, p_character: g.ids[0], p_field, p_value })
    const row = async () =>
      (await alice.client.from('game_points').select('*').eq('game_id', g.gameId).eq('character_id', g.ids[0]).single()).data!

    // No row yet: the others start from the sheet (current SAN from the progression).
    expect((await set('chance', 40)).error).toBeNull()
    expect(await row()).toMatchObject({ pv: 11, san: 52, chance: 40, pm: 10, source: 'phone' })

    // The keeper applies damage, then the phone's queued SAN tap lands: the damage stays.
    const keeper = await alice.client.from('game_points').update({ pv: 4, source: 'keeper' }).eq('game_id', g.gameId).eq('character_id', g.ids[0])
    expect(keeper.error).toBeNull()
    expect((await set('san', 53)).error).toBeNull()
    expect(await row()).toMatchObject({ pv: 4, san: 53, chance: 40, pm: 10, source: 'phone' })
    const ch = (await alice.client.from('characters').select('data').eq('id', g.ids[0]).single()).data!.data as { progress: Record<string, unknown> }
    expect(ch.progress.san).toBe(53)
  })

  it('set_point refuses unknown fields and out-of-bounds values', async () => {
    const g = await newGame(alice, [{ name: 'One', hp: 12 }])
    const l = await link(alice, g.gameId)
    const set = (p_field: string, p_value: number) =>
      anon.rpc('companion_set_point', { p_token: l.token, p_character: g.ids[0], p_field, p_value })
    expect((await set('checks', 1)).error?.message).toContain('bad_value')
    expect((await set('PV', 1)).error?.message).toContain('bad_value')
    expect((await set('pv', 12)).error).toBeNull()
    expect((await set('pv', 13)).error?.message).toContain('bad_value')
    expect((await set('pv', -1)).error?.message).toContain('bad_value')
    expect((await set('san', 99)).error).toBeNull()
    expect((await set('san', 100)).error?.message).toContain('bad_value')
    expect((await set('chance', 100)).error?.message).toContain('bad_value')
    expect((await set('pm', -1)).error?.message).toContain('bad_value')
  })

  it('set_point: a personal link writes only its investigator, a revoked one nothing', async () => {
    const g = await newGame(alice, [{ name: 'One' }, { name: 'Two' }])
    const l = await link(alice, g.gameId, g.ids[0])
    const set = (p_character: string) => anon.rpc('companion_set_point', { p_token: l.token, p_character, p_field: 'pm', p_value: 3 })
    expect((await set(g.ids[1])).error?.message).toContain('not_in_game')
    expect((await set(g.ids[0])).error).toBeNull()
    await alice.client.rpc('revoke_table_link', { p_link: l.id })
    expect((await set(g.ids[0])).error?.message).toContain('link_invalid')
  })

  it('a deleted investigator disappears from the companion', async () => {
    const g = await newGame(alice, [{ name: 'One' }, { name: 'Two' }])
    const l = await link(alice, g.gameId)
    await alice.client.from('characters').delete().eq('id', g.ids[1])
    const o = (await anon.rpc('companion_open', { p_token: l.token })).data as unknown as Opened
    expect(o.party.map((p) => p.id)).toEqual([g.ids[0]])
    const pts = await anon.rpc('companion_set_point', { p_token: l.token, p_character: g.ids[1], p_field: 'pm', p_value: 1 })
    expect(pts.error?.message).toContain('not_in_game')
  })

  it('phone points are stored with source phone and update persisted SAN', async () => {
    const g = await newGame(alice, [{ name: 'One', hp: 10, progress: { san: 60, other: 1 } }, { name: 'Two' }])
    const l = await link(alice, g.gameId)
    await alice.client.from('game_points').insert({ game_id: g.gameId, character_id: g.ids[0], pv: 10, san: 60, chance: 40, pm: 8, checks: ['Fouiller'], source: 'keeper' })
    for (const [p_field, p_value] of [['pv', 7], ['san', 44], ['chance', 30], ['pm', 5]] as const) {
      const { error } = await anon.rpc('companion_set_point', { p_token: l.token, p_character: g.ids[0], p_field, p_value })
      expect(error).toBeNull()
    }
    const row = (await alice.client.from('game_points').select('*').eq('game_id', g.gameId).eq('character_id', g.ids[0]).single()).data!
    expect(row).toMatchObject({ pv: 7, san: 44, chance: 30, pm: 5, source: 'phone', checks: ['Fouiller'] })
    const ch = (await alice.client.from('characters').select('data').eq('id', g.ids[0]).single()).data!.data as { progress: Record<string, unknown> }
    expect(ch.progress).toEqual({ san: 44, other: 1 })
    // No progress yet: none is invented; a missing points row is created.
    expect((await anon.rpc('companion_set_point', { p_token: l.token, p_character: g.ids[1], p_field: 'san', p_value: 20 })).error).toBeNull()
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
// ------------------------------------------------------------------ live helpers
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

  it('a hostile or malformed sheet is refused before it reaches the account', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    const create = (p_data: Json) => anon.rpc('companion_create_character', { p_token: l.token, p_data, p_player_name: '' })
    const hostile: Json[] = [
      { name: 'X', characteristics: { DEX: '<img src=x onerror=1>' } },
      { name: 'X', characteristics: { DEX: 50, '<b>': 50 } },
      { name: 'X', characteristics: { DEX: 100 } },
      { name: 'X', characteristics: [50] },
      { name: 'X', damageBonus: '<script>' },
      { name: 'X', damageBonus: 4 },
      { name: 'X', hp: 5.5 },
      { name: 'X', hp: '5' },
      { name: 'X', age: 151 },
      { name: 'X', move: 21 },
      { name: 'X', build: -11 },
      { name: 'X', occupation: 'o'.repeat(201) },
      { name: 'X', link: 3 },
      { name: 'X', skills: { spot: '<i>' } },
      { name: 'X', skills: { spot: 100 } },
      { name: 'X', skills: { ['k'.repeat(81)]: 5 } },
      { name: 'X', skills: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`s${i}`, 1])) },
      { name: 'X', profile: { backstory: 'p'.repeat(2001) } },
      { name: 'X', profile: { ['k'.repeat(41)]: 'x' } },
      { name: 'X', profile: { backstory: 5 } },
      { name: 'X', creation: 'x' },
      { name: 'X', unknown: 1 },
      JSON.parse('{"name":"X","__proto__":1}') as Json,
      { name: 'n'.repeat(81) },
      { name: 5 },
      { name: 'X', creation: { blob: 'z'.repeat(70000) } },
    ]
    for (const p_data of hostile) {
      const r = await create(p_data)
      expect(r.error?.message, JSON.stringify(p_data).slice(0, 80)).toContain('bad_value')
    }

    // A whole sheet from the wizard is accepted; 5.0 is a whole number; progress is dropped.
    const ok = await create({
      name: ' Valid ', occupation: 'Journalist', age: 30, link: 'Cousin',
      characteristics: { STR: 50, CON: 60, SIZ: 40, DEX: 70, APP: 50, INT: 80, POW: 60, EDU: 90 },
      hp: 5.0, mp: 12, san: 60, luck: 45, move: 8, build: 0, damageBonus: '+1D4',
      skills: { spot: 60, 'art-craft:Photographie': 45 }, profile: { backstory: 'Born in Boston.' },
      creation: { name: 'Valid', step: 3 }, progress: { san: 1 },
    })
    expect(ok.error).toBeNull()
    const ch = (await alice.client.from('characters').select('data').eq('id', ok.data as unknown as string).single()).data!
    const data = ch.data as Record<string, unknown>
    expect(data).toMatchObject({ name: 'Valid', hp: 5, damageBonus: '+1D4', characteristics: { DEX: 70 }, creation: { step: 3 } })
    expect(data).not.toHaveProperty('progress')
    const pts = (await alice.client.from('game_points').select('pv').eq('character_id', ok.data as unknown as string).single()).data!
    expect(pts.pv).toBe(5)
  })

  it('skill keys must have the app shape, and names carry no HTML characters', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    const create = (p_data: Json, p_player_name = '') => anon.rpc('companion_create_character', { p_token: l.token, p_data, p_player_name })
    const hostileKeys = [
      '<img src=x onerror="window.__xss=1">', 'spot<b>', 'art-craft:<i>x</i>', 'art-craft:a&b', 'art-craft:"q"',
      'Spot', '1spot', 'spot hidden', 'spot:', ':x', '',
    ]
    for (const key of hostileKeys) {
      expect((await create({ name: 'X', skills: { [key]: 5 } })).error?.message, key).toContain('bad_value')
    }
    for (const name of ['<b>X</b>', 'A & B', 'Say "hi"', 'x>']) {
      expect((await create({ name })).error?.message, name).toContain('bad_value')
    }
    for (const player of ['<img src=x onerror="window.__xss=1">', 'Bo&b', '"Q"']) {
      expect((await create({ name: 'X' }, player)).error?.message, player).toContain('bad_value')
    }
    // The app's own keys, accents and apostrophes in specialties and names are fine.
    const ok = await create({ name: "Ada O'Brien", skills: { 'spot-hidden': 5, 'science-2:Pharmacologie': 5, "art-craft:Peinture à l'huile": 5 } }, 'Zoé')
    expect(ok.error).toBeNull()
  })

  it('texts are accepted at their length limit and refused one character over', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    const create = (p_data: Json, p_player_name = '') => anon.rpc('companion_create_character', { p_token: l.token, p_data, p_player_name })
    const a = (n: number) => 'a'.repeat(n)
    const key = (n: number) => `art-craft:${a(n - 'art-craft:'.length)}`
    const atLimit = await create(
      { name: a(80), occupation: a(200), link: a(200), profile: { traits: a(2000) }, skills: { [key(80)]: 5 } },
      a(80),
    )
    expect(atLimit.error).toBeNull()
    const over: Array<[Json, string]> = [
      [{ name: a(81) }, ''],
      [{ name: 'X', occupation: a(201) }, ''],
      [{ name: 'X', link: a(201) }, ''],
      [{ name: 'X', profile: { traits: a(2001) } }, ''],
      [{ name: 'X', skills: { [key(81)]: 5 } }, ''],
      [{ name: 'X' }, a(81)],
    ]
    for (const [p_data, player] of over) {
      expect((await create(p_data, player)).error?.message, JSON.stringify(p_data).slice(0, 60)).toContain('bad_value')
    }
  })

  it('set_point reads a hand-edited sheet without failing', async () => {
    const g = await newGame(alice, [{ name: 'Text hp', hp: '12' }, { name: 'Half hp', hp: 11.5, luck: 'x' }])
    const l = await link(alice, g.gameId)
    const set = (p_character: string, p_value: number) =>
      anon.rpc('companion_set_point', { p_token: l.token, p_character, p_field: 'pv', p_value })
    // Not a number: the default maximum (10).
    expect((await set(g.ids[0], 10)).error).toBeNull()
    expect((await set(g.ids[0], 11)).error?.message).toContain('bad_value')
    // 11.5 rounds down.
    expect((await set(g.ids[1], 11)).error).toBeNull()
    expect((await set(g.ids[1], 12)).error?.message).toContain('bad_value')
    const row = (await alice.client.from('game_points').select('chance').eq('character_id', g.ids[1]).single()).data!
    expect(row.chance).toBe(50)
  })

  it('the whole-row companion_set_points is gone', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    const args = { p_token: l.token, p_character: g.ids[0], p_pv: 1, p_san: 1, p_chance: 1, p_pm: 1 }
    const r = await anon.rpc('companion_set_points' as 'companion_set_point', args as never)
    expect(r.error?.code).toBe('PGRST202')
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

  it("points changes are broadcast on the game's topic", async () => {
    const g = await newGame(alice, [{ name: 'One', hp: 12 }])
    const l = await link(alice, g.gameId)
    const channel = (await alice.client.from('games').select('channel').eq('id', g.gameId).single()).data!.channel
    const payload = await waitFor<Record<string, unknown>>(
      (resolve) => listen(channel, 'points', (p) => resolve(p as Record<string, unknown>)),
      async () => {
        const { error } = await anon.rpc('companion_set_point', { p_token: l.token, p_character: g.ids[0], p_field: 'pv', p_value: 7 })
        expect(error).toBeNull()
      },
    )
    expect(payload).toMatchObject({ characterId: g.ids[0], pv: 7, san: 50, chance: 50, pm: 10, checks: [], source: 'phone' })
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

  it('revoking a link sends rotate on the old topic, then moves the game', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    const old = (await alice.client.from('games').select('channel').eq('id', g.gameId).single()).data!.channel
    const payload = await waitFor<unknown>(
      (resolve) => listen(old, 'rotate', resolve),
      async () => {
        const { error } = await alice.client.rpc('revoke_table_link', { p_link: l.id })
        expect(error).toBeNull()
      },
    )
    // Empty payload (Realtime adds its own message id).
    expect(Object.keys(payload as object).filter((k) => k !== 'id')).toEqual([])
    const now = (await alice.client.from('games').select('channel').eq('id', g.gameId).single()).data!.channel
    expect(now).not.toBe(old)
  })

  it("revoking someone else's link does nothing", async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    const before = (await alice.client.from('games').select('channel').eq('id', g.gameId).single()).data!.channel
    expect((await bob.client.rpc('revoke_table_link', { p_link: l.id })).error).toBeNull()
    expect((await anon.rpc('revoke_table_link', { p_link: l.id })).error).not.toBeNull()
    expect((await anon.rpc('companion_open', { p_token: l.token })).error).toBeNull()
    const after = (await alice.client.from('games').select('channel').eq('id', g.gameId).single()).data!.channel
    expect(after).toBe(before)
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
    expect((await anon.rpc('companion_set_point', { p_token: l.token, p_character: B, p_field: 'pv', p_value: 5 })).error).toBeNull()

    // Removed by the keeper in the engine: gone.
    const s2 = await alice.client.rpc('save_game_state', { p_game: g.gameId, p_state: engineState, p_removed: [B] })
    expect(s2.error).toBeNull()
    expect(await partyOf(g.gameId)).toEqual([A])
  })

  it("a save is stamped with the server's time, after the points written before it", async () => {
    const g = await newGame(alice, [{ name: 'A' }])
    const l = await link(alice, g.gameId)
    expect((await anon.rpc('companion_set_point', { p_token: l.token, p_character: g.ids[0], p_field: 'pm', p_value: 3 })).error).toBeNull()
    const s = await alice.client.rpc('save_game_state', { p_game: g.gameId, p_state: { party: [{ characterId: g.ids[0] }], serverSavedAt: 1 }, p_removed: [] })
    expect(s.error).toBeNull()
    const state = (await alice.client.from('games').select('state').eq('id', g.gameId).single()).data!.state as { serverSavedAt: number }
    const pts = (await alice.client.from('game_points').select('updated_at').eq('character_id', g.ids[0]).single()).data!
    expect(state.serverSavedAt).toBeGreaterThanOrEqual(Date.parse(pts.updated_at))
    expect(state.serverSavedAt).toBeLessThan(Date.parse(pts.updated_at) + 60_000)
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

describe('companion: dice rolls', () => {
  const channelOf = async (gameId: string) =>
    (await alice.client.from('games').select('channel').eq('id', gameId).single()).data!.channel

  it('a check is rolled by the server, kept for the keeper only, and announced on the topic', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    let roll: Record<string, unknown> = {}
    const hint = await waitFor<Record<string, unknown>>(
      async (resolve) => listen(await channelOf(g.gameId), 'roll', (p) => resolve(p as Record<string, unknown>)),
      async () => {
        const { data, error } = await anon.rpc('companion_roll_check', {
          p_token: l.token, p_character: g.ids[0], p_subject: 'skill:spot-hidden', p_target: 60, p_net: 1,
        })
        expect(error).toBeNull()
        roll = data as Record<string, unknown>
      },
    )
    expect(hint).toMatchObject({ characterId: g.ids[0] })
    expect(roll).toMatchObject({ kind: 'check', characterId: g.ids[0], subject: 'skill:spot-hidden', target: 60, net: 1 })
    const dice = roll.dice as { tens: number[]; units: number }
    expect(dice.tens).toHaveLength(2)
    const values = dice.tens.map((t) => (t === 0 && dice.units === 0 ? 100 : t * 10 + dice.units))
    expect(roll.result).toBe(Math.min(...values))
    const r = roll.result as number
    expect(roll.level).toBe(r <= 12 ? 'extreme' : r <= 30 ? 'hard' : r <= 60 ? 'regular' : 'failure')

    const rows = (await alice.client.from('game_rolls').select('id, result').eq('game_id', g.gameId)).data
    expect(rows).toEqual([{ id: roll.id, result: roll.result }])
    expect((await bob.client.from('game_rolls').select('id').eq('game_id', g.gameId)).data).toEqual([])
    expect((await anon.from('game_rolls').select('id')).data ?? []).toEqual([])
  })

  it('penalty dice keep the highest; results stay within 1..100', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    for (let i = 0; i < 15; i++) {
      const { data, error } = await anon.rpc('companion_roll_check', {
        p_token: l.token, p_character: g.ids[0], p_subject: 'char:POW', p_target: 50, p_net: -2,
      })
      expect(error).toBeNull()
      const roll = data as { result: number; dice: { tens: number[]; units: number } }
      expect(roll.dice.tens).toHaveLength(3)
      const values = roll.dice.tens.map((t) => (t === 0 && roll.dice.units === 0 ? 100 : t * 10 + roll.dice.units))
      expect(roll.result).toBe(Math.max(...values))
      expect(roll.result).toBeGreaterThanOrEqual(1)
      expect(roll.result).toBeLessThanOrEqual(100)
    }
  })

  it('free dice: count × sides + modifier', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    for (const sides of [3, 6, 20]) {
      const { data, error } = await anon.rpc('companion_roll_dice', {
        p_token: l.token, p_character: g.ids[0], p_count: 3, p_sides: sides, p_modifier: -1,
      })
      expect(error).toBeNull()
      const roll = data as { kind: string; result: number; dice: { count: number; sides: number; modifier: number; results: number[] } }
      expect(roll.kind).toBe('dice')
      expect(roll.dice).toMatchObject({ count: 3, sides, modifier: -1 })
      expect(roll.dice.results).toHaveLength(3)
      expect(roll.dice.results.every((d) => d >= 1 && d <= sides)).toBe(true)
      expect(roll.result).toBe(roll.dice.results.reduce((a, b) => a + b, 0) - 1)
    }
  })

  it('refuses bad values, other investigators and revoked links', async () => {
    const g = await newGame(alice, [{ name: 'One' }, { name: 'Two' }])
    const other = await newGame(bob, [{ name: 'Elsewhere' }])
    const l = await link(alice, g.gameId)
    const personal = await link(alice, g.gameId, g.ids[0])
    const check = (over: Record<string, unknown>) =>
      anon.rpc('companion_roll_check', {
        p_token: l.token, p_character: g.ids[0], p_subject: 'san', p_target: 50, p_net: 0, ...over,
      } as Database['public']['Functions']['companion_roll_check']['Args'])
    for (const bad of [
      { p_subject: 'skill:Spot Hidden' }, { p_subject: 'skill:x:<b>' }, { p_subject: 'char:XYZ' }, { p_subject: 'sanity' },
      { p_target: -1 }, { p_target: 201 }, { p_net: 3 }, { p_net: -3 },
    ]) expect((await check(bad)).error?.message).toContain('bad_value')
    expect((await check({ p_character: other.ids[0] })).error?.message).toContain('not_in_game')
    expect((await check({ p_token: personal.token, p_character: g.ids[1] })).error?.message).toContain('not_in_game')
    expect((await check({ p_token: personal.token })).error).toBeNull()

    const dice = (over: Record<string, unknown>) =>
      anon.rpc('companion_roll_dice', {
        p_token: l.token, p_character: g.ids[0], p_count: 1, p_sides: 6, p_modifier: 0, ...over,
      } as Database['public']['Functions']['companion_roll_dice']['Args'])
    for (const bad of [{ p_count: 0 }, { p_count: 11 }, { p_sides: 7 }, { p_modifier: 21 }, { p_modifier: -21 }]) {
      expect((await dice(bad)).error?.message).toContain('bad_value')
    }

    await alice.client.from('table_links').update({ revoked_at: new Date().toISOString() }).eq('id', l.id)
    expect((await check({})).error?.message).toContain('link_invalid')
  })

  it('keeps the 100 newest rolls of a game', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    for (let i = 0; i < 103; i++) {
      const { error } = await anon.rpc('companion_roll_dice', { p_token: l.token, p_character: g.ids[0], p_count: 1, p_sides: 6, p_modifier: 0 })
      expect(error).toBeNull()
    }
    const { count } = await alice.client.from('game_rolls').select('id', { count: 'exact', head: true }).eq('game_id', g.gameId)
    expect(count).toBe(100)
  })

  it("anonymous visitors can't call the internals or write rolls", async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    expect((await anon.rpc('companion_d10' as never)).error).not.toBeNull()
    expect((await anon.rpc('companion_roll_prune', { p_game: g.gameId })).error).not.toBeNull()
    const forged = await alice.client.from('game_rolls').insert({
      game_id: g.gameId, owner_id: alice.id, character_id: g.ids[0], kind: 'dice', dice: {}, result: 100,
    })
    expect(forged.error).not.toBeNull()
  })
})

// ------------------------------------------------------------------ investigator photos
// Smallest valid-looking JPEG data URL (only the format is checked: base64, JPEG magic bytes).
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w=='

describe('companion: investigator photos', () => {
  it('a phone sets and removes a photo; companion_open returns it', async () => {
    const g = await newGame(alice, [{ name: 'One' }, { name: 'Two' }])
    const l = await link(alice, g.gameId)
    expect((await anon.rpc('companion_set_photo', { p_token: l.token, p_character: g.ids[1], p_photo: JPEG })).error).toBeNull()
    const opened = (await anon.rpc('companion_open', { p_token: l.token })).data as unknown as { party: Array<{ id: string; photo: string | null }> }
    expect(opened.party.find((p) => p.id === g.ids[1])?.photo).toBe(JPEG)
    expect(opened.party.find((p) => p.id === g.ids[0])?.photo).toBeNull()
    // The keeper reads it with the investigator.
    expect((await alice.client.from('characters').select('photo').eq('id', g.ids[1]).single()).data?.photo).toBe(JPEG)

    expect((await anon.rpc('companion_set_photo', { p_token: l.token, p_character: g.ids[1], p_photo: '' })).error).toBeNull()
    expect((await alice.client.from('characters').select('photo').eq('id', g.ids[1]).single()).data?.photo).toBeNull()
  })

  it('anything but a small base64 image is refused, from a phone or the keeper', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    const bad = [
      'https://example.com/me.jpg',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'data:image/jpeg;base64,/9j/");background:url(x',
      'data:image/png;base64,/9j/AAAA', // JPEG bytes announced as PNG
      'data:image/jpeg;base64,/9j/' + 'A'.repeat(60_000),
    ]
    for (const p_photo of bad) {
      const r = await anon.rpc('companion_set_photo', { p_token: l.token, p_character: g.ids[0], p_photo })
      expect(r.error?.message, p_photo.slice(0, 40)).toContain('bad_value')
      const k = await alice.client.from('characters').update({ photo: p_photo }).eq('id', g.ids[0])
      expect(k.error, p_photo.slice(0, 40)).not.toBeNull()
    }
  })

  it('a personal link sets only its own photo; other games and revoked links nothing', async () => {
    const g = await newGame(alice, [{ name: 'One' }, { name: 'Two' }])
    const other = await newGame(alice, [{ name: 'Other' }])
    const l = await link(alice, g.gameId, g.ids[0])
    const set = (p_character: string) => anon.rpc('companion_set_photo', { p_token: l.token, p_character, p_photo: JPEG })
    expect((await set(g.ids[1])).error?.message).toContain('not_in_game')
    expect((await set(other.ids[0])).error?.message).toContain('not_in_game')
    expect((await set(b.characterId)).error?.message).toContain('not_in_game')
    expect((await set(g.ids[0])).error).toBeNull()
    await alice.client.rpc('revoke_table_link', { p_link: l.id })
    expect((await set(g.ids[0])).error?.message).toContain('link_invalid')
    expect((await bob.client.from('characters').select('photo').eq('id', g.ids[0])).data).toEqual([])
  })

  it("a photo change is broadcast on the game's topic", async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const l = await link(alice, g.gameId)
    const channel = (await alice.client.from('games').select('channel').eq('id', g.gameId).single()).data!.channel
    const payload = await waitFor<Record<string, unknown>>(
      (resolve) => listen(channel, 'photo', (p) => resolve(p as Record<string, unknown>)),
      async () => {
        const { error } = await anon.rpc('companion_set_photo', { p_token: l.token, p_character: g.ids[0], p_photo: JPEG })
        expect(error).toBeNull()
      },
    )
    expect(payload).toMatchObject({ characterId: g.ids[0] })
  })
})

describe('companion: items', () => {
  const revolver: Json = { name: 'Revolver', kind: 'weapon', uses: 6, ammo: '.38', weapon: { skill: 'firearms-handgun', damage: '1D10' } }
  const box: Json = { name: 'Box of .38', kind: 'ammo', uses: 20, ammo: '.38' }
  const rope: Json = { name: 'Rope', kind: 'tool' }
  const give = (characterId: string, card: Json, uses: number | null) =>
    alice.client.from('character_items').insert({ character_id: characterId, card, uses }).select('id').single()

  it('the keeper gives cards; only they read them; companion_open lists the party members\'', async () => {
    const g = await newGame(alice, [{ name: 'One' }, { name: 'Two' }])
    const gun = await give(g.ids[0], revolver, 6)
    expect(gun.error).toBeNull()
    expect((await give(g.ids[1], rope, null)).error).toBeNull()
    expect((await bob.client.from('character_items').select('id')).data).toEqual([])
    // Not on someone else's investigator.
    expect((await alice.client.from('character_items').insert({ character_id: b.characterId, card: rope })).error).not.toBeNull()

    const l = await link(alice, g.gameId)
    const opened = (await anon.rpc('companion_open', { p_token: l.token })).data as unknown as { items: Array<{ id: string; characterId: string; uses: number | null; card: { name: string } }> }
    expect(opened.items).toHaveLength(2)
    expect(opened.items.find((i) => i.id === gun.data!.id)).toMatchObject({ characterId: g.ids[0], uses: 6, card: { name: 'Revolver' } })
  })

  it('cards and uses are checked: bad cards, uses out of bounds, uses on a card without any', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const bad: Json[] = [
      { name: '', kind: 'tool' },
      { name: '<b>x</b>', kind: 'tool' },
      { name: 'X', kind: 'spell' },
      { name: 'X', kind: 'tool', uses: 0 },
      { name: 'X', kind: 'tool', uses: 'six' },
      { name: 'X'.repeat(61), kind: 'tool' },
      { name: 'X', kind: 'tool', text: 'x'.repeat(4000) },
      [],
    ]
    for (const card of bad) expect((await give(g.ids[0], card, null)).error, JSON.stringify(card).slice(0, 40)).not.toBeNull()
    expect((await give(g.ids[0], revolver, 7)).error).not.toBeNull()
    expect((await give(g.ids[0], revolver, null)).error).not.toBeNull()
    expect((await give(g.ids[0], rope, 3)).error).not.toBeNull()
  })

  it('a phone spends and regains uses within the card; a personal link only its own', async () => {
    const g = await newGame(alice, [{ name: 'One' }, { name: 'Two' }])
    const gun = (await give(g.ids[0], revolver, 6)).data!.id
    const other = (await give(g.ids[1], revolver, 6)).data!.id
    const ropeId = (await give(g.ids[0], rope, null)).data!.id
    const l = await link(alice, g.gameId, g.ids[0])
    const use = (p_item: string, p_delta: number) => anon.rpc('companion_use_item', { p_token: l.token, p_item, p_delta })
    expect((await use(gun, -1)).data).toBe(5)
    expect((await use(gun, -10)).data).toBe(0)
    expect((await use(gun, 50)).data).toBe(6)
    expect((await use(gun, 100)).error?.message).toContain('bad_value')
    expect((await use(ropeId, -1)).error?.message).toContain('bad_value')
    expect((await use(other, -1)).error?.message).toContain('not_in_game')
    // Someone else's item, or an item outside the game.
    const outside = (await newGame(alice, [{ name: 'Out' }])).ids[0]
    const outsideItem = (await give(outside, revolver, 6)).data!.id
    expect((await use(outsideItem, -1)).error?.message).toContain('not_in_game')
    await alice.client.rpc('revoke_table_link', { p_link: l.id })
    expect((await use(gun, -1)).error?.message).toContain('link_invalid')
  })

  it('reloading moves rounds from the fullest matching box, up to the weapon\'s capacity', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const gun = (await give(g.ids[0], revolver, 1)).data!.id
    const small = (await give(g.ids[0], box, 3)).data!.id
    const big = (await give(g.ids[0], box, 12)).data!.id
    const other = (await give(g.ids[0], { name: 'Shells', kind: 'ammo', uses: 10, ammo: '12' }, 10)).data!.id
    const l = await link(alice, g.gameId)
    expect((await anon.rpc('companion_reload_item', { p_token: l.token, p_weapon: gun })).data).toBe(5)
    const rows = (await alice.client.from('character_items').select('id, uses')).data!
    const usesOf = (id: string) => rows.find((r) => r.id === id)?.uses
    expect([usesOf(gun), usesOf(big), usesOf(small), usesOf(other)]).toEqual([6, 7, 3, 10])
    // Full: nothing moves. Not a weapon: refused.
    expect((await anon.rpc('companion_reload_item', { p_token: l.token, p_weapon: gun })).data).toBe(0)
    expect((await anon.rpc('companion_reload_item', { p_token: l.token, p_weapon: big })).error?.message).toContain('bad_value')
    // The keeper's own versions.
    expect((await alice.client.rpc('use_item', { p_item: gun, p_delta: -6 })).data).toBe(0)
    expect((await alice.client.rpc('reload_item', { p_weapon: gun })).data).toBe(6)
    expect((await bob.client.rpc('use_item', { p_item: gun, p_delta: -1 })).error).not.toBeNull()
  })

  it("a weapon's condition: set by the keeper, weapons only, known values only, shown to phones", async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const gun = (await give(g.ids[0], revolver, 6)).data!.id
    const ropeId = (await give(g.ids[0], rope, null)).data!.id
    expect((await alice.client.from('character_items').update({ condition: 'rusty' }).eq('id', gun)).error).toBeNull()
    expect((await alice.client.from('character_items').update({ condition: 'shiny' }).eq('id', gun)).error).not.toBeNull()
    expect((await alice.client.from('character_items').update({ condition: 'dirty' }).eq('id', ropeId)).error).not.toBeNull()
    const l = await link(alice, g.gameId)
    const opened = (await anon.rpc('companion_open', { p_token: l.token })).data as unknown as { items: Array<{ id: string; condition: string }> }
    expect(opened.items.find((i) => i.id === gun)?.condition).toBe('rusty')
    expect(opened.items.find((i) => i.id === ropeId)?.condition).toBe('clean')
    // Phones can't change it: no RPC does, and they can't write the table.
    expect((await anon.from('character_items').update({ condition: 'clean' }).eq('id', gun)).error ?? 'no rows').toBeTruthy()
    expect((await alice.client.from('character_items').select('condition').eq('id', gun).single()).data?.condition).toBe('rusty')
  })

  it('a document card carries up to 8,000 characters of text, and phones get it', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const doc = (n: number): Json => ({ name: 'Letter', kind: 'document', document: 'é'.repeat(n) })
    const ok = await give(g.ids[0], doc(8000), null)
    expect(ok.error).toBeNull()
    expect((await give(g.ids[0], doc(8001), null)).error).not.toBeNull()
    const l = await link(alice, g.gameId)
    const opened = (await anon.rpc('companion_open', { p_token: l.token })).data as unknown as { items: Array<{ id: string; card: { document?: string } }> }
    expect(opened.items.find((i) => i.id === ok.data!.id)?.card.document).toHaveLength(8000)
  })

  it('at most 60 cards per investigator', async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const rows = Array.from({ length: 60 }, () => ({ character_id: g.ids[0], card: rope }))
    expect((await alice.client.from('character_items').insert(rows)).error).toBeNull()
    expect((await give(g.ids[0], rope, null)).error?.message).toContain('too_many_items')
  })

  it("anonymous visitors can't read or write items, nor call the internals", async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const gun = (await give(g.ids[0], revolver, 6)).data!.id
    expect((await anon.from('character_items').select('id')).data ?? []).toEqual([])
    expect((await anon.from('character_items').insert({ character_id: g.ids[0], card: rope })).error).not.toBeNull()
    expect((await anon.rpc('use_item', { p_item: gun, p_delta: -1 })).error).not.toBeNull()
    for (const fn of ['item_add_uses', 'item_reload', 'companion_item'] as const) {
      const r = await anon.rpc(fn as 'use_item', {} as never)
      expect(r.error, fn).not.toBeNull()
    }
  })

  it("an item change is broadcast on the game's topic", async () => {
    const g = await newGame(alice, [{ name: 'One' }])
    const gun = (await give(g.ids[0], revolver, 6)).data!.id
    const l = await link(alice, g.gameId)
    const channel = (await alice.client.from('games').select('channel').eq('id', g.gameId).single()).data!.channel
    const payload = await waitFor<Record<string, unknown>>(
      (resolve) => listen(channel, 'items', (p) => resolve(p as Record<string, unknown>)),
      async () => {
        const { error } = await anon.rpc('companion_use_item', { p_token: l.token, p_item: gun, p_delta: -1 })
        expect(error).toBeNull()
      },
    )
    expect(payload).toMatchObject({ characterId: g.ids[0] })
  })
})
