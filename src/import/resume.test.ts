import { describe, expect, it } from 'vitest'
import { importBatches, resumeFrom } from './resume'

describe('importBatches', () => {
  it('cuts a new import into batches numbered from page 1', () => {
    expect(importBatches(['a', 'b', 'c', 'd', 'e'], 0, 2)).toEqual([
      { pagePaths: ['a', 'b'], firstPage: 1 },
      { pagePaths: ['c', 'd'], firstPage: 3 },
      { pagePaths: ['e'], firstPage: 5 },
    ])
  })

  it('numbers the remaining pages of a resumed import after the ones already converted', () => {
    // 40 pages, 30 converted: only the last 10 are uploaded again
    const left = Array.from({ length: 10 }, (_, i) => `p${31 + i}`)
    const batches = importBatches(left, 30, 2)
    expect(batches).toHaveLength(5)
    expect(batches[0]).toEqual({ pagePaths: ['p31', 'p32'], firstPage: 31 })
    expect(batches.at(-1)).toEqual({ pagePaths: ['p39', 'p40'], firstPage: 39 })
  })

  it('has nothing to send when every page is converted', () => {
    expect(importBatches([], 40, 2)).toEqual([])
  })
})

describe('resumeFrom', () => {
  it('goes on after the last batch the browser saw succeed', () => {
    expect(resumeFrom(30, 30, 40)).toBe(30)
  })

  it("trusts the server when it saved a batch whose answer didn't reach the browser", () => {
    expect(resumeFrom(30, 32, 40)).toBe(32)
  })

  it("keeps the browser's count when the server's is unknown", () => {
    expect(resumeFrom(30, null, 40)).toBe(30)
  })

  it('never goes past the last page', () => {
    expect(resumeFrom(38, 44, 40)).toBe(40)
  })
})
