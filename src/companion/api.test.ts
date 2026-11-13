import { MutationObserver, QueryClient, QueryObserver, type MutationObserverOptions, type QueryObserverOptions } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Points } from '@/play/companion'

// A phone's table, without React or a network: the real hooks' options run on a real QueryClient,
// against a server made of a few variables.
const server = {
  points: { pv: 10, san: 47, chance: 50, pm: 9 } as Points,
  /** Values received by companion_set_point, in order. */
  sent: [] as Array<{ field: keyof Points; value: number }>,
  /** Writes waiting for `release()` or `refuse()`, oldest first. */
  held: [] as Array<(accept: boolean) => void>,
  opens: 0,
  /** companion_open fails (no network). */
  down: false,
}
const CHARACTER = 'c1'

function open() {
  server.opens += 1
  return {
    game: { id: 'g1', channel: 'ch1', title: '' },
    focus: null,
    canCreate: false,
    party: [{ id: CHARACTER, data: { name: 'X', characteristics: {}, skills: {}, hp: 12 }, player: null, photo: null }],
    points: [{ characterId: CHARACTER, ...server.points, checks: [], source: 'keeper', updatedAt: '2026-01-01T00:00:00.000Z' }],
    notes: [],
    items: [],
  }
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: { p_field: keyof Points; p_value: number }) => {
      if (name === 'companion_open') return Promise.resolve(server.down ? { data: null, error: { message: 'Failed to fetch' } } : { data: open(), error: null })
      if (name !== 'companion_set_point') return Promise.resolve({ data: null, error: { message: 'unexpected' } })
      server.sent.push({ field: args.p_field, value: args.p_value })
      // The write is committed when the test releases it.
      return new Promise((resolve) => {
        server.held.push((accept) => {
          if (accept) server.points = { ...server.points, [args.p_field]: args.p_value }
          resolve({ data: null, error: accept ? null : { message: 'bad_value' } })
        })
      })
    },
  },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

