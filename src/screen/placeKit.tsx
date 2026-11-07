// Drawing kit for the ambiance screen's drawn décors: the frame, the layers, and the helpers every
// place draws with (ridges, grass, trees, stones, windows, lights, the moon). Each place is a `Draw`
// (src/screen/Places.tsx for the first ten, src/screen/places/*.tsx for the others). How to draw one
// that holds together: the decor-artist skill (.claude/skills/decor-artist/SKILL.md).
// The kit mixes components (Layer, P, Moon…) and helpers on purpose: it is a drawing library, not a page.
/* oxlint-disable react/only-export-components */
import type { ReactNode, SVGProps } from 'react'

export const W = 1600
export const H = 900

// A light goes in the lit layer of its shape's depth (`lit-far`, `lit` = mid, `lit-near`): layers of
// different depths drift apart, so a lamp's glass drawn at another depth than its post slides off it.
// `mid-front`: drifts with mid but is drawn after its lights (a veranda's railing in front of lit windows).
export type Depth = 'far' | 'mid' | 'mid-front' | 'near' | 'lit' | 'lit-far' | 'lit-near' | 'pulse' | 'pulse-mid' | 'water'

export function Layer({ depth, children }: { depth: Depth; children: ReactNode }) {
  return (
    <svg className={`scr-par scr-par-${depth}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden fill="currentColor">
      {children}
    </svg>
  )
}

// ------------------------------------------------------------------ drawing helpers
/**
 * A silhouette path. Under the default nonzero fill rule, shapes of one path that overlap fill their
 * overlap only when they are drawn the same way round: a roof band drawn clockwise under spikes drawn
 * anticlockwise leaves a notch at each spike, the sky showing through. So each shape (subpath) of a
 * plain silhouette is drawn as its own element, and overlaps always fill (e2e/decors.spec.ts, rule 4).
 * Paths that cut holes on purpose (fill-rule evenodd), or whose look depends on being one element (a
 * gradient spanning all its shapes, transparency), are drawn as they are.
 */
export function P({ d, 'data-ground': ground, ...rest }: SVGProps<SVGPathElement> & { 'data-ground'?: boolean | 'each' }) {
  // `data-ground`: this shape stands on the ground (its lowest edge must rest on something: the décor
  // check, rule 5); `'each'`: every piece does (grass blades). Set on a group around the pieces.
  if (ground !== undefined) return <g data-ground={ground === 'each' ? 'each' : ''}><P d={d} {...rest} /></g>
  const fill = typeof rest.fill === 'string' ? rest.fill : ''
  const whole = !d || rest.fillRule === 'evenodd' || rest.opacity !== undefined || fill.includes('url(') || fill === 'none'
  const shapes = whole ? [] : d.split(/(?=M)/).map((x) => x.trim()).filter(Boolean)
  if (shapes.length < 2) return <path d={d} {...rest} />
  // Shapes that only touched inside one path would now meet as separate elements, and anti-aliasing
  // leaves a light hairline where two elements share an edge: a thin outline in their own colour makes
  // neighbours overlap. (Paths coloured by a class keep their look and get none.)
  const seam = rest.className || rest.stroke ? {} : { stroke: fill || 'currentColor', strokeWidth: 0.6, strokeLinejoin: 'round' as const }
  return (
    <>
      {shapes.map((x, i) => (
        <path key={i} d={x} {...seam} {...rest} />
      ))}
    </>
  )
}


/** Small seeded random generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const f = (n: number) => n.toFixed(1)

/** Rolling ground or hills: a filled ridge line around `base`. */
/** The height at x of the ridge drawn by `ridge` (same arguments): to plant grass, trees and stones on it. */
export function ridgeAt(base: number, amp: number, seed: number, step = 20): (x: number) => number {
  const r = rng(seed)
  const p = [r() * 6, r() * 6, r() * 6]
  const curve = (x: number) => base - amp * (0.5 * Math.sin(x / 260 + p[0]) + 0.3 * Math.sin(x / 97 + p[1]) + 0.2 * Math.sin(x / 41 + p[2]))
  // The drawn ridge is a polyline through the curve every `step` units: follow the polyline, not the curve.
  return (x) => {
    const x0 = Math.floor((x + 40) / step) * step - 40
    const t = (x - x0) / step
    return curve(x0) * (1 - t) + curve(x0 + step) * t
  }
}

export function ridge(base: number, amp: number, seed: number, step = 20): string {
  const y = ridgeAt(base, amp, seed, step)
  let d = `M-40 ${H} L-40 ${base}`
  for (let x = -40; x <= W + 40; x += step) d += ` L${x} ${f(y(x))}`
  return `${d} L${W + 40} ${H} Z`
}

/** Tufts of grass along y: thin leaning blades (seeded), for the nearest ground. */
/**
 * Tufts of grass along the ground: `ground` is its height (a number for flat ground, or a ridge's
 * `ridgeAt` for rolling ground). Each blade's foot is sunk a few units into the ground: planted on a
 * straight line over a wavy ridge, blades stood on air wherever the ridge dipped. Draw with `data-ground`
 * (e2e/decors.spec.ts checks that every blade's foot rests on something).
 */
export function grass(ground: number | ((x: number) => number), seed: number, x1 = -40, x2 = W + 40, hMax = 26): string {
  const r = rng(seed)
  const at = typeof ground === 'number' ? () => ground : ground
  let d = ''
  for (let x = x1; x < x2; x += 3 + r() * 7) {
    const h = hMax * (0.3 + r() * 0.7)
    const lean = (r() - 0.5) * h * 0.7
    const y = Math.min(H + 2, at(x + 1.75) + 4)
    d += `M${f(x)} ${f(y)} L${f(x + 1.5 + lean)} ${f(y - 4 - h)} L${f(x + 3.5)} ${f(y)} Z `
  }
  return d
}

/** A fir tree: stacked tiers on a short trunk. */
export function pine(x: number, base: number, h: number, w: number): string {
  const tiers = 5
  const top = base - h
  const right: string[] = []
  const left: string[] = []
  for (let i = 1; i <= tiers; i++) {
    const y = top + (h * 0.86 * i) / tiers
    const half = ((w / 2) * (0.35 + 0.65 * i)) / tiers * 1.3
    right.push(`${f(x + half)} ${f(y)}`)
    left.unshift(`${f(x - half)} ${f(y)}`)
    if (i < tiers) {
      right.push(`${f(x + half * 0.45)} ${f(y - h * 0.02)}`)
      left.unshift(`${f(x - half * 0.45)} ${f(y - h * 0.02)}`)
    }
  }
  const t = Math.max(2, w * 0.06)
  return `M${f(x)} ${f(top)} L${right.join(' L')} L${f(x + t)} ${f(top + h * 0.86)} L${f(x + t)} ${base} L${f(x - t)} ${base} L${f(x - t)} ${f(top + h * 0.86)} L${left.join(' L')} Z`
}

/** A bare, twisted tree: branches as strokes, thinner at each fork. */
export function BareTree({ x, base, h, seed, lean = 0 }: { x: number; base: number; h: number; seed: number; lean?: number }) {
  const r = rng(seed)
  const levels: string[][] = Array.from({ length: 7 }, () => [])
  const grow = (x0: number, y0: number, len: number, ang: number, depth: number) => {
    if (depth >= levels.length || len < 4) return
    const x1 = x0 + Math.cos(ang) * len
    const y1 = y0 + Math.sin(ang) * len
    levels[depth].push(`M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`)
    const n = depth === 0 ? 2 : r() < 0.35 ? 3 : 2
    for (let i = 0; i < n; i++) {
      grow(x1, y1, len * (0.6 + r() * 0.2), ang + (i - (n - 1) / 2) * 0.62 + (r() - 0.5) * 0.7, depth + 1)
    }
  }
  grow(x, base, h * 0.36, -Math.PI / 2 + lean, 0)
  return (
    <g stroke="currentColor" strokeLinecap="round" fill="none">
      {levels.map((d, i) => d.length > 0 && <path key={i} d={d.join('')} strokeWidth={Math.max(1, h * 0.05 * 0.6 ** i)} />)}
    </g>
  )
}

/** A rounded headstone, base at y. */
export const stone = (x: number, y: number, w: number, h: number) =>
  `M${f(x - w / 2)} ${y} V${f(y - h + w / 2)} A${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(x + w / 2)} ${f(y - h + w / 2)} V${y} Z`

/** A cross, base at y. */
export const cross = (x: number, y: number, h: number) => {
  const a = h * 0.07
  const b = h * 0.28
  return `M${f(x - a)} ${y} V${f(y - h * 0.62)} H${f(x - b)} V${f(y - h * 0.76)} H${f(x - a)} V${f(y - h)} H${f(x + a)} V${f(y - h * 0.76)} H${f(x + b)} V${f(y - h * 0.62)} H${f(x + a)} V${y} Z`
}

/** A pointed (gothic) window: x, y is the top left of its straight part. */
export const gothic = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y + h} V${y} Q${x} ${y - w * 0.55} ${x + w / 2} ${y - w * 0.8} Q${x + w} ${y - w * 0.55} ${x + w} ${y} V${y + h} Z`

/** A round-topped window or door. */
export const arched = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y + h} V${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} V${y + h} Z`

/** A crenellated wall top: merlons along [x1, x2] on top of y. */
export function merlons(x1: number, x2: number, y: number, m: number): string {
  let d = ''
  for (let x = x1; x + m <= x2 + 0.1; x += m * 2) d += `M${x} ${y} h${m} v${-m} h${-m} Z`
  return d
}

/** An iron fence with spikes, and an open gate between gateFrom and gateTo. */
export function Fence({ y, h, gateFrom, gateTo }: { y: number; h: number; gateFrom?: number; gateTo?: number }) {
  const bars: string[] = []
  for (let x = 10; x < W; x += 26) {
    if (gateFrom !== undefined && gateTo !== undefined && x > gateFrom - 10 && x < gateTo + 10) continue
    bars.push(`M${x - 2} ${H} V${y - h} l2 -14 l2 14 V${H} Z`)
  }
  const rails = gateFrom !== undefined && gateTo !== undefined
    ? `M0 ${y - h + 18} H${gateFrom - 10} v6 H0 Z M${gateTo + 10} ${y - h + 18} H${W} v6 H${gateTo + 10} Z M0 ${y - 30} H${gateFrom - 10} v6 H0 Z M${gateTo + 10} ${y - 30} H${W} v6 H${gateTo + 10} Z`
    : `M0 ${y - h + 18} H${W} v6 H0 Z M0 ${y - 30} H${W} v6 H0 Z`
  return (
    <g>
      <P d={bars.join(' ') + rails} />
      {gateFrom !== undefined && gateTo !== undefined && (
        <P d={`M${gateFrom - 22} ${H} V${y - h - 30} h30 V${H} Z M${gateTo - 8} ${H} V${y - h - 30} h30 V${H} Z`} />
      )}
      {gateFrom !== undefined && gateTo !== undefined && (
        <g>
          <circle cx={gateFrom - 7} cy={y - h - 42} r={14} />
          <circle cx={gateTo + 7} cy={y - h - 42} r={14} />
        </g>
      )}
    </g>
  )
}

/** Soft light around a point (lamps, candles, windows): a radial gradient defined once per place. */
export const Halo = ({ id, x, y, r, o = 1 }: { id: string; x: number; y: number; r: number; o?: number }) => (
  <circle cx={x} cy={y} r={r} fill={`url(#${id})`} opacity={o} />
)

/** The moon at night and dusk, the sun by day (screen.css shows one, or neither under a grey sky). */
export const Moon = ({ x, y, r, id }: { x: number; y: number; r: number; id: string }) => (
  <>
    <g className="scr-moon">
      <circle cx={x} cy={y} r={r * 6} fill={`url(#${id}-moon)`} />
      <circle cx={x} cy={y} r={r} />
      {/* faint seas on its face */}
      <P
        d={`M${f(x - r * 0.62)} ${f(y - r * 0.1)} q${f(r * 0.1)} ${f(-r * 0.42)} ${f(r * 0.5)} ${f(-r * 0.36)} q${f(r * 0.34)} ${f(r * 0.08)} ${f(r * 0.22)} ${f(r * 0.4)} q${f(r * 0.2)} ${f(r * 0.3)} ${f(r * 0.46)} ${f(r * 0.38)} q${f(r * 0.1)} ${f(r * 0.32)} ${f(-r * 0.3)} ${f(r * 0.36)} q${f(-r * 0.4)} ${f(-r * 0.02)} ${f(-r * 0.5)} ${f(-r * 0.36)} q${f(-r * 0.3)} ${f(-r * 0.06)} ${f(-r * 0.38)} ${f(-r * 0.42)} Z`}
        fill="var(--sil-far)"
        opacity={0.04}
      />
    </g>
    <g className="scr-sun">
      <circle cx={x} cy={y} r={r * 7} fill={`url(#${id}-sun)`} />
      <circle cx={x} cy={y} r={r * 0.9} />
    </g>
  </>
)

/** Gradients shared by the layers of one place (ids are per instance: two layers may show at once). */
export function Defs({ id }: { id: string }) {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="var(--lit)" stopOpacity="0.55" />
          <stop offset="0.35" stopColor="var(--lit)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--lit)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-moon`}>
          <stop offset="0" stopColor="var(--moon)" stopOpacity="0.4" />
          <stop offset="0.17" stopColor="var(--moon)" stopOpacity="0.16" />
          <stop offset="0.45" stopColor="var(--moon)" stopOpacity="0.05" />
          <stop offset="1" stopColor="var(--moon)" stopOpacity="0" />
        </radialGradient>
        {/* lit glass: brighter low down, where the lamps are */}
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--lit)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--lit)" stopOpacity="0.95" />
        </linearGradient>
        {/* light thrown on the ground from a door or a window, fading away from it */}
        {/* a wet road holding the sky's light, brightest far away */}
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sil-far)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--sil-far)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-ray`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--lit)" stopOpacity="0.38" />
          <stop offset="1" stopColor="var(--lit)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-sun`}>
          <stop offset="0" stopColor="var(--sun)" stopOpacity="0.6" />
          <stop offset="0.25" stopColor="var(--sun)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--sun)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-beam`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--lit)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--lit)" stopOpacity="0.4" />
        </linearGradient>
        {/* soft edges for light in the air (moon shafts through mist): blurred once, never animated */}
        <filter id={`${id}-soft`} x="-30%" y="-5%" width="160%" height="110%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <linearGradient id={`${id}-shaft`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--moon)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--moon)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}


