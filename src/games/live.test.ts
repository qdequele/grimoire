import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { engineQueue, gameView, inOrder } from './live'

describe('gameView', () => {
  const s = { error: false, noStory: false, started: false, ready: false }

  it('says why a game cannot open', () => {
    expect(gameView({ ...s, error: true })).toBe('missing')
    expect(gameView({ ...s, noStory: true })).toBe('no-story')
    expect(gameView(s)).toBe('loading')
  })

  it('keeps a running game on screen when a later refetch fails or loses the story', () => {
    expect(gameView({ ...s, started: true, ready: true })).toBe('play')
    expect(gameView({ ...s, started: true, ready: true, error: true })).toBe('play')
    expect(gameView({ ...s, started: true, ready: true, noStory: true })).toBe('play')
    expect(gameView({ ...s, started: true, error: true })).toBe('loading')
  })
})

describe('engineQueue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('runs calls in order once the engine is there, then at once', () => {
    let engine: { log: string[] } | undefined
    const q = engineQueue(() => engine, 100, () => undefined)
    q.run((e) => e.log.push('a'))
    q.run((e) => e.log.push('b'))
    engine = { log: [] }
    vi.advanceTimersByTime(100)
    expect(engine.log).toEqual(['a', 'b'])
    q.run((e) => e.log.push('c'))
    expect(engine.log).toEqual(['a', 'b', 'c'])
    q.stop()
  })

  it('still delivers calls queued while the engine was away after it had started', () => {
    const first = { log: [] as string[] }
    let engine: { log: string[] } | undefined = first
    const q = engineQueue(() => engine, 100, () => undefined)
    vi.advanceTimersByTime(100)
    engine = undefined
    q.run((e) => e.log.push('while away'))
    const second = { log: [] as string[] }
    engine = second
    vi.advanceTimersByTime(100)
    expect(second.log).toEqual(['while away'])
    q.run((e) => e.log.push('after'))
    expect(second.log).toEqual(['while away', 'after'])
    q.stop()
  })

  it('reports a call that throws and goes on', () => {
    const errors: unknown[] = []
    const engine = { log: [] as string[] }
    const q = engineQueue(() => engine, 100, (e) => errors.push(e))
    q.run(() => {
      throw new Error('boom')
    })
    q.run((e) => e.log.push('next'))
    expect(errors).toHaveLength(1)
    expect(engine.log).toEqual(['next'])
    q.stop()
  })

  it('polls for nothing once stopped', () => {
    let engine: { log: string[] } | undefined
    const q = engineQueue(() => engine, 100, () => undefined)
    const log: string[] = []
    q.run(() => log.push('never'))
    q.stop()
    engine = { log: [] }
    vi.advanceTimersByTime(1000)
    expect(log).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('inOrder', () => {
  it('lets a slow early read finish before a later one starts, so the newest answer lands last', async () => {
    const run = inOrder(() => undefined)
    const applied: string[] = []
    let release: () => void = () => undefined
    const slow = new Promise<void>((resolve) => (release = resolve))
    run(async () => {
      await slow
      applied.push('first read')
    })
    run(async () => {
      applied.push('second read')
    })
    await Promise.resolve()
    release()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(applied).toEqual(['first read', 'second read'])
  })

  it('goes on after a read that fails', async () => {
    const errors: unknown[] = []
    const run = inOrder((e) => errors.push(e))
    const applied: string[] = []
    run(async () => {
      throw new Error('offline')
    })
    run(async () => {
      applied.push('next')
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(errors).toHaveLength(1)
    expect(applied).toEqual(['next'])
  })
})
