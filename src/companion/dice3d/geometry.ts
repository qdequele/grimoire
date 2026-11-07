// Polyhedral dice drawn with CSS 3D transforms: the geometry (faces, where each one sits), the
// orientation that shows a given face to the viewer, and the keyframes of a throw that lands there.
// Pure: no DOM. Coordinates follow CSS: x right, y down, z towards the viewer.
import type { Rng } from '@/engine/random'

export type Vec = readonly [number, number, number]
export type DieShape = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20'

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: Vec) => Math.sqrt(dot(a, a))
const unit = (a: Vec): Vec => scale(a, 1 / len(a))
const mean = (ps: readonly Vec[]): Vec => scale(ps.reduce(add, [0, 0, 0]), 1 / ps.length)

const PHI = (1 + Math.sqrt(5)) / 2
const signs = [1, -1]

/** The pentagonal trapezohedron (d10): two apexes and a zigzag ring, heights chosen so the kites are flat. */
function d10Vertices(): Vec[] {
  const h = 1.1
  const z = (h * (1 - Math.cos(Math.PI / 5))) / (1 + Math.cos(Math.PI / 5))
  const ring = Array.from({ length: 10 }, (_, k): Vec => {
    const a = (k * Math.PI) / 5
    return [Math.cos(a), Math.sin(a), k % 2 ? -z : z]
  })
  return [[0, 0, h], [0, 0, -h], ...ring]
}

const VERTICES: Record<DieShape, Vec[]> = {
  d4: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
  d6: signs.flatMap((x) => signs.flatMap((y) => signs.map((z): Vec => [x, y, z]))),
  d8: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  d10: d10Vertices(),
  d12: [
    ...signs.flatMap((x) => signs.flatMap((y) => signs.map((z): Vec => [x, y, z]))),
    ...signs.flatMap((a) => signs.flatMap((b): Vec[] => [
      [0, a / PHI, b * PHI],
      [a / PHI, b * PHI, 0],
      [a * PHI, 0, b / PHI],
    ])),
  ],
  d20: signs.flatMap((a) => signs.flatMap((b): Vec[] => [
    [0, a, b * PHI],
    [a, b * PHI, 0],
    [b * PHI, 0, a],
  ])),
}

/** How big each solid looks next to the others (its circumradius is 1 before this). */
const SIZE: Record<DieShape, number> = { d4: 1.08, d6: 0.9, d8: 0.98, d10: 0.98, d12: 0.92, d20: 0.95 }

export interface Face {
  /** Centre of the face, die coordinates. */
  center: Vec
  /** Face axes in die coordinates: x and y of the face's own drawing (y points down the label), n out. */
  ex: Vec
  ey: Vec
  n: Vec
  /** The outline in the face's own coordinates, around its centre, in order. */
  points: Array<[number, number]>
  /** Distance from the centre to the nearest edge: how big the label can be. */
  inradius: number
  /** Distance from the centre to the farthest corner: the face element's half size. */
  outradius: number
}

/**
 * The faces of a convex solid: every plane through three vertices that has all the others behind it.
 * Brute force, fine for 20 vertices.
 */
export function hullFaces(vertices: readonly Vec[]): number[][] {
  const eps = 1e-6
  const seen = new Set<string>()
  const faces: number[][] = []
  const n = vertices.length
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const normal = cross(sub(vertices[j], vertices[i]), sub(vertices[k], vertices[i]))
        if (len(normal) < eps) continue
        const d = vertices.map((v) => dot(normal, sub(v, vertices[i])))
        if (!(d.every((x) => x <= eps) || d.every((x) => x >= -eps))) continue
        const face = d.flatMap((x, idx) => (Math.abs(x) <= eps ? [idx] : []))
        const key = face.join(',')
        if (!seen.has(key)) {
          seen.add(key)
          faces.push(face)
        }
      }
  return faces
}

function buildFace(corners: readonly Vec[], up: 'vertex' | 'edge'): Face {
  const center = mean(corners)
  let n = unit(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])))
  if (dot(n, center) < 0) n = scale(n, -1)
  // Order the corners around the centre.
  const a = unit(sub(corners[0], center))
  const b = cross(n, a)
  const angle = (p: Vec) => Math.atan2(dot(sub(p, center), b), dot(sub(p, center), a))
  const ring = [...corners].sort((p, q) => angle(p) - angle(q))
  // The label stands upright towards a corner (the farthest one: a d10 kite's tip) or, for squares, an edge.
  let top: Vec
  if (up === 'edge') top = mean([ring[0], ring[1]])
  else top = ring.reduce((best, p) => (len(sub(p, center)) > len(sub(best, center)) + 1e-9 ? p : best))
  const ey = scale(unit(sub(top, center)), -1)
  const ex = cross(ey, n)
  const points = ring.map((p): [number, number] => [dot(sub(p, center), ex), dot(sub(p, center), ey)])
  const edgeDistance = points.map((p, i) => {
    const q = points[(i + 1) % points.length]
    return Math.abs(p[0] * q[1] - p[1] * q[0]) / Math.hypot(q[0] - p[0], q[1] - p[1])
  })
  return {
    center, ex, ey, n, points,
    inradius: Math.min(...edgeDistance),
    outradius: Math.max(...points.map(([x, y]) => Math.hypot(x, y))),
  }
}