/** A crow perched at x, y (its feet), facing right, or left when `flip`. */
export const crow = (x: number, y: number, s: number, flip = false) => {
  const k = flip ? -s : s
  return `M${f(x - 14 * k)} ${f(y - 6 * s)} L${f(x - 26 * k)} ${f(y - 2 * s)} L${f(x - 12 * k)} ${f(y - 10 * s)} Q${f(x - 4 * k)} ${f(y - 20 * s)} ${f(x + 8 * k)} ${f(y - 19 * s)} Q${f(x + 12 * k)} ${f(y - 27 * s)} ${f(x + 17 * k)} ${f(y - 24 * s)} L${f(x + 25 * k)} ${f(y - 22 * s)} L${f(x + 17 * k)} ${f(y - 19 * s)} Q${f(x + 14 * k)} ${f(y - 9 * s)} ${f(x + 2 * k)} ${f(y - 4 * s)} L${f(x + 3 * k)} ${y} L${f(x + 1 * k)} ${y} L${f(x - 1 * k)} ${f(y - 4 * s)} Z`
}

/** A bat in flight, wings spread, centred on x, y. */
export const bat = (x: number, y: number, s: number) =>
  `M${f(x)} ${f(y - 3 * s)} Q${f(x - 8 * s)} ${f(y - 12 * s)} ${f(x - 22 * s)} ${f(y - 8 * s)} Q${f(x - 16 * s)} ${f(y - 4 * s)} ${f(x - 18 * s)} ${f(y + 2 * s)} Q${f(x - 10 * s)} ${f(y - 2 * s)} ${f(x - 6 * s)} ${f(y + 3 * s)} Q${f(x - 3 * s)} ${f(y)} ${f(x)} ${f(y + 4 * s)} Q${f(x + 3 * s)} ${f(y)} ${f(x + 6 * s)} ${f(y + 3 * s)} Q${f(x + 10 * s)} ${f(y - 2 * s)} ${f(x + 18 * s)} ${f(y + 2 * s)} Q${f(x + 16 * s)} ${f(y - 4 * s)} ${f(x + 22 * s)} ${f(y - 8 * s)} Q${f(x + 8 * s)} ${f(y - 12 * s)} ${f(x)} ${f(y - 3 * s)} Z`

