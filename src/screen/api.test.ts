import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PresetId } from './ambiance'

// A stand-in for the database: `screen_open` reads the row when it is called and answers when the test
// lets it (`answer(n)`), so a slow read can land after a newer one.
const row = (preset: PresetId) => ({ v: 1, follow: true, sound: false, scene: { preset, image: null, sounds: [] }, handout: null })
const db = { screen: row('fog') as unknown }
const reads: Array<{ answer: () => void; signal?: AbortSignal }> = []

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: () => {
      const read: (typeof reads)[number] = { answer: () => {} }
      const seen = db.screen
      const result = new Promise((resolve) => {
        read.answer = () => resolve({ data: { channel: 'c1', screen: seen }, error: null })
      })
      reads.push(read)
      return Object.assign(result, {
        abortSignal: (signal: AbortSignal) => {
          read.signal = signal
          return result
        },
      })
    },
  },
}))
const { screenChanged, screenKeys, screenQuery } = await import('./api')
type ScreenView = import('./api').ScreenView

const TOKEN = 'tok'
const settle = () => new Promise((r) => setTimeout(r, 0))

describe('the screen page and its public topic', () => {
  let qc: QueryClient
  let stop: () => void
  const shown = () => qc.getQueryData<ScreenView>(screenKeys.one(TOKEN))?.screen.scene?.preset

  beforeEach(async () => {
    reads.length = 0
    db.screen = row('fog')
    qc = new QueryClient()
    // The page watches the query, as useScreenView does.
    stop = new QueryObserver(qc, screenQuery(TOKEN)).subscribe(() => {})
    reads[0].answer()
    await settle()
    expect(shown()).toBe('fog')
  })
  afterEach(() => {
    stop()
    qc.clear()
  })

  it('shows what the database says, not what a broadcast carries', async () => {
    // Anyone holding the link can send on the topic (a forged state, a picture from anywhere): what a
    // message carries is not even looked at.
    screenChanged(qc, TOKEN)
    expect(shown()).toBe('fog')
    // The broadcast is a hint: the screen reads its link again.
    expect(reads).toHaveLength(2)
    reads[1].answer()
    await settle()
    const view = qc.getQueryData<ScreenView>(screenKeys.one(TOKEN))
    expect(view?.screen.scene).toEqual({ preset: 'fog', image: null, sounds: [] })
    expect(view?.screen.handout).toBeNull()
  })

  it('a read started before a change does not put the old scene back', async () => {
    // The 60 s check-in starts and reads the row…
    void qc.refetchQueries({ queryKey: screenKeys.one(TOKEN) })
    expect(reads).toHaveLength(2)
    // …the keeper changes scene, the broadcast arrives…
    db.screen = row('storm')
    screenChanged(qc, TOKEN)
    // …and the slow read answers last, with the scene from before.
    reads.at(-1)?.answer()
    reads[1].answer()
    await settle()
    expect(shown()).toBe('storm')
  })

  it('a burst of changes ends on the last one, whatever order the reads answer in', async () => {
    for (const preset of ['rain', 'snow', 'candle'] as const) {
      db.screen = row(preset)
      screenChanged(qc, TOKEN)
    }
    // One read per hint, each started after its change; the earlier ones are given up.
    expect(reads).toHaveLength(4)
    expect(reads.slice(1, 3).every((r) => r.signal?.aborted)).toBe(true)
    expect(reads[3].signal?.aborted).toBe(false)
    reads[3].answer()
    await settle()
    reads[2].answer()
    reads[1].answer()
    await settle()
    expect(shown()).toBe('candle')
  })

  it('a hint before the first read has answered waits for it', async () => {
    const other = new QueryClient()
    reads.length = 0
    const off = new QueryObserver(other, screenQuery('other')).subscribe(() => {})
    screenChanged(other, 'other')
    expect(reads).toHaveLength(1)
    reads[0].answer()
    await settle()
    expect(other.getQueryData<ScreenView>(screenKeys.one('other'))?.channel).toBe('c1')
    off()
    other.clear()
  })
})
