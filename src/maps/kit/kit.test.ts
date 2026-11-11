import { describe, expect, it } from 'vitest'
import { sanitizeSvg } from '../../../supabase/functions/_shared/svg-safe'
import { emptyMap, footprint, mapProblems, MAP_KINDS, MAP_LIMITS, parseMapDoc, playersMap, type MapDoc } from './model.ts'
import { randomMap } from './random.ts'
import { renderMap } from './render.ts'
import { STAMP_LIST, STAMPS } from './stamps.ts'

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)

describe('stamps', () => {
  it('have unique ids, a size, both labels and at least one kind', () => {
    expect(new Set(STAMP_LIST.map((s) => s.id)).size).toBe(STAMP_LIST.length)
    for (const s of STAMP_LIST) {
      expect(s.id).toMatch(/^[a-z][a-z-]*$/)
      expect(s.size.every((n) => Number.isInteger(n) && n >= 1 && n <= 5)).toBe(true)
      expect(s.label.fr && s.label.en).toBeTruthy()
      expect(s.kinds.length).toBeGreaterThan(0)
    }
    for (const kind of MAP_KINDS) expect(STAMP_LIST.filter((s) => s.kinds.includes(kind)).length, kind).toBeGreaterThanOrEqual(12)
  })

  it('all draw into a file sanitizeSvg accepts', () => {
    const doc: MapDoc = { ...emptyMap('building', 48, 36, 'Tous les tampons'), items: [] }
    let x = 0
    let y = 0
    let rowH = 0
    for (const s of STAMP_LIST) {
      if (x + s.size[0] > 48) {
        x = 0
        y += rowH
        rowH = 0
      }
      doc.items.push({ t: s.id, x, y, secret: y % 2 === 0 })
      x += s.size[0]
      rowH = Math.max(rowH, s.size[1])
    }
    expect(y + rowH).toBeLessThanOrEqual(36)
    expect(() => sanitizeSvg(renderMap(doc))).not.toThrow()
  })
})

describe('parseMapDoc', () => {
  it('keeps a good map as it is', () => {
    const m = randomMap('building', 3)
    expect(parseMapDoc(JSON.parse(JSON.stringify(m)))).toEqual({ doc: m, problems: [] })
  })

  it('fixes sizes, ground, items and labels, and says so', () => {
    const { doc, problems } = parseMapDoc({
      kind: 'castle',
      title: 'Le <b>manoir</b> & "son" parc',
      ground: ['##X#', '#..', '#'.repeat(80)],
      items: [{ t: 'bed', x: 99, y: -3, r: 5, s: 9 }, { t: 'dragon', x: 1, y: 1 }, { t: 'tree' }, 'nope'],
      labels: [{ text: 'Salon<script>', x: 2.3, y: 1.74, secret: true }, { text: '', x: 1, y: 1 }],
      secret: ['x'],
    })
    expect(doc.kind).toBe('building')
    expect(doc.title).toBe('Le bmanoir/b  son parc'.replace('  ', ' '))
    expect(doc.cols).toBe(MAP_LIMITS.maxCols)
    expect(doc.rows).toBe(MAP_LIMITS.minRows)
    expect(doc.ground).toHaveLength(doc.rows)
    expect(doc.ground.every((r) => r.length === doc.cols)).toBe(true)
    expect(doc.ground[0].slice(0, 4)).toBe('##.#')
    expect(doc.items).toEqual([{ t: 'bed', x: doc.cols - 8, y: 0, r: 1, s: 4 }])
    expect(doc.labels).toEqual([{ text: 'Salonscript', x: 2.5, y: 1.5, secret: true }])
    expect(doc.secret?.[0][0]).toBe('x')
    expect(problems.length).toBeGreaterThanOrEqual(3)
  })

  it('never throws, whatever it gets', () => {
    for (const v of [null, 1, 'map', [], { ground: 'abc' }, { items: {}, labels: 3 }]) expect(() => parseMapDoc(v)).not.toThrow()
  })
})

describe('random maps', () => {
  for (const kind of MAP_KINDS) {
    it(`${kind}: same seed, same map; drawable, sound, in bounds`, () => {
      for (const seed of SEEDS) {
        const m = randomMap(kind, seed, seed % 2 ? 'fr' : 'en')
        expect(randomMap(kind, seed, seed % 2 ? 'fr' : 'en')).toEqual(m)
        expect(mapProblems(m), `${kind} ${seed}`).toEqual([])
        expect(parseMapDoc(m).problems, `${kind} ${seed}`).toEqual([])
        for (const it of m.items) {
          const [w, h] = footprint(it)
          expect(it.x + w <= m.cols && it.y + h <= m.rows, `${it.t} in ${kind} ${seed}`).toBe(true)
          expect(STAMPS[it.t]).toBeTruthy()
        }
        for (const audience of ['keeper', 'players'] as const) expect(() => sanitizeSvg(renderMap(m, { audience, lang: 'en' }))).not.toThrow()
      }
    })
  }
})

describe("the players' copy", () => {
  it('has no secret door, item, label or cell', () => {
    const m = parseMapDoc({
      kind: 'building',
      ground: ['#####', '#.s.#', '#####', '     ', '     ', '     '],
      items: [{ t: 'chest', x: 1, y: 1, secret: true }, { t: 'chair', x: 3, y: 1 }],
      labels: [{ text: 'Cache', x: 3.5, y: 1.5, secret: true }, { text: 'Salle', x: 1.5, y: 1.5 }],
      secret: ['', '...x'],
    }).doc
    const p = playersMap(m)
    expect(p.ground[1]).toBe('#.# # ')
    expect(p.items).toEqual([])
    expect(p.labels.map((l) => l.text)).toEqual(['Salle'])
    expect(p.secret).toBeUndefined()
    const svg = renderMap(m, { audience: 'players' })
    expect(svg).not.toContain('Cache')
    expect(svg).not.toContain('#9a3020')
    expect(renderMap(m, { audience: 'keeper' })).toContain('Cache')
  })
})

describe('mapProblems', () => {
  it('finds a door outside a wall and a room you cannot enter', () => {
    const m = parseMapDoc({ kind: 'building', ground: ['#######', '#..#..#', '#..#..#', '#######', '  d    ', '       '] }).doc
    const problems = mapProblems(m)
    expect(problems.some((p) => p.includes('door'))).toBe(true)
    expect(problems.some((p) => p.includes("can't be reached"))).toBe(true)
  })
})
