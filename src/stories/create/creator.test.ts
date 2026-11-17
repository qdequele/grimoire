import { describe, expect, it } from 'vitest'
import { emptyBrief } from './brief'
import { creationLost, drawAllMaps, loadSaved, saveState, storeKey, type Saved } from './creator'

function memory(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  }
}

const progress: Saved = { brief: { ...emptyBrief('fr'), place: 'A mill town' }, creationId: 'creation-a', outline: null, outlinesLeft: 4 }

describe('the creator’s saved progress', () => {
  it('comes back for the keeper who saved it', () => {
    const store = memory()
    saveState(store, 'keeper-a', progress)
    expect(loadSaved(store, 'keeper-a')).toEqual(progress)
    expect([...store.items.keys()]).toEqual([storeKey('keeper-a')])
  })

  it('is not shown to another account on the same browser, and is not overwritten by it', () => {
    const store = memory()
    saveState(store, 'keeper-a', progress)
    expect(loadSaved(store, 'keeper-b')).toBeNull()
    saveState(store, 'keeper-b', { ...progress, creationId: 'creation-b' })
    expect(loadSaved(store, 'keeper-a')).toEqual(progress)
    saveState(store, 'keeper-b', null)
    expect(loadSaved(store, 'keeper-b')).toBeNull()
    expect(loadSaved(store, 'keeper-a')).toEqual(progress)
  })

  it('drops progress saved before it was per account: whose it was is unknown', () => {
    const store = memory({ 'grimoire-story-creator': JSON.stringify(progress) })
    expect(loadSaved(store, 'keeper-b')).toBeNull()
    expect(store.items.size).toBe(0)
  })

  it('starts fresh from a corrupt or unreadable store', () => {
    expect(loadSaved(memory({ [storeKey('k')]: '{oops' }), 'k')).toBeNull()
    expect(loadSaved(memory({ [storeKey('k')]: JSON.stringify({ brief: { era: 3 } }) }), 'k')).toBeNull()
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => { throw new Error('denied') } }
    expect(loadSaved(broken, 'k')).toBeNull()
    expect(() => saveState(broken, 'k', progress)).not.toThrow()
  })
})

describe('creationLost', () => {
  it('is true only once the server answered that the creation is not there', () => {
    expect(creationLost('creation-a', { isSuccess: true, data: null })).toBe(true)
    expect(creationLost('creation-a', { isSuccess: true, data: { id: 'creation-a' } })).toBe(false)
    // Still loading, or the request failed: nothing is known yet.
    expect(creationLost('creation-a', { isSuccess: false, data: undefined })).toBe(false)
    expect(creationLost(null, { isSuccess: false, data: undefined })).toBe(false)
  })
})

describe('the scenes’ maps after the last scene', () => {
  /** A scene-map endpoint with `left` maps to draw, failing on the listed calls (1-based). */
  function endpoint(left: number, failOn: number[] = []) {
    let calls = 0
    return {
      draw: async () => {
        calls++
        if (failOn.includes(calls)) throw new Error('timeout')
        if (!left) return { scene: null, remaining: 0 }
        left--
        return { scene: `scene-${calls}`, remaining: left }
      },
      calls: () => calls,
    }
  }

  it('draws every map, then says it is done', async () => {
    const api = endpoint(2)
    const seen: Array<[number, number]> = []
    expect(await drawAllMaps(api.draw, () => false, (d, t) => seen.push([d, t]))).toBe('done')
    expect(seen).toEqual([[1, 2], [2, 2]])
  })

  it('says a map failed, so the page offers to draw it again instead of moving on', async () => {
    const api = endpoint(2, [1])
    expect(await drawAllMaps(api.draw, () => false, () => {})).toBe('failed')
    // Drawing again picks up where it failed.
    expect(await drawAllMaps(api.draw, () => false, () => {})).toBe('done')
    expect(api.calls()).toBe(3)
  })

  it('says it was stopped when the keeper left the page, so nothing navigates away', async () => {
    const api = endpoint(3)
    let left = false
    const outcome = drawAllMaps(api.draw, () => left, () => { left = true })
    expect(await outcome).toBe('stopped')
    expect(api.calls()).toBe(1)
  })

  it('says it was stopped when the keeper left during the last map, not that it is done', async () => {
    const api = endpoint(1)
    let left = false
    const outcome = drawAllMaps(api.draw, () => left, () => { left = true })
    expect(await outcome).toBe('stopped')
    expect(api.calls()).toBe(1)
  })

  it('says it was stopped, not failed, when a map fails after the keeper left', async () => {
    const api = endpoint(2, [1])
    expect(await drawAllMaps(api.draw, () => true, () => {})).toBe('stopped')
  })

  it('is done at once when no map is left', async () => {
    expect(await drawAllMaps(endpoint(0).draw, () => false, () => {})).toBe('done')
  })
})
