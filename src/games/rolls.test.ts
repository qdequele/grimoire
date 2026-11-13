import { beforeEach, describe, expect, it, vi } from 'vitest'

// The rows the keeper can read right now (a roll appears when its transaction commits).
const table = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>>, reads: 0 }))

vi.mock('@/lib/supabase', () => {
  const at = (r: Record<string, unknown>) => String(r.created_at)
  const query = () => {
    let rows = [...table.rows]
    let limit = Infinity
    const q = {
      select: () => q,
      eq: () => q,
      gt: (_c: string, v: string) => ((rows = rows.filter((r) => at(r) > v)), q),
      gte: (_c: string, v: string) => ((rows = rows.filter((r) => at(r) >= v)), q),
      order: (_c: string, o: { ascending: boolean }) => (
        (rows = rows.sort((a, b) => (o.ascending ? at(a).localeCompare(at(b)) : at(b).localeCompare(at(a))))), q
      ),
      limit: (n: number) => ((limit = n), q),
      then: (ok: (v: { data: unknown[]; error: null }) => unknown) => {
        table.reads++
        return Promise.resolve({ data: rows.slice(0, limit), error: null }).then(ok)
      },
    }
    return q
  }
  return { supabase: { from: () => query() } }
})

import { rollFeed } from './rolls'

const T0 = Date.parse('2026-01-01T12:00:00.000Z')
/** A dice roll stamped `ms` after T0 (the stamp is the insert's time, not the commit's). */
const roll = (id: string, ms: number) => ({
  id, game_id: 'g', character_id: 'c', kind: 'dice', result: 3,
  dice: { count: 1, sides: 6, modifier: 0, results: [3] },
  created_at: new Date(T0 + ms).toISOString(),
})
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('rollFeed', () => {
  beforeEach(() => {
    table.rows = []
    table.reads = 0
  })
  const feed = async () => {
    const shown: string[] = []
    const read = rollFeed('g', (r) => shown.push(r.id))
    const next = async () => {
      read()
      await settle()
    }
    await next()
    return { shown, next }
  }

  it('shows nothing from before it started, then each new roll once, oldest first', async () => {
    table.rows = [roll('old', 0)]
    const { shown, next } = await feed()
    table.rows.push(roll('b', 2000), roll('a', 1000))
    await next()
    await next()
    expect(shown).toEqual(['a', 'b'])
  })

  it('shows a roll that commits after a later-stamped one was read', async () => {
    const { shown, next } = await feed()
    // Two players tap together: A is stamped first, B commits first.
    table.rows.push(roll('B', 20))
    await next()
    table.rows.push(roll('A', 10))
    await next()
    expect(shown).toEqual(['B', 'A'])
  })

  it('shows a roll stamped before the newest one at start that commits after', async () => {
    table.rows = [roll('old', 20)]
    const { shown, next } = await feed()
    table.rows.push(roll('late', 10))
    await next()
    expect(shown).toEqual(['late'])
  })

  it('reaches the new rolls when many fall in the same few seconds', async () => {
    table.rows = Array.from({ length: 30 }, (_, i) => roll(`old${i}`, i))
    const { shown, next } = await feed()
    table.rows.push(...Array.from({ length: 45 }, (_, i) => roll(`new${i}`, 100 + i)))
    await next()
    expect(shown).toEqual(Array.from({ length: 45 }, (_, i) => `new${i}`))
  })

  it('catches up on everything rolled while it was not listening', async () => {
    const { shown, next } = await feed()
    table.rows.push(...Array.from({ length: 50 }, (_, i) => roll(`r${i}`, 60_000 + i * 1000)))
    await next()
    expect(shown).toHaveLength(50)
    expect(shown[0]).toBe('r0')
    expect(shown[49]).toBe('r49')
  })
})