const cache = new Map<DieShape, Face[]>()

/** The faces of a die, its circumradius scaled to `SIZE` (multiply by the die's half size in px). */
export function dieFaces(shape: DieShape): Face[] {
  const hit = cache.get(shape)
  if (hit) return hit
  const raw = VERTICES[shape]
  const r = Math.max(...raw.map(len))
  const vertices = raw.map((v) => scale(v, SIZE[shape] / r))
  const faces = hullFaces(vertices).map((idx) => buildFace(idx.map((i) => vertices[i]), shape === 'd6' ? 'edge' : 'vertex'))
  cache.set(shape, faces)
  return faces
}

/**
 * Which label each face carries (an index into the die's labels, given in order): like real dice,
 * opposite faces add up (first with last, second with second to last…) when the solid has them.
 */
export function labelSlots(faces: readonly Face[]): number[] {
  const count = faces.length
  const slots: number[] = new Array(count).fill(-1)
  const opposite = faces.map((f) => faces.findIndex((g) => dot(f.n, g.n) < -0.999))
  if (opposite.some((o) => o < 0)) return faces.map((_, i) => i)
  let next = 0
  faces.forEach((_, i) => {
    if (slots[i] >= 0) return
    slots[i] = next
    slots[opposite[i]] = count - 1 - next
    next++
  })
  return slots
}

/** A face that shows `label` (one of them at random when several do, as on a d6 used as a d3). */
export function faceFor(slots: readonly number[], labels: readonly string[], label: string, rng: Rng): number {
  const matches = slots.flatMap((slot, i) => (labels[slot] === label ? [i] : []))
  if (!matches.length) throw new Error(`no face shows ${label}`)
  return matches[Math.floor(rng() * matches.length)]
}

const fmt = (x: number) => (Math.abs(x) < 1e-9 ? '0' : String(Math.round(x * 1e6) / 1e6))

/** CSS matrix3d (column-major) from three axes and a translation. */
export function matrix3d(x: Vec, y: Vec, z: Vec, t: Vec = [0, 0, 0]): string {
  return `matrix3d(${[...x, 0, ...y, 0, ...z, 0, ...t, 1].map(fmt).join(',')})`
}

/** Where a face element sits on the die: its own x, y and normal, at its centre (`size` = px per unit). */
export function faceTransform(face: Face, size: number): string {
  return matrix3d(face.ex, face.ey, face.n, scale(face.center, size))
}

/** The rotation that turns the die so `face` looks at the viewer, label upright: the face frame, transposed. */
export function restRotation(face: Face): string {
  const { ex, ey, n } = face
  return matrix3d([ex[0], ey[0], n[0]], [ex[1], ey[1], n[1]], [ex[2], ey[2], n[2]])
}

/** How lit a face is once the die rests on `shown` (0 dark … 1 full light), light from the top left. */
export function faceLight(face: Face, shown: Face): number {
  const light = unit([-0.35, -0.55, 0.75])
  // The face's normal after restRotation(shown): its coordinates in the shown face's frame.
  const n: Vec = [dot(face.n, shown.ex), dot(face.n, shown.ey), dot(face.n, shown.n)]
  return Math.max(0, dot(n, light))
}

export interface Throw {
  /** The die's final transform. */
  rest: string
  keyframes: Keyframe[]
}

/**
 * A throw that lands on `face`: the die comes in high (bigger, through perspective), bounces twice,
 * spins down to a stop, and rests slightly tilted so a little of its sides shows. Every keyframe has
 * the same list of transform functions, so the browser interpolates each angle (several full turns).
 */
export function throwKeyframes(face: Face, size: number, rng: Rng, steps = 30): Throw {
  const spin = (turns: number) => (rng() < 0.5 ? -1 : 1) * (turns + rng() * 1.5) * 360
  const rx = spin(1.5), ry = spin(1.5), rz = spin(0.5)
  const x0 = (rng() - 0.5) * size * 2
  const y0 = -size * (0.7 + rng() * 0.6)
  const z0 = size * 1.6
  const tilt = `rotateX(${fmt(14 + rng() * 6)}deg) rotateY(${fmt((rng() - 0.5) * 24)}deg) rotateZ(${fmt((rng() - 0.5) * 24)}deg)`
  const rotation = restRotation(face)
  const at = (t: number) => {
    const left = (1 - t) ** 3 // ease-out cubic: what is left of the travel and spin
    // Lands at t = 1/6, 1/2, 5/6 with smaller hops in between.
    const z = z0 * Math.exp(-4.5 * t) * Math.abs(Math.cos(3 * Math.PI * t)) * (1 - t)
    return `translate3d(${fmt(x0 * left)}px,${fmt(y0 * left)}px,${fmt(z)}px) ${tilt} rotateX(${fmt(rx * left)}deg) rotateY(${fmt(ry * left)}deg) rotateZ(${fmt(rz * left)}deg) ${rotation}`
  }
  const keyframes = Array.from({ length: steps + 1 }, (_, i) => ({ offset: i / steps, transform: at(i / steps) }))
  return { rest: at(1), keyframes }
}
