import { describe, expect, it } from 'vitest'
import { dieFaces, faceFor, faceLight, labelSlots, restRotation, throwKeyframes, type DieShape, type Vec } from './geometry'

const SHAPES: Array<[DieShape, faces: number, corners: number]> = [
  ['d4', 4, 3], ['d6', 6, 4], ['d8', 8, 3], ['d10', 10, 4], ['d12', 12, 5], ['d20', 20, 3],
]

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
/** Column-major matrix3d(...) applied to a direction. */
function apply(css: string, v: Vec): Vec {
  const m = css.slice('matrix3d('.length, -1).split(',').map(Number)
  return [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2]) as unknown as Vec
}
const near = (a: Vec, b: Vec) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 4))

describe('dice geometry', () => {
  it.each(SHAPES)('%s has its faces, each one flat and facing out', (shape, count, corners) => {
    const faces = dieFaces(shape)
    expect(faces).toHaveLength(count)
    for (const f of faces) {
      expect(f.points).toHaveLength(corners)
      expect(dot(f.n, f.center)).toBeGreaterThan(0)
      expect(f.inradius).toBeGreaterThan(0)
      // Corners go round one way (positive area in the face's own drawing).
      const area = f.points.reduce((s, p, i) => {
        const q = f.points[(i + 1) % f.points.length]
        return s + p[0] * q[1] - q[0] * p[1]
      }, 0)
      expect(area).toBeGreaterThan(0)
    }
  })

  it.each(SHAPES)('%s: resting on a face shows that face to the viewer, label upright', (shape) => {
    for (const f of dieFaces(shape)) {
      const r = restRotation(f)
      near(apply(r, f.n), [0, 0, 1])
      near(apply(r, f.ey), [0, 1, 0])
      near(apply(r, f.ex), [1, 0, 0])
      expect(faceLight(f, f)).toBeGreaterThan(0.4)
    }
  })

  it('d10 kites stand on their tip', () => {
    for (const f of dieFaces('d10')) {
      const tip = f.points.reduce((a, b) => (Math.hypot(...b) > Math.hypot(...a) ? b : a))
      expect(tip[0]).toBeCloseTo(0, 6)
      expect(tip[1]).toBeLessThan(0)
    }
  })

  it('opposite faces add up like real dice', () => {
    for (const shape of ['d6', 'd8', 'd10', 'd12', 'd20'] as const) {
      const faces = dieFaces(shape)
      const slots = labelSlots(faces)
      expect([...slots].sort((a, b) => a - b)).toEqual(faces.map((_, i) => i))
      faces.forEach((f, i) => {
        const j = faces.findIndex((g) => dot(f.n, g.n) < -0.999)
        expect(slots[i] + slots[j]).toBe(faces.length - 1)
      })
    }
    expect(labelSlots(dieFaces('d4'))).toEqual([0, 1, 2, 3])
  })

  it('finds a face for a label, at random among faces that show it', () => {
    const slots = labelSlots(dieFaces('d6'))
    const d3 = ['1', '2', '3', '1', '2', '3']
    const a = faceFor(slots, d3, '2', () => 0)
    const b = faceFor(slots, d3, '2', () => 0.99)
    expect(a).not.toBe(b)
    expect(d3[slots[a]]).toBe('2')
    expect(d3[slots[b]]).toBe('2')
    expect(() => faceFor(slots, d3, '4', () => 0)).toThrow()
  })

  it('a throw keeps the same transform functions on every frame and ends at rest', () => {
    const face = dieFaces('d20')[7]
    let seed = 1
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const { rest, keyframes } = throwKeyframes(face, 40, rng)
    const shape = (t: string) => t.replace(/-?[\d.e]+/g, '#')
    expect(new Set(keyframes.map((k) => shape(String(k.transform)))).size).toBe(1)
    expect(keyframes[0].offset).toBe(0)
    expect(keyframes.at(-1)).toEqual({ offset: 1, transform: rest })
    expect(rest).toContain('translate3d(0px,0px,0px)')
    expect(rest).toContain(restRotation(face))
  })
})