let client: QueryClient
vi.mock('@tanstack/react-query', async (original) => ({
  ...(await original<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => client,
  useQuery: (options: unknown) => options,
  useMutation: (options: unknown) => options,
}))

const { toast } = await import('sonner')
const api = await import('./api')
const { afterTaps, applyPointsHint, companionKeys, endTap, pointsOf, receivePoints, startTap, tapTarget, undoTap, withTaps } = api
// With useQuery and useMutation mocked above, the hooks only hand back their options.
const companionOptions = api.useCompanion as unknown as (token: string) => QueryObserverOptions
const setPointsOptions = api.useSetPoints as unknown as (token: string) => MutationObserverOptions<void, Error, Tap>
type View = import('./api').CompanionView
type Tap = import('./api').PointTap
type TapBook = import('./api').TapBook

// One link per test: a test that fails leaves its writes queued under its own link.
let links = 0
const tick = () => new Promise((r) => setTimeout(r, 0))
const settle = async () => { for (let i = 0; i < 5; i++) await tick() }
const release = async () => { server.held.shift()?.(true); await settle() }
const refuse = async () => { server.held.shift()?.(false); await settle() }

/** Opens the phone's view and returns what it needs to tap and to look at the sheet. */
async function phone() {
  const TOKEN = `tok${++links}`
  client = new QueryClient()
  const query = new QueryObserver(client, companionOptions(TOKEN))
  const stop = query.subscribe(() => undefined)
  await settle()
  const taps = new MutationObserver(client, setPointsOptions(TOKEN))
  const view = () => client.getQueryData<View>(companionKeys.one(TOKEN))!
  return {
    stop,
    tap: (field: keyof Points, delta: number) => void taps.mutate({ characterId: CHARACTER, field, delta }).catch(() => undefined),
    shown: () => { const v = view(); const p = pointsOf(v, v.party[0]); return { pv: p.pv, san: p.san, chance: p.chance, pm: p.pm } },
    refetch: () => client.invalidateQueries({ queryKey: companionKeys.one(TOKEN) }),
    /** A `points` broadcast reaching this phone: from the server's trigger, or from anyone holding a link. */
    broadcast: (points: Partial<Points>, updatedAt = new Date().toISOString()) =>
      receivePoints(client, TOKEN, { characterId: CHARACTER, ...server.points, ...points, checks: [], source: 'keeper', updatedAt }),
  }
}

afterEach(() => {
  client.clear()
  server.points = { pv: 10, san: 47, chance: 50, pm: 9 }
  server.sent = []
  server.held = []
  server.opens = 0
  server.down = false
  vi.mocked(toast.error).mockClear()
})

describe('taps on a phone sheet', () => {
  it('sends each tap in order and shows the result at once', async () => {
    const p = await phone()
    p.tap('pv', -1)
    p.tap('pv', -1)
    await settle()
    expect(p.shown().pv).toBe(8)
    expect(server.sent).toEqual([{ field: 'pv', value: 9 }])
    await release()
    await release()
    expect(server.sent).toEqual([{ field: 'pv', value: 9 }, { field: 'pv', value: 8 }])
    expect(p.shown().pv).toBe(8)
    p.stop()
  })

  it('a refetch landing while taps are queued loses none of them', async () => {
    const p = await phone()
    p.tap('pv', -1)
    p.tap('pv', -1)
    await settle()
    // Another player's note, a resubscribe or the window's focus: the view is read again while the
    // first write is still on its way (the server answers 10).
    await p.refetch()
    await settle()
    expect(p.shown().pv).toBe(8)
    await release()
    await release()
    expect(server.sent).toEqual([{ field: 'pv', value: 9 }, { field: 'pv', value: 8 }])
    expect(server.points.pv).toBe(8)
    expect(p.shown().pv).toBe(8)
    p.stop()
  })

  it('a refetch landing between two writes does not bring a tap back either', async () => {
    const p = await phone()
    p.tap('pv', -1)
    p.tap('pv', -1)
    p.tap('san', 1)
    await settle()
    await release() // pv 9 is committed
    await p.refetch()
    await settle()
    expect(p.shown()).toMatchObject({ pv: 8, san: 48 })
    await release()
    await release()
    expect(server.sent).toEqual([{ field: 'pv', value: 9 }, { field: 'pv', value: 8 }, { field: 'san', value: 48 }])
    expect(p.shown()).toMatchObject({ pv: 8, san: 48 })
    p.stop()
  })

  it('a refused tap is taken back with a message; the taps after it still count', async () => {
    const p = await phone()
    p.tap('pv', -1)
    p.tap('pv', -1)
    p.tap('pv', -1)
    await settle()
    expect(p.shown().pv).toBe(7)
    await release()
    await refuse()
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(p.shown().pv).toBe(8)
    await release()
    // The third tap starts from what the server accepted (9), not from the refused 8.
    expect(server.sent.map((w) => w.value)).toEqual([9, 8, 8])
    expect(server.points.pv).toBe(8)
    expect(p.shown().pv).toBe(8)
    p.stop()
  })

  it('stops at the bounds the server accepts', async () => {
    const p = await phone()
    p.tap('pv', 1)
    p.tap('pv', 1)
    p.tap('pv', 1)
    await settle()
    expect(p.shown().pv).toBe(12)
    await release()
    await release()
    await release()
    expect(server.sent.map((w) => w.value)).toEqual([11, 12, 12])
    expect(p.shown().pv).toBe(12)
    p.stop()
  })
})

describe('the tap book', () => {
  const view = (points: Partial<Points> = {}): View => ({
    game: { id: 'g', channel: 'c', title: '' },
    focus: null,
    canCreate: false,
    party: [{ id: 'a', data: { name: 'A', characteristics: {}, skills: {}, hp: 12 }, player: null, photo: null }],
    points: [{ characterId: 'a', pv: 10, san: 47, chance: 50, pm: 9, ...points, checks: ['Esquive'], source: 'keeper', updatedAt: 'T' }],
    notes: [],
    items: [],
    hinted: [],
  })
  const tap = (field: keyof Points, delta: number): Tap => ({ characterId: 'a', field, delta })

  it('counts taps, shows them at once and sends the server value plus one tap', () => {
    const book: TapBook = new Map()
    expect(startTap(book, 'k', view(), tap('pv', -1))).toEqual({ shown: 9, applied: -1 })
    expect(startTap(book, 'k', view(), tap('pv', -1))).toEqual({ shown: 8, applied: -1 })
    const taps = book.get('k')!
    expect(taps).toMatchObject({ base: { pv: 10, san: 47, chance: 50, pm: 9 }, shown: { pv: 8 }, running: 2 })
    expect(tapTarget(taps, 'pv', -1)).toBe(9)
    // A view read again in between has no say: the book already exists.
    expect(startTap(book, 'k', view({ pv: 3 }), tap('san', 1))).toEqual({ shown: 48, applied: 1 })
    expect(taps.base.pv).toBe(10)
  })

  it('counts nothing for an investigator who is not at the table', () => {
    const book: TapBook = new Map()
    expect(startTap(book, 'k', view(), { characterId: 'zz', field: 'pv', delta: 1 })).toBeNull()
    expect(startTap(book, 'k', undefined, tap('pv', 1))).toBeNull()
    expect(book.size).toBe(0)
    expect(endTap(book, 'k')).toEqual({})
  })

  it('a tap against a bound changes nothing, and taking it back changes nothing either', () => {
    const book: TapBook = new Map()
    expect(startTap(book, 'k', view({ pv: 0 }), tap('pv', -1))).toEqual({ shown: 0, applied: 0 })
    expect(undoTap(book.get('k')!, 'pv', 0)).toBe(0)
    expect(startTap(book, 'k', view(), tap('san', 1))).toEqual({ shown: 48, applied: 1 })
    expect(undoTap(book.get('k')!, 'san', 1)).toBe(47)
  })

  it('after the last tap gives the values the server accepted for the tapped fields, and forgets', () => {
    const book: TapBook = new Map()
    startTap(book, 'k', view(), tap('pv', -1))
    startTap(book, 'k', view(), tap('pv', -1))
    const taps = book.get('k')!
    taps.base = { ...taps.base, pv: 9 } // the first write is accepted, the second refused
    expect(endTap(book, 'k')).toBeNull()
    expect(endTap(book, 'k')).toEqual({ pv: 9 })
    expect(book.size).toBe(0)
  })

  it('a view read from the server keeps what running taps show, and only that', () => {
    const book: TapBook = new Map()
    startTap(book, 'tok:a', view(), tap('pv', -1))
    const fresh = view({ pv: 10, san: 40 }) // the keeper lowered SAN meanwhile; our write isn't in yet
    const merged = withTaps(fresh, 'tok', book)
    expect(merged.points[0]).toMatchObject({ pv: 9, san: 40, chance: 50, pm: 9, checks: ['Esquive'], updatedAt: 'T' })
    expect(withTaps(fresh, 'other', book)).toBe(fresh)
  })
})

describe('points broadcasts on a public topic', () => {
  it('a forged payload is shown at most: the next tap asks the server and builds on its value', async () => {
    const p = await phone()
    // Someone holding another link sends zeros for this investigator.
    p.broadcast({ pv: 0, san: 0, chance: 0, pm: 0 })
    expect(p.shown().san).toBe(0)
    p.tap('san', 1)
    await settle()
    expect(server.sent).toEqual([{ field: 'san', value: 48 }])
    await release()
    expect(server.points.san).toBe(48)
    expect(p.shown()).toEqual({ pv: 10, san: 48, chance: 50, pm: 9 })
    p.stop()
  })

  it('a payload stamped in the future is ignored, so it cannot hide the real ones after it', async () => {
    const p = await phone()
    p.broadcast({ san: 0 }, '2999-01-01T00:00:00.000Z')
    expect(p.shown().san).toBe(47)
    server.points = { ...server.points, san: 45 } // the keeper, for real
    p.broadcast({})
    expect(p.shown().san).toBe(45)
    p.stop()
  })

  it('a keeper change shows at once, and a tap on it starts from the server value', async () => {
    const p = await phone()
    server.points = { ...server.points, pv: 5 }
    p.broadcast({})
    expect(p.shown().pv).toBe(5)
    expect(server.opens).toBe(1) // no refetch for a points event
    p.tap('pv', -1)
    await settle()
    expect(server.sent).toEqual([{ field: 'pv', value: 4 }])
    await release()
    expect(p.shown().pv).toBe(4)
    p.stop()
  })

  it('a keeper change to another field while taps are queued is read before that field is tapped', async () => {
    const p = await phone()
    p.tap('pv', -1)
    await settle()
    server.points = { ...server.points, san: 40 }
    p.broadcast({})
    expect(p.shown()).toMatchObject({ pv: 9, san: 40 })
    p.tap('san', -1)
    await settle()
    await release() // pv 9
    await release() // san
    expect(server.sent).toEqual([{ field: 'pv', value: 9 }, { field: 'san', value: 39 }])
    expect(p.shown()).toMatchObject({ pv: 9, san: 39 })
    p.stop()
  })

  it('without a broadcast a tap costs no extra read', async () => {
    const p = await phone()
    p.tap('pv', -1)
    await settle()
    expect(server.sent).toHaveLength(1)
    expect(server.opens).toBe(1)
    await release()
    expect(server.opens).toBe(2) // the refetch after the last tap
    p.stop()
  })

  it('when the server cannot be asked, the tap is refused rather than built on the broadcast', async () => {
    const p = await phone()
    p.broadcast({ san: 0 })
    server.down = true
    p.tap('san', 1)
    await settle()
    expect(server.sent).toEqual([])
    expect(toast.error).toHaveBeenCalledTimes(1)
    server.down = false
    p.tap('san', 1)
    await settle()
    expect(server.sent).toEqual([{ field: 'san', value: 48 }])
    await release()
    p.stop()
  })
})

describe('applyPointsHint', () => {
  const NOW = Date.parse('2026-06-01T12:00:00.000Z')
  const at = (ms: number) => new Date(NOW + ms).toISOString()
  const view: View = {
    game: { id: 'g', channel: 'c', title: '' },
    focus: null,
    canCreate: false,
    party: [{ id: 'a', data: { name: 'A', characteristics: {}, skills: {}, hp: 12 }, player: null, photo: null }],
    points: [{ characterId: 'a', pv: 10, san: 47, chance: 50, pm: 9, checks: [], source: 'keeper', updatedAt: at(-60_000) }],
    notes: [],
    items: [],
    hinted: [],
  }
  const payload = (over: Record<string, unknown> = {}) => ({ characterId: 'a', pv: 8, san: 47, chance: 50, pm: 9, checks: [], source: 'keeper', updatedAt: at(0), ...over })

  it('shows the payload, clamped, and marks the investigator as not confirmed by the server', () => {
    const next = applyPointsHint(view, payload({ pv: 40, san: -3 }), NOW)!
    expect(next.points[0]).toMatchObject({ pv: 12, san: 0, chance: 50, pm: 9 })
    expect(next.hinted).toEqual(['a'])
    expect(applyPointsHint(next, payload({ updatedAt: at(1000) }), NOW)!.hinted).toEqual(['a'])
  })

  it('ignores payloads stamped later than now plus a small skew, or with no readable time', () => {
    expect(applyPointsHint(view, payload({ updatedAt: at(60_000) }), NOW)).not.toBeNull()
    expect(applyPointsHint(view, payload({ updatedAt: at(10 * 60_000) }), NOW)).toBeNull()
    expect(applyPointsHint(view, payload({ updatedAt: '2999-01-01T00:00:00Z' }), NOW)).toBeNull()
    expect(applyPointsHint(view, payload({ updatedAt: 'soon' }), NOW)).toBeNull()
  })

  it('ignores a payload older than what is shown, a stranger, a malformed one', () => {
    expect(applyPointsHint(view, payload({ updatedAt: at(-120_000) }), NOW)).toBeNull()
    expect(applyPointsHint(view, payload({ characterId: 'zz' }), NOW)).toBeNull()
    expect(applyPointsHint(view, payload({ pv: 'many' }), NOW)).toBeNull()
    expect(applyPointsHint(view, null, NOW)).toBeNull()
  })

  it('mid-taps: keeps what the tapped fields show and drops echoes of this phone', () => {
    const taps = { base: { pv: 10, san: 47, chance: 50, pm: 9 }, maxHp: 12, shown: { pv: 8 }, running: 2, unsure: false }
    expect(applyPointsHint(view, payload({ pv: 9, source: 'phone' }), NOW, taps)).toBeNull()
    expect(applyPointsHint(view, payload({ pv: 3, san: 40 }), NOW, taps)!.points[0]).toMatchObject({ pv: 8, san: 40 })
  })
})

describe('afterTaps', () => {
  const view: View = {
    game: { id: 'g', channel: 'c', title: '' },
    focus: null,
    canCreate: false,
    party: [{ id: 'a', data: { name: 'A', characteristics: {}, skills: {}, hp: 12 }, player: null, photo: null }],
    points: [{ characterId: 'a', pv: 1, san: 1, chance: 50, pm: 9, checks: [], source: 'phone', updatedAt: 'T' }],
    notes: [],
    items: [],
    hinted: [],
  }

  it('shows what the server accepted', () => {
    const next = afterTaps(view, 'a', { pv: 9 }, false)
    expect(next.points[0]).toMatchObject({ pv: 9, san: 1 })
    expect(next.hinted).toEqual([])
  })

  it('keeps the investigator marked when a broadcast came in after the last read of the server', () => {
    expect(afterTaps(view, 'a', { pv: 9 }, true).hinted).toEqual(['a'])
  })
})