/** A jagged outline through the given points, each segment broken into small random steps (rock). */
export function jagged(points: Array<[number, number]>, seed: number, rough = 10): string {
  const r = rng(seed)
  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 26))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const j = k === n ? 0 : rough
      d += ` L${f(x0 + (x1 - x0) * t + (r() - 0.5) * j)} ${f(y0 + (y1 - y0) * t + (r() - 0.5) * j)}`
    }
  }
  return `${d} Z`
}

/** A 1920s motor car facing right, wheels on y: an upright cabin, a long bonnet, fenders over the wheels. */
export const motorCar = (x: number, y: number) =>
  // body: boot, cabin with its roof, bonnet down to the radiator
  `M${x + 10} ${y - 40} V${y - 86} Q${x + 12} ${y - 98} ${x + 30} ${y - 98} H${x + 92} V${y - 168} Q${x + 92} ${y - 180} ${x + 106} ${y - 180} H${x + 252} Q${x + 266} ${y - 180} ${x + 266} ${y - 168} V${y - 104} L${x + 400} ${y - 98} Q${x + 414} ${y - 96} ${x + 414} ${y - 84} V${y - 40} Z ` +
  // rear and front fenders, the running board between them, the radiator, the spare wheel
  `M${x + 30} ${y - 30} Q${x + 36} ${y - 84} ${x + 90} ${y - 84} Q${x + 142} ${y - 82} ${x + 152} ${y - 30} Z M${x + 300} ${y - 30} Q${x + 308} ${y - 86} ${x + 362} ${y - 86} Q${x + 418} ${y - 84} ${x + 440} ${y - 42} V${y - 30} Z ` +
  `M${x + 146} ${y - 36} H${x + 306} v-8 H${x + 146} Z M${x + 410} ${y - 104} h12 v62 h-12 Z M${x - 20} ${y - 66} a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0 Z`

