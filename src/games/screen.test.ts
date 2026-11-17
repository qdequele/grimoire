import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_SCREEN, type ScreenHandout, type ScreenState } from '@/screen/state'

// A stand-in for the database: every write of games.screen is recorded, and refused while `down`.
const db = { down: false, writes: [] as ScreenState[] }

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (values: { screen: ScreenState }) => ({
        eq: async () => {
          db.writes.push(values.screen)
          return { error: db.down ? { message: 'Failed to fetch' } : null }
        },
      }),
    }),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://db.example/signed' }, error: null }) }) },
  },
}))
const { ScreenControl } = await import('./screen')

const STORY = { content: { acts: [{ scenes: [{ id: 's1' }] }] }, folder: 'owner/story', files: [] }
const NOTE: ScreenHandout = { key: 'note', title: 'A note', text: 'Come at midnight.', image: null }
const after = (ms: number) => vi.advanceTimersByTimeAsync(ms)

describe('ScreenControl: a write of games.screen that fails', () => {
  let control: InstanceType<typeof ScreenControl>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    db.down = false
    db.writes = []
    control = new ScreenControl('game', STORY, INITIAL_SCREEN)
  })
  afterEach(() => {
    control.dispose()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('is written again a little later, without the keeper doing anything', async () => {
    db.down = true
    control.dispatch({ type: 'show', handout: NOTE })
    await after(0)
    expect(db.writes).toHaveLength(1)
    // The keeper's dialog already shows the note; the screen's row does not have it.
    expect(control.get().handout?.key).toBe('note')

    db.down = false
    await after(2000)
    expect(db.writes).toHaveLength(2)
    expect(db.writes[1].handout?.key).toBe('note')
    // Saved: nothing more is written.
    await after(3600_000 - 2000 - 1)
    expect(db.writes).toHaveLength(2)
  })

  it('waits longer each time, then stops until the hourly check', async () => {
    db.down = true
    control.dispatch({ type: 'show', handout: NOTE })
    await after(0)
    const at = [2000, 5000, 15_000, 30_000, 60_000]
    for (const [i, wait] of at.entries()) {
      await after(wait - 1)
      expect(db.writes).toHaveLength(i + 1)
      await after(1)
      expect(db.writes).toHaveLength(i + 2)
    }
    // A refusal that lasts (signed out, no network for good) is not hammered.
    await after(20 * 60_000)
    expect(db.writes).toHaveLength(6)
    // The hourly check tries once more, and saves when the database is back.
    db.down = false
    await after(3600_000)
    expect(db.writes).toHaveLength(7)
    expect(db.writes[6].handout?.key).toBe('note')
    await after(3600_000)
    expect(db.writes).toHaveLength(7)
  })

  it('writes only the newest state: a change made meanwhile replaces the pending retry', async () => {
    db.down = true
    control.dispatch({ type: 'show', handout: NOTE })
    await after(0)
    db.down = false
    control.dispatch({ type: 'clear' })
    await after(0)
    expect(db.writes).toHaveLength(2)
    expect(db.writes[1].handout).toBeNull()
    await after(10 * 60_000)
    expect(db.writes).toHaveLength(2)
  })

  it('writes a state that failed even when the keeper has put the screen back as it was', async () => {
    db.down = true
    control.dispatch({ type: 'show', handout: NOTE })
    await after(0)
    // Maybe the first write did reach the database: the row is no longer known, so it is written again.
    control.dispatch({ type: 'clear' })
    await after(0)
    db.down = false
    await after(2000)
    expect(db.writes.at(-1)?.handout).toBeNull()
    expect(db.writes).toHaveLength(3)
  })

  it('tries at once when the network comes back', async () => {
    const win = new EventTarget()
    vi.stubGlobal('window', win)
    control.dispose()
    control = new ScreenControl('game', STORY, INITIAL_SCREEN)
    db.down = true
    control.dispatch({ type: 'show', handout: NOTE })
    await after(0)
    await after(10 * 60_000)
    expect(db.writes).toHaveLength(6)
    db.down = false
    win.dispatchEvent(new Event('online'))
    await after(0)
    expect(db.writes).toHaveLength(7)
    // Nothing to save: the event writes nothing.
    win.dispatchEvent(new Event('online'))
    await after(0)
    expect(db.writes).toHaveLength(7)
  })

  it('stops with the game page', async () => {
    db.down = true
    control.dispatch({ type: 'show', handout: NOTE })
    await after(0)
    control.dispose()
    await after(2 * 3600_000)
    expect(db.writes).toHaveLength(1)
  })
})