/** A ragged fir: drooping tiers with uneven tips, a little lopsided, on a short trunk. */
export function ragPine(x: number, base: number, h: number, w: number, r: () => number): string {
  const tiers = 7 + Math.floor(r() * 4)
  const top = base - h
  const right: string[] = []
  const left: string[] = []
  const skew = (r() - 0.5) * 0.3
  for (let i = 1; i <= tiers; i++) {
    const t = i / tiers
    const y = top + h * 0.9 * t
    const half = (w / 2) * (0.12 + 0.88 * t) * (0.8 + r() * 0.4)
    const droop = h * 0.035 * (0.5 + r())
    right.push(`${f(x + half * (1 + skew))} ${f(y + droop)}`, `${f(x + half * 0.3)} ${f(y + h * 0.02)}`)
    left.unshift(`${f(x - half * 0.3)} ${f(y + h * 0.02)}`, `${f(x - half * (1 - skew) * (0.85 + r() * 0.3))} ${f(y + droop * (0.6 + r()))}`)
  }
  const tr = Math.max(2, w * 0.05)
  return `M${f(x)} ${f(top)} L${right.join(' L')} L${f(x + tr)} ${f(top + h * 0.92)} L${f(x + tr)} ${base} L${f(x - tr)} ${base} L${f(x - tr)} ${f(top + h * 0.92)} L${left.join(' L')} Z`
}

/** A place: its layers, given the id prefix of its gradients (Defs). */
export type Draw = (id: string) => ReactNode
