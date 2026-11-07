// Drawn décors for the ambiance screen: a place in silhouettes, when the scene has no picture.
// Original drawings, generated from code (seeded, so a place always looks the same).
//
// Each place is a few full-screen SVG layers (far, mid, near…), all on the same 1600×900 frame anchored
// at the bottom. The layers drift at different speeds (parallax) and the lit layer breathes: each layer is
// its own element, so the browser only moves and fades it (screen.css, `.scr-par`), it never redraws.
// Colours come from the preset's palette (CSS variables), so a graveyard is blue in the night, green
// during a ritual, red in a nightmare.
import { useId, type ReactNode } from 'react'
import type { PlaceId } from './ambiance'

const W = 1600
const H = 900

type Depth = 'far' | 'mid' | 'near' | 'lit' | 'pulse' | 'water'

function Layer({ depth, children }: { depth: Depth; children: ReactNode }) {
  return (
    <svg className={`scr-par scr-par-${depth}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden fill="currentColor">
      {children}
    </svg>
  )
}

// ------------------------------------------------------------------ drawing helpers

/** Small seeded random generator (mulberry32). */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const f = (n: number) => n.toFixed(1)

/** Rolling ground or hills: a filled ridge line around `base`. */
function ridge(base: number, amp: number, seed: number, step = 20): string {
  const r = rng(seed)
  const p = [r() * 6, r() * 6, r() * 6]
  let d = `M-40 ${H} L-40 ${base}`
  for (let x = -40; x <= W + 40; x += step) {
    const y = base - amp * (0.5 * Math.sin(x / 260 + p[0]) + 0.3 * Math.sin(x / 97 + p[1]) + 0.2 * Math.sin(x / 41 + p[2]))
    d += ` L${x} ${f(y)}`
  }
  return `${d} L${W + 40} ${H} Z`
}

/** Tufts of grass along y: thin leaning blades (seeded), for the nearest ground. */
function grass(y: number, seed: number, x1 = -40, x2 = W + 40, hMax = 26): string {
  const r = rng(seed)
  let d = ''
  for (let x = x1; x < x2; x += 3 + r() * 7) {
    const h = hMax * (0.3 + r() * 0.7)
    const lean = (r() - 0.5) * h * 0.7
    d += `M${f(x)} ${y + 2} L${f(x + 1.5 + lean)} ${f(y - h)} L${f(x + 3.5)} ${y + 2} Z `
  }
  return d
}

/** A fir tree: stacked tiers on a short trunk. */
function pine(x: number, base: number, h: number, w: number): string {
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
function BareTree({ x, base, h, seed, lean = 0 }: { x: number; base: number; h: number; seed: number; lean?: number }) {
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
const stone = (x: number, y: number, w: number, h: number) =>
  `M${f(x - w / 2)} ${y} V${f(y - h + w / 2)} A${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(x + w / 2)} ${f(y - h + w / 2)} V${y} Z`

/** A cross, base at y. */
const cross = (x: number, y: number, h: number) => {
  const a = h * 0.07
  const b = h * 0.28
  return `M${f(x - a)} ${y} V${f(y - h * 0.62)} H${f(x - b)} V${f(y - h * 0.76)} H${f(x - a)} V${f(y - h)} H${f(x + a)} V${f(y - h * 0.76)} H${f(x + b)} V${f(y - h * 0.62)} H${f(x + a)} V${y} Z`
}

/** A pointed (gothic) window: x, y is the top left of its straight part. */
const gothic = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y + h} V${y} Q${x} ${y - w * 0.55} ${x + w / 2} ${y - w * 0.8} Q${x + w} ${y - w * 0.55} ${x + w} ${y} V${y + h} Z`

/** A round-topped window or door. */
const arched = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y + h} V${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} V${y + h} Z`

/** A crenellated wall top: merlons along [x1, x2] on top of y. */
function merlons(x1: number, x2: number, y: number, m: number): string {
  let d = ''
  for (let x = x1; x + m <= x2 + 0.1; x += m * 2) d += `M${x} ${y} h${m} v${-m} h${-m} Z`
  return d
}

/** An iron fence with spikes, and an open gate between gateFrom and gateTo. */
function Fence({ y, h, gateFrom, gateTo }: { y: number; h: number; gateFrom?: number; gateTo?: number }) {
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
      <path d={bars.join(' ') + rails} />
      {gateFrom !== undefined && gateTo !== undefined && (
        <path d={`M${gateFrom - 22} ${H} V${y - h - 30} h30 V${H} Z M${gateTo - 8} ${H} V${y - h - 30} h30 V${H} Z`} />
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
const Halo = ({ id, x, y, r, o = 1 }: { id: string; x: number; y: number; r: number; o?: number }) => (
  <circle cx={x} cy={y} r={r} fill={`url(#${id})`} opacity={o} />
)

/** Windows on a grid, some lit (seeded): `lit` gets the lit ones, `dark` the rest. */
function windowGrid(x: number, y: number, cols: number, rows: number, w: number, h: number, gx: number, gy: number, seed: number, chance: number) {
  const r = rng(seed)
  const lit: string[] = []
  const dark: string[] = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const d = `M${x + i * gx} ${y + j * gy} h${w} v${h} h${-w} Z`
      ;(r() < chance ? lit : dark).push(d)
    }
  }
  return { lit: lit.join(' '), dark: dark.join(' ') }
}

/** The moon at night and dusk, the sun by day (screen.css shows one, or neither under a grey sky). */
const Moon = ({ x, y, r, id }: { x: number; y: number; r: number; id: string }) => (
  <>
    <g className="scr-moon">
      <circle cx={x} cy={y} r={r * 6} fill={`url(#${id}-moon)`} />
      <circle cx={x} cy={y} r={r} />
      {/* faint seas on its face */}
      <path
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
function Defs({ id }: { id: string }) {
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
        <linearGradient id={`${id}-shaft`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--moon)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--moon)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ------------------------------------------------------------------ the places

type Draw = (id: string) => ReactNode

const church: Draw = (id) => {
  // A gothic parish church seen from the side: west tower and spire, a tall nave with its clerestory
  // above a lower aisle, buttresses rising into pinnacles, a round apse at the east end.
  const piers = [700, 796, 892, 988, 1084, 1180]
  const bays = piers.slice(0, -1).map((x) => x + 48)
  const clerestory = bays.map((c) => gothic(c - 15, 548, 30, 92)).join(' ')
  const aisle = bays.map((c) => gothic(c - 17, 764, 34, 66)).join(' ')
  const apse = `${gothic(1214, 680, 18, 110)} ${gothic(1252, 680, 18, 110)}`
  const belfry = `${gothic(584, 404, 18, 52)} ${gothic(618, 404, 18, 52)}`
  // Mullions and transoms over the lit glass.
  const tracery = [
    ...bays.map((c) => `M${c} 530 V640 M${c - 15} 596 H${c + 15}`),
    ...bays.map((c) => `M${c} 750 V830`),
    'M1223 666 V790 M1261 666 V790',
  ].join(' ')
  const rose = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    return `M${f(620 + Math.cos(a) * 10)} ${f(530 + Math.sin(a) * 10)} L${f(620 + Math.cos(a) * 30)} ${f(530 + Math.sin(a) * 30)}`
  }).join(' ')
  const pinnacle = (x: number, y: number, w: number, h: number) => `M${x - w / 2} ${y} L${x} ${y - h} L${x + w / 2} ${y} Z`
  return (
    <>
      <Layer depth="far">
        <Moon x={1250} y={190} r={46} id={id} />
        <path d={ridge(640, 46, 15, 30)} fill="var(--sil-haze)" />
        <path d={ridge(700, 50, 11)} />
        {/* a hamlet on the far hill, one window still awake */}
        <path d={`${pine(120, 690, 70, 34)} ${pine(160, 694, 52, 28)} ${pine(1500, 668, 80, 36)} ${pine(1540, 672, 60, 30)} M300 700 V668 L322 650 L344 668 V700 Z M352 700 V676 H392 V700 Z M372 676 v-12 h6 v12 Z`} />
        <path d="M312 680 h7 v9 h-7 Z" fill="var(--lit)" className="scr-glow" opacity={0.7} />
      </Layer>
      <Layer depth="mid">
        {/* the clerestory wall, set back behind the aisle */}
        <path d="M692 870 V474 H1180 V870 Z" fill="var(--sil-back)" />
        {/* nave roof */}
        <path d="M684 478 L712 384 H1156 L1188 478 Z" />
        {/* aisle: wall and lean-to roof */}
        <path d="M692 870 V724 H1180 V870 Z M688 728 L700 664 H1176 L1184 728 Z" />
        {/* buttresses: stepped piers rising into pinnacles above the aisle roof */}
        <path d={piers.map((x) => `M${x - 14} 870 V780 l4 -10 V622 h20 V770 l4 10 V870 Z ${pinnacle(x, 624, 18, 60)}`).join(' ')} />
        {/* the apse and its conical roof */}
        <path d="M1176 870 V650 H1294 V870 Z M1170 654 Q1196 600 1235 568 Q1274 600 1300 654 Z" />
        {/* tower: stages, string courses, corner buttresses, parapet and pinnacles */}
        <path d="M548 870 V364 H692 V870 Z M542 604 h156 v10 h-156 Z M542 472 h156 v10 h-156 Z M538 364 h164 v-16 h-164 Z" />
        <path d={`M520 870 V760 l10 -14 V604 h18 V870 Z ${pinnacle(546, 350, 16, 54)} ${pinnacle(694, 350, 16, 54)} ${merlons(560, 680, 348, 12)}`} />
        {/* the spire and its cross */}
        <path d={`M566 352 L620 104 L674 352 Z ${cross(620, 108, 58)}`} />
        {/* belfry louvres: dark slats in the openings */}
        <path d={belfry} fill="var(--sil-near)" />
        <path d={[0, 1, 2, 3, 4].map((i) => `M584 ${412 + i * 9} h18 v3 h-18 Z M618 ${412 + i * 9} h18 v3 h-18 Z`).join(' ')} fill="var(--sil-back)" />
        {/* the buttresses' faces turned from the moon, in shadow */}
        <path d={piers.map((x) => `M${x - 14} 870 V780 l4 -10 V622 h7 V870 Z`).join(' ')} fill="var(--sil-near)" opacity={0.55} />
        {/* moonlight on the edges facing the moon */}
        <g className="scr-rim" strokeWidth={2}>
          <path d="M620 108 L674 352 M1156 384 L1188 478 M712 384 H1156 M1235 568 Q1274 600 1300 654 M700 664 H1176 M538 348 H702" />
          <path d={piers.map((x) => `M${x} 564 L${x + 9} 624 V664`).join(' ')} />
        </g>
        <path d={ridge(872, 8, 12)} />
      </Layer>
      <Layer depth="lit">
        <Halo id={`${id}-halo`} x={620} y={830} r={170} o={0.75} />
        <Halo id={`${id}-halo`} x={940} y={600} r={330} o={0.25} />
        <g fill={`url(#${id}-glass)`}>
          <path d={`${clerestory} ${aisle} ${apse}`} />
          <circle cx={620} cy={530} r={30} />
          {/* the west door, open */}
          <path d={gothic(596, 796, 48, 74)} />
        </g>
        <g stroke="var(--sil-mid)" strokeWidth={3} fill="none">
          <path d={tracery} />
          <path d={rose} />
          <circle cx={620} cy={530} r={10} />
          <circle cx={620} cy={530} r={30} strokeWidth={4} />
        </g>
        {/* light spilling from the door and the aisle windows onto the ground */}
        <path d="M596 870 H644 L720 900 H520 Z" fill={`url(#${id}-ray)`} />
        <path d={bays.map((c) => `M${c - 17} 872 h34 l14 28 h-62 Z`).join(' ')} fill={`url(#${id}-ray)`} opacity={0.6} />
      </Layer>
      <Layer depth="near">
        <path d={`${stone(110, 904, 62, 126)} ${cross(220, 904, 160)} ${stone(325, 904, 44, 78)} ${stone(400, 904, 30, 52)} ${stone(1250, 904, 52, 96)} ${cross(1160, 904, 112)} ${stone(1340, 904, 36, 60)}`} />
        <BareTree x={1450} base={904} h={640} seed={13} lean={-0.08} />
        <path d={ridge(892, 8, 14)} />
        <path d={grass(892, 16)} />
      </Layer>
    </>
  )
}

/** A crow perched at x, y (its feet), facing right, or left when `flip`. */
const crow = (x: number, y: number, s: number, flip = false) => {
  const k = flip ? -s : s
  return `M${f(x - 14 * k)} ${f(y - 6 * s)} L${f(x - 26 * k)} ${f(y - 2 * s)} L${f(x - 12 * k)} ${f(y - 10 * s)} Q${f(x - 4 * k)} ${f(y - 20 * s)} ${f(x + 8 * k)} ${f(y - 19 * s)} Q${f(x + 12 * k)} ${f(y - 27 * s)} ${f(x + 17 * k)} ${f(y - 24 * s)} L${f(x + 25 * k)} ${f(y - 22 * s)} L${f(x + 17 * k)} ${f(y - 19 * s)} Q${f(x + 14 * k)} ${f(y - 9 * s)} ${f(x + 2 * k)} ${f(y - 4 * s)} L${f(x + 3 * k)} ${y} L${f(x + 1 * k)} ${y} L${f(x - 1 * k)} ${f(y - 4 * s)} Z`
}

const graveyard: Draw = (id) => {
  // An old churchyard: rows of stones running back up the hill, a gravel path from the gate to a small
  // mausoleum, a mourning statue, the chapel far up on the hill.
  const r = rng(21)
  const path = (y: number) => {
    // The path's half-width and centre at a height: narrow at the mausoleum, wide at the gate.
    const t = (y - 790) / 110
    return { c: 1080, w: 80 + t * 70 }
  }
  const row = (y0: number, n: number, scale: number, skipStatue: boolean) => {
    const out: ReactNode[] = []
    for (let i = 0; i < n; i++) {
      const x = -20 + (i + r()) * (1640 / n)
      const y = y0 + r() * 10
      const p = path(y)
      if (Math.abs(x - p.c) < p.w + 40 * scale) continue
      if (skipStatue && (Math.abs(x - 560) < 50 || Math.abs(x - 685) < 60 || Math.abs(x - 1330) < 55)) continue
      const h = (44 + r() * 46) * scale
      const tilt = (r() - 0.5) * 12
      const kind = r()
      const d = kind < 0.28 ? cross(x, y, h * 1.4) : kind < 0.36 ? `M${f(x - h * 0.16)} ${f(y)} L${f(x - h * 0.1)} ${f(y - h * 1.3)} L${f(x)} ${f(y - h * 1.45)} L${f(x + h * 0.1)} ${f(y - h * 1.3)} L${f(x + h * 0.16)} ${f(y)} Z` : stone(x, y, h * 0.62, h)
      out.push(<path key={i} d={d} transform={`rotate(${f(tilt)} ${f(x)} ${f(y)})`} />)
    }
    return out
  }
  const farStones = row(726, 34, 0.42, false)
  const midStones = row(792, 20, 0.9, true)
  return (
    <>
      <Layer depth="far">
        <Moon x={1250} y={168} r={50} id={id} />
        <path d={ridge(610, 40, 27, 30)} fill="var(--sil-haze)" />
        <path d={ridge(700, 42, 22)} />
        {/* the chapel up on the hill: a small nave and its bell tower, a lantern at the door */}
        <path d={`M296 704 V652 H366 V704 Z M290 656 L331 626 L372 656 Z M268 704 V622 H296 V704 Z M264 624 L282 572 L300 624 Z ${cross(282, 576, 22)}`} />
        <path d="M325 684 h10 v14 h-10 Z" fill="var(--lit)" className="scr-glow" opacity={0.8} />
        {farStones}
        <BareTree x={540} base={712} h={200} seed={23} />
        <BareTree x={1480} base={700} h={230} seed={24} />
      </Layer>
      <Layer depth="mid">
        <path d={ridge(796, 12, 25)} />
        {/* the gravel path, paler than the grass, from the gate up to the mausoleum */}
        <path d="M1010 800 H1150 L1240 904 H920 Z" fill="var(--sil-back)" opacity={0.75} />
        {midStones}
        {/* the mausoleum: steps, walls, pilasters, pediment, urns, a dark door */}
        <path d="M980 800 V788 H1180 V800 Z M992 788 V776 H1168 V788 Z M1004 776 V764 H1156 V776 Z" />
        <path d="M1014 766 V610 H1146 V766 Z M1000 612 H1160 V588 H1000 Z M994 590 L1080 532 L1166 590 Z" />
        <path d="M1072 534 a8 8 0 1 1 16 0 l4 10 h-24 Z M994 588 a6 6 0 1 1 12 0 l3 8 h-18 Z M1154 588 a6 6 0 1 1 12 0 l3 8 h-18 Z" />
        <path d="M1054 766 V698 A26 26 0 0 1 1106 698 V766 Z" fill="var(--sil-near)" />
        <path d="M1014 766 V612 h10 V766 Z M1136 766 V612 h10 V766 Z" fill="var(--sil-near)" opacity={0.5} />
        {/* a hooded mourner on a plinth, head bowed; two chest tombs */}
        <path d="M526 808 V772 H594 V808 Z M534 772 V760 H586 V772 Z M540 760 Q542 712 550 690 Q552 664 566 656 Q584 652 588 672 Q586 684 578 690 Q586 716 584 760 Z" />
        <path d="M640 812 V786 H730 V812 Z M634 788 H736 v-8 H634 Z M1290 812 V790 H1370 V812 Z M1284 792 H1376 v-8 H1284 Z" />
        <g className="scr-rim" strokeWidth={2}>
          <path d="M1080 532 L1166 590 M1146 612 V766 M1156 764 H1168 M1168 788 H1180 M588 672 Q586 684 578 690 Q586 716 584 760 M736 780 H634 M1376 784 H1284" />
        </g>
      </Layer>
      <Layer depth="lit">
        {/* a thread of light under the mausoleum door: something inside is awake */}
        <path d="M1056 762 h48 v3 h-48 Z M1079 676 v86 h2 v-86 Z" opacity={0.75} />
        <Halo id={`${id}-halo`} x={1080} y={764} r={70} o={0.5} />
      </Layer>
      <Layer depth="near">
        <BareTree x={200} base={904} h={740} seed={26} lean={0.1} />
        <path d={`${stone(1400, 908, 96, 176)} ${cross(1520, 908, 210)} ${stone(60, 910, 70, 120)} ${crow(1520, 908 - 210, 1.3, true)}`} />
        <Fence y={904} h={96} gateFrom={980} gateTo={1180} />
        <path d={crow(973, 904 - 96 - 56, 1.1)} />
        {/* a lantern on a bracket, on the right gate pillar */}
        <path d="M1202 780 h26 v3 h-26 Z M1219 783 h6 v4 h-6 Z M1214 792 h16 l-3 -6 h-10 Z M1214 816 h16 v5 h-16 Z M1215 792 h2 v24 h-2 Z M1227 792 h2 v24 h-2 Z" />
        <path d={grass(904, 28)} />
      </Layer>
      <Layer depth="pulse">
        <g className="scr-glow">
          <Halo id={`${id}-halo`} x={1222} y={804} r={150} />
          <path d="M1217 792 h10 v24 h-10 Z" />
        </g>
      </Layer>
    </>
  )
}

const crypt: Draw = (id) => {
  // A burial corridor in one-point perspective: vaulted bays, each one lighter as it nears the lit
  // doorway at the far end, burial niches in the side walls, a stone coffin in the foreground.
  const cx = 800
  const vy = 540
  const floor = (s: number) => vy + (920 - vy) * s
  const spring = (s: number) => floor(s) - 540 * s
  const hw = (s: number) => 520 * s // inner edge of a rib
  const ww = (s: number) => 590 * s // the wall behind the ribs
  const frames = [1, 0.6, 0.38, 0.25, 0.17]
  const back = 0.12
  const archBand = (s: number) => {
    const fl = floor(s)
    const sp = spring(s)
    return `M${f(cx - ww(s))} ${f(fl)} V${f(sp)} A${f(ww(s))} ${f(ww(s))} 0 0 1 ${f(cx + ww(s))} ${f(sp)} V${f(fl)} H${f(cx + hw(s))} V${f(sp)} A${f(hw(s))} ${f(hw(s))} 0 0 0 ${f(cx - hw(s))} ${f(sp)} V${f(fl)} Z`
  }
  // One bay (between two frames): both side walls and the vault, as one shape.
  const bay = (a: number, b: number) => {
    const L = (s: number) => cx - ww(s)
    const R = (s: number) => cx + ww(s)
    return `M${f(L(a))} ${f(floor(a))} V${f(spring(a))} A${f(ww(a))} ${f(ww(a))} 0 0 1 ${f(R(a))} ${f(spring(a))} V${f(floor(a))} L${f(R(b))} ${f(floor(b))} V${f(spring(b))} A${f(ww(b))} ${f(ww(b))} 0 0 0 ${f(L(b))} ${f(spring(b))} V${f(floor(b))} Z`
  }
  // Burial niches in the side walls of a bay: quads by interpolation along the wall (u: depth, v: height).
  const niches = (a: number, b: number, cols: number, shrouds = true) => {
    const holes: string[] = []
    const skulls: string[] = []
    const r = rng(Math.round(a * 1000))
    for (const side of [-1, 1]) {
      const at = (u: number, v: number) => {
        const s = a + (b - a) * u
        return [cx + side * ww(s), floor(s) + (spring(s) - floor(s)) * v]
      }
      for (let i = 0; i < cols; i++) {
        for (const [v1, v2] of [[0.1, 0.3], [0.4, 0.6], [0.7, 0.88]]) {
          const u1 = 0.12 + (i / cols) * 0.8
          const u2 = u1 + 0.5 / cols
          const p = [at(u1, v1), at(u2, v1), at(u2, v2), at(u1, v2)]
          holes.push(`M${p.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`)
          if (r() < 0.45 && shrouds) {
            // a shrouded shape lying in the niche
            const q = [at(u1 + 0.02, v1 + 0.02), at(u2 - 0.02, v1 + 0.02), at(u2 - 0.03, v1 + 0.08), at(u1 + 0.03, v1 + 0.09)]
            skulls.push(`M${q.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`)
          }
        }
      }
    }
    return { holes: holes.join(' '), skulls: skulls.join(' ') }
  }
  const nA = niches(1, 0.6, 2, false)
  const nB = niches(0.6, 0.38, 2)
  const nC = niches(0.38, 0.25, 1)
  const shades = ['var(--cr-1)', 'var(--cr-2)', 'var(--cr-3)', 'var(--cr-4)']
  // Steps up to the door, catching its light.
  const steps = Array.from({ length: 4 }, (_, i) => {
    const s = 0.17 - i * 0.012
    const y = floor(s) - i * 6
    return `M${f(cx - 46 + i * 2)} ${f(y)} h${f(92 - i * 4)} v2.5 h${f(-92 + i * 4)} Z`
  }).join(' ')
  const doorTop = floor(back) - 100
  const door = `M${cx - 40} ${f(floor(back))} V${f(doorTop + 40)} A40 40 0 0 1 ${cx + 40} ${f(doorTop + 40)} V${f(floor(back))} Z`
  return (
    <>
      <Layer depth="far">
        {/* the end wall and its doorway */}
        <path d={`M-80 -10 H${W + 80} V${H} H-80 Z`} fill="var(--cr-5)" />
        <path d={door} fill={`url(#${id}-glass)`} />
      </Layer>
      <Layer depth="mid">
        {/* the floor, then each bay, nearest first, lighter as it nears the door */}
        <path d={`M${f(cx - ww(1.2))} ${f(floor(1.2))} H${f(cx + ww(1.2))} L${f(cx + ww(back))} ${f(floor(back))} H${f(cx - ww(back))} Z`} fill="var(--cr-0)" />
        {frames.map((a, i) => (
          <path key={a} d={bay(i === 0 ? 1.25 : a, frames[i + 1] ?? back)} fill={shades[Math.min(i, 3)]} />
        ))}
        <path d={`${nA.holes} ${nB.holes} ${nC.holes}`} fill="var(--cr-0)" opacity={0.85} />
        <path d={`${nA.skulls} ${nB.skulls} ${nC.skulls}`} fill="var(--cr-3)" opacity={0.6} />
        {/* the ribs: darker, against the light behind them */}
        {frames.slice(1).map((s, i) => <path key={s} d={archBand(s)} fill={shades[Math.max(0, i - 1)]} />)}
        <path d={frames.slice(1).map((s) => `M${f(cx - ww(s) - 4 * s)} ${f(spring(s))} h${f(ww(s) - hw(s) + 8 * s)} v${f(14 * s)} h${f(-(ww(s) - hw(s) + 8 * s))} Z M${f(cx + hw(s) - 4 * s)} ${f(spring(s))} h${f(ww(s) - hw(s) + 8 * s)} v${f(14 * s)} h${f(-(ww(s) - hw(s) + 8 * s))} Z`).join(' ')} fill="var(--cr-0)" />
        <path d={steps} fill="var(--lit)" opacity={0.35} />
      </Layer>
      <Layer depth="lit">
        <Halo id={`${id}-halo`} x={cx} y={floor(back) - 50} r={260} o={0.75} />
        {/* the door's light running along the floor */}
        <path d={`M${cx - 40} ${f(floor(back))} H${cx + 40} L${cx + 260} 920 H${cx - 260} Z`} fill={`url(#${id}-ray)`} opacity={0.8} />
      </Layer>
      <Layer depth="near">
        {/* the nearest pillars, framing the view (their arch is above the screen) */}
        <path d={`M-80 -10 H${W + 80} V${H + 20} H-80 Z M${cx - hw(1)} 930 V${spring(1)} A${hw(1)} ${hw(1)} 0 0 1 ${cx + hw(1)} ${spring(1)} V930 Z`} fillRule="evenodd" />
        {/* courses of stone on the nearest pillars */}
        <path d={Array.from({ length: 16 }, (_, j) => `M-80 ${j * 58 + 20} H${cx - hw(1) - 2} v3 H-80 Z M${cx + hw(1) + 2} ${j * 58 + 20} H${W + 80} v3 H${cx + hw(1) + 2} Z ${Array.from({ length: 6 }, (_, i) => { const x = -60 + i * 64 + (j % 2) * 32; const xr = x + cx + hw(1) + 40; return `${x < cx - hw(1) - 6 ? `M${x} ${j * 58 + 23} v55 h3 v-55 Z` : ''} ${xr < W + 60 ? `M${xr} ${j * 58 + 23} v55 h3 v-55 Z` : ''}` }).join(' ')}`).join(' ')} fill="var(--cr-2)" opacity={0.18} />
        {/* a stone coffin: its end towards us, the gabled lid running back into the dark */}
        <path d="M690 930 V766 H910 V930 Z" />
        <path d="M676 770 L800 728 L924 770 Z" />
        <path d="M676 770 L800 728 L800 690 L701 723 Z" fill="var(--cr-2)" />
        <path d="M924 770 L800 728 L800 690 L899 723 Z" fill="var(--cr-1)" />
        <path d="M794 790 h12 v84 h-12 Z M772 812 h56 v12 h-56 Z" fill="var(--cr-1)" />
        {/* two iron candle stands */}
        <path d="M376 930 l22 -20 v-186 h-12 v-10 h44 v10 h-12 v186 l22 20 Z M1180 930 l22 -20 v-186 h-12 v-10 h44 v10 h-12 v186 l22 20 Z" />
      </Layer>
      <Layer depth="pulse">
        <Halo id={`${id}-halo`} x={408} y={690} r={200} />
        <Halo id={`${id}-halo`} x={1212} y={690} r={200} />
        <path d="M402 714 v-22 h12 v22 Z M1206 714 v-22 h12 v22 Z" className="scr-wax" />
        <path d="M408 692 q-7 -10 0 -24 q7 14 0 24 Z M1212 692 q-7 -10 0 -24 q7 14 0 24 Z" />
      </Layer>
    </>
  )
}

/** A bat in flight, wings spread, centred on x, y. */
const bat = (x: number, y: number, s: number) =>
  `M${f(x)} ${f(y - 3 * s)} Q${f(x - 8 * s)} ${f(y - 12 * s)} ${f(x - 22 * s)} ${f(y - 8 * s)} Q${f(x - 16 * s)} ${f(y - 4 * s)} ${f(x - 18 * s)} ${f(y + 2 * s)} Q${f(x - 10 * s)} ${f(y - 2 * s)} ${f(x - 6 * s)} ${f(y + 3 * s)} Q${f(x - 3 * s)} ${f(y)} ${f(x)} ${f(y + 4 * s)} Q${f(x + 3 * s)} ${f(y)} ${f(x + 6 * s)} ${f(y + 3 * s)} Q${f(x + 10 * s)} ${f(y - 2 * s)} ${f(x + 18 * s)} ${f(y + 2 * s)} Q${f(x + 16 * s)} ${f(y - 4 * s)} ${f(x + 22 * s)} ${f(y - 8 * s)} Q${f(x + 8 * s)} ${f(y - 12 * s)} ${f(x)} ${f(y - 3 * s)} Z`

/** A jagged outline through the given points, each segment broken into small random steps (rock). */
function jagged(points: Array<[number, number]>, seed: number, rough = 10): string {
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

const castle: Draw = (id) => {
  // A fortress on a crag above a valley: keep, round towers, a slender watchtower, the great hall,
  // a gatehouse reached by an arched bridge from the next outcrop. The moon is on the left.
  const roundTower = (x: number, w: number, base: number, top: number, roof: number) =>
    `M${x} ${base} V${top} H${x + w} V${base} Z M${x - 8} ${top + 4} L${x + w / 2} ${top - roof} L${x + w + 8} ${top + 4} Z M${x - 6} ${top + 6} h${w + 12} v-8 h${-w - 12} Z`
  const corbels = (x1: number, x2: number, y: number) => {
    let d = ''
    for (let x = x1; x < x2; x += 14) d += `M${x} ${y} h8 v10 h-8 Z `
    return d
  }
  const win = (x: number, y: number, w = 14, h = 26) => arched(x, y, w, h)
  return (
    <>
      <Layer depth="far">
        <Moon x={360} y={180} r={50} id={id} />
        <path d={ridge(520, 170, 37, 30)} fill="var(--sil-haze)" />
        <path d={ridge(640, 120, 31, 30)} />
        <path d={`${bat(1180, 190, 0.9)} ${bat(1240, 240, 0.7)} ${bat(1130, 260, 0.6)}`} />
      </Layer>
      <Layer depth="mid">
        {/* the crag, the outcrop on the left, and the bridge between them */}
        <path d={jagged([[560, 910], [610, 790], [660, 720], [690, 650], [720, 628], [1000, 640], [1290, 630], [1330, 660], [1380, 720], [1440, 790], [1530, 910]], 38, 14)} />
        <path d={jagged([[120, 910], [180, 800], [250, 742], [330, 716], [420, 712], [460, 760], [480, 910]], 39, 12)} />
        <path d={`M400 716 L700 650 v18 L400 734 Z ${[0, 1, 2].map((i) => { const x = 440 + i * 86; const y = 728 - i * 19; return `M${x} ${y} v${120 - i * 10} h16 v${-(120 - i * 10)} Z` }).join(' ')}`} />
        <path d="M410 734 L700 668 V700 Q660 690 640 720 Q620 700 586 730 Q566 712 532 750 Q512 732 478 770 Q460 750 420 790 Z" />
        {/* curtain wall with its walkway corbels and merlons */}
        <path d={`M700 640 V540 H1290 V640 Z ${merlons(700, 1290, 540, 14)} ${corbels(702, 1290, 548)}`} />
        {/* gatehouse */}
        <path d={`M720 640 V500 H808 V640 Z ${merlons(720, 808, 500, 11)}`} />
        {/* keep with its corner turrets */}
        <path d={`M860 600 V300 H1020 V600 Z ${merlons(860, 1020, 300, 14)} ${roundTower(842, 24, 330, 296, 44)} ${roundTower(1014, 24, 330, 296, 44)}`} />
        {/* slender watchtower and its pennant */}
        <path d={`${roundTower(1046, 46, 600, 220, 110)} M1068 112 v-40 h3 v40 Z M1071 74 l30 8 l-30 8 Z`} />
        {/* great hall, chimney */}
        <path d="M1100 600 V500 H1250 V600 Z M1092 504 L1175 448 L1258 504 Z M1210 476 V430 h16 v46 Z" />
        {/* round towers at the corners */}
        <path d={`${roundTower(668, 58, 660, 430, 96)} ${roundTower(1262, 58, 660, 460, 90)}`} />
        {/* faces turned from the moon */}
        <path d="M1000 600 V318 h20 V600 Z M1078 600 V226 h14 V600 Z M708 660 V436 h18 V660 Z M1302 660 V466 h18 V660 Z" fill="var(--sil-near)" opacity={0.4} />
        {/* the crag's faces: lit ledges turned to the moon, cracks in the rock */}
        <path d="M600 800 L640 760 L668 770 L630 820 Z M650 712 L686 660 L700 668 L672 724 Z M570 880 L600 830 L622 842 L596 900 Z M720 700 L760 660 L790 668 L750 716 Z M180 812 L240 752 L262 760 L210 822 Z M300 730 L360 718 L370 730 L320 748 Z" fill="var(--sil-back)" opacity={0.5} />
        <g fill="none" stroke="var(--sil-near)" strokeWidth={3} strokeLinejoin="round" opacity={0.6}>
          <path d="M820 660 L840 720 L828 780 L850 860 M1000 650 L990 700 L1012 760 M1180 650 L1200 700 L1190 760 L1220 840 M1330 690 L1310 740 L1340 800 M260 760 L280 820 L270 880" />
        </g>
        <g className="scr-rim" strokeWidth={2}>
          <path d="M660 434 L697 334 M1038 226 L1069 110 M1254 464 L1291 370 M834 300 L854 252 M1092 504 L1175 448" />
        </g>
      </Layer>
      <Layer depth="lit">
        <Halo id={`${id}-halo`} x={764} y={600} r={120} o={0.55} />
        <g fill={`url(#${id}-glass)`}>
          <path d={`${win(900, 360)} ${win(950, 420)} ${win(905, 500)} ${win(1062, 300, 12, 22)} ${win(1062, 420, 12, 22)} ${win(690, 500)} ${win(1284, 520)} ${win(1120, 530, 16, 34)} ${win(1150, 530, 16, 34)} ${win(1180, 530, 16, 34)}`} />
          {/* the gate, lit from within, its portcullis half raised */}
          <path d="M744 640 V600 A20 20 0 0 1 784 600 V640 Z" />
        </g>
        <path d="M744 640 V600 A20 20 0 0 1 784 600 V616 H744 Z M750 616 v24 h3 v-24 Z M760 616 v24 h3 v-24 Z M770 616 v24 h3 v-24 Z" fill="var(--sil-mid)" opacity={0.85} />
        <Halo id={`${id}-halo`} x={940} y={440} r={200} o={0.3} />
      </Layer>
      <Layer depth="near">
        <path d={ridge(884, 22, 32)} />
        <path d={grass(884, 35)} />
        <BareTree x={150} base={904} h={560} seed={33} lean={0.15} />
        <BareTree x={1500} base={904} h={380} seed={34} lean={-0.2} />
      </Layer>
    </>
  )
}

const manor: Draw = (id) => {
  // A Victorian mansion: mansard roof with dormers and iron cresting, a central tower with a bell-shaped
  // cap, a gabled wing with a bay window, a veranda on slim columns. One window upstairs has someone in it.
  const r = rng(41)
  const sash = (x: number, y: number, w: number, h: number) => `M${x} ${y} h${w} v${h} h${-w} Z`
  const upper = [560, 636, 712, 948, 1024, 1100].map((x) => sash(x, 600, 34, 66))
  const lower = [560, 636, 712, 948, 1024, 1100].map((x) => sash(x, 742, 34, 70))
  const tower = [arched(822, 372, 36, 60), arched(822, 476, 36, 66), arched(822, 590, 36, 66)]
  const dormers = [600, 690, 990, 1080]
  const lit = new Set([1, 4, 7, 9, 13, 16])
  const all = [...upper, ...lower, ...tower, ...dormers.map((x) => arched(x + 4, 500, 22, 34)), arched(420, 740, 22, 50), arched(452, 736, 26, 56)]
  const litD = all.filter((_, i) => lit.has(i)).join(' ')
  const darkD = all.filter((_, i) => !lit.has(i)).join(' ')
  const cresting = (x1: number, x2: number, y: number) => {
    let d = `M${x1} ${y} h${x2 - x1} v-3 h${x1 - x2} Z`
    for (let x = x1 + 4; x < x2; x += 12) d += ` M${x} ${y} v-12 l2 -4 l2 4 v12 Z`
    return d
  }
  // Pines on the far ridge, in uneven clumps.
  const pines: string[] = []
  for (let x = -30; x < W + 30; x += 18 + r() * 60) {
    if (r() < 0.25) continue
    pines.push(pine(x, 712 + r() * 14, 70 + r() * 70, 34 + r() * 16))
  }
  return (
    <>
      <Layer depth="far">
        <Moon x={1290} y={180} r={44} id={id} />
        <path d={ridge(640, 40, 46, 30)} fill="var(--sil-haze)" />
        <path d={ridge(716, 34, 42)} />
        <path d={pines.join(' ')} />
      </Layer>
      <Layer depth="mid">
        <path d={ridge(830, 10, 43)} />
        {/* the gabled wing and its bay window */}
        <path d="M370 836 V640 H530 V836 Z M358 644 L450 560 L542 644 Z M404 836 V712 L416 700 H484 L496 712 V836 Z M400 712 L420 690 H480 L500 712 Z" />
        {/* main block and mansard roof with its dormers and cresting */}
        <path d={`M520 836 V566 H1180 V836 Z M508 570 L530 478 H1170 L1192 570 Z ${cresting(530, 1170, 478)}`} />
        <path d={dormers.map((x) => `M${x} 544 V500 L${x + 15} 482 L${x + 30} 500 V544 Z`).join(' ')} />
        {/* chimneys */}
        <path d="M590 482 V404 h46 v78 Z M584 408 h58 v-10 h-58 Z M596 398 v-10 h10 v10 Z M618 398 v-14 h10 v14 Z M1076 482 V396 h46 v86 Z M1070 400 h58 v-10 h-58 Z M1082 390 v-12 h10 v12 Z M1104 390 v-10 h10 v10 Z" />
        {/* the tower, its bell-shaped cap and finial */}
        <path d={`M786 836 V350 H894 V836 Z M776 354 H904 v-12 H776 Z M780 344 Q808 320 816 270 H864 Q872 320 900 344 Z ${cresting(816, 864, 270)} M838 270 V214 l2 -8 l2 8 V270 Z`} />
        <circle cx={840} cy={240} r={5} />
        <path d="M818 330 v-26 a6 6 0 0 1 12 0 v26 Z M850 330 v-26 a6 6 0 0 1 12 0 v26 Z" fill="var(--sil-near)" opacity={0.6} />
        {/* the veranda: roof, slim columns, railing, steps to the door */}
        <path d="M540 716 L556 700 H1144 L1160 716 Z M546 716 H1154 v8 H546 Z" />
        <path d={`${Array.from({ length: 11 }, (_, i) => `M${556 + i * 58} 724 h8 v108 h-8 Z`).join(' ')} M546 796 H788 v6 H546 Z M892 796 H1154 v6 H892 Z ${Array.from({ length: 34 }, (_, i) => { const x = 552 + i * 18; return x > 780 && x < 900 ? '' : `M${x} 802 h3 v30 h-3 Z` }).join(' ')}`} />
        <path d="M800 836 V826 H880 V836 Z M808 826 V816 H872 V826 Z" />
        {/* window panes, dark */}
        <path d={darkD} fill="var(--sil-near)" opacity={0.55} />
        <g className="scr-rim" strokeWidth={2}>
          <path d="M1170 478 L1192 570 M864 270 Q872 320 900 344 M450 560 L542 644 M530 478 H1170 M1122 396 V482" />
        </g>
      </Layer>
      <Layer depth="lit">
        <Halo id={`${id}-halo`} x={840} y={780} r={170} o={0.65} />
        <path d={litD} fill={`url(#${id}-glass)`} />
        {/* the front door, open */}
        <path d="M818 816 V748 A22 22 0 0 1 862 748 V816 Z" fill={`url(#${id}-glass)`} />
        {/* sash bars over the lit panes */}
        <path d={[...upper, ...lower].filter((_, i) => lit.has(i)).map((d) => { const [x, y] = d.slice(1).split(' ').map(Number); return `M${x + 16} ${y} v${70} M${x} ${y + 30} h34` }).join(' ')} stroke="var(--sil-mid)" strokeWidth={3} fill="none" />
        {/* someone standing at the window upstairs */}
        <path d="M641 666 V650 Q641 640 650 637 Q646 632 646 627 A7 7 0 0 1 660 627 Q660 632 656 637 Q665 640 665 650 V666 Z" fill="var(--sil-mid)" opacity={0.9} />
        <path d="M800 836 H880 L940 900 H740 Z" fill={`url(#${id}-ray)`} />
      </Layer>
      <Layer depth="near">
        {/* clipped hedges, the drive and the gate */}
        <path d={`${Array.from({ length: 9 }, (_, i) => `M${-40 + i * 80} 900 a${44 + (i % 3) * 8} ${34 + (i % 2) * 10} 0 0 1 ${96} 0 Z`).join(' ')} ${Array.from({ length: 8 }, (_, i) => `M${980 + i * 80} 900 a${44 + (i % 3) * 8} ${34 + (i % 2) * 10} 0 0 1 ${96} 0 Z`).join(' ')}`} />
        <BareTree x={1420} base={904} h={640} seed={44} lean={-0.12} />
        <Fence y={904} h={84} gateFrom={760} gateTo={920} />
        <path d={grass(904, 47)} />
      </Layer>
      <Layer depth="pulse">
        <g className="scr-glow">
          <Halo id={`${id}-halo`} x={884} y={760} r={90} />
          <path d="M880 756 h8 v12 h-8 Z" />
        </g>
      </Layer>
    </>
  )
}

const library: Draw = (id) => {
  // A private library at night: two walls of books in tall cases, a traceried window with the moon in it
  // and its light falling across the floor, a desk with a shaded lamp and an open book, a wing chair and
  // a globe in the foreground.
  const r = rng(51)
  const tones: string[][] = [[], [], []]
  const gilt: string[] = []
  const shelves: string[] = []
  const fill = (x1: number, x2: number, top: number, bottom: number, step: number) => {
    for (let y = top; y + step <= bottom + 1; y += step) {
      const base = y + step - 10
      shelves.push(`M${x1 - 12} ${base} H${x2 + 12} v12 H${x1 - 12} Z`)
      let x = x1
      while (x < x2 - 10) {
        const w = 9 + r() * 15
        const h = step * (0.55 + r() * 0.33)
        const roll = r()
        if (roll < 0.05) {
          x += w * 2.5
          continue
        }
        if (roll < 0.1 && x + 70 < x2) {
          // a pile lying flat
          for (let k = 0; k < 3 + Math.floor(r() * 3); k++) tones[Math.floor(r() * 3)].push(`M${f(x + r() * 6)} ${f(base - (k + 1) * 9)} h${f(56 + r() * 10)} v8 h${f(-60)} Z`)
          x += 74
          continue
        }
        if (roll < 0.14) {
          // one leaning on its neighbour
          tones[Math.floor(r() * 3)].push(`M${f(x)} ${f(base)} l${f(h * 0.3)} ${f(-h)} l${f(w - 2)} 2 l${f(-h * 0.3)} ${f(h - 2)} Z`)
          x += w + h * 0.3
          continue
        }
        tones[Math.floor(r() * 3)].push(`M${f(x)} ${f(base)} v${f(-h)} h${f(w - 2)} v${f(h)} Z`)
        if (r() < 0.3) gilt.push(`M${f(x + 1)} ${f(base - h + 6)} h${f(w - 4)} v2 h${f(-(w - 4))} Z M${f(x + 1)} ${f(base - 10)} h${f(w - 4)} v2 h${f(-(w - 4))} Z`)
        x += w
      }
    }
  }
  fill(30, 580, 70, 870, 114)
  fill(1020, 1570, 70, 870, 114)
  fill(640, 960, 668, 870, 101)
  const win = `M690 618 V250 A110 110 0 0 1 910 250 V618 Z`
  return (
    <>
      <Layer depth="far">
        {/* the night outside the window, then the wall around it */}
        <Moon x={800} y={196} r={34} id={id} />
        <path d={`M-80 -10 H${W + 80} V${H} H-80 Z ${win}`} fillRule="evenodd" />
        {/* the window's stone mullions, transoms and the tracery in its arch */}
        <g fill="none" stroke="currentColor" strokeWidth={9}>
          <path d="M763 618 V250 M837 618 V250 M690 400 H910 M690 520 H910 M690 250 H910" />
        </g>
        <path d="M676 630 H924 v-14 H676 Z" />
      </Layer>
      <Layer depth="mid">
        {/* the cases: cornice, plinth, uprights between the bays */}
        <path d="M0 0 H600 V900 H0 Z M1000 0 H1600 V900 H1000 Z M620 650 H980 V900 H620 Z" fill="var(--sil-near)" />
        <path d={tones[0].join(' ')} className="scr-books" />
        <path d={tones[1].join(' ')} className="scr-books scr-books-dark" />
        <path d={tones[2].join(' ')} className="scr-books scr-books-pale" />
        <path d={gilt.join(' ')} fill="var(--lit)" opacity={0.35} />
        <path d={shelves.join(' ')} />
        <path d="M-20 0 H620 V46 H-20 Z M-20 46 H624 v10 H-20 Z M980 0 H1620 V46 H980 Z M976 46 H1620 v10 H976 Z M610 640 H990 v14 H610 Z M196 56 v820 h16 v-820 Z M392 56 v820 h16 v-820 Z M1188 56 v820 h16 v-820 Z M1388 56 v820 h16 v-820 Z M576 0 h28 v900 h-28 Z M996 0 h28 v900 h-28 Z" />
        <path d="M-20 870 H1620 V900 H-20 Z" />
      </Layer>
      {/* moonlight (or sunlight) through the window, across the floor */}
      <Layer depth="lit">
        <g className="scr-moon">
          <path d="M690 250 L910 250 L900 900 L450 900 Z" fill={`url(#${id}-shaft)`} opacity={0.3} />
        </g>
      </Layer>
      <Layer depth="near">
        {/* the rolling ladder on the left case */}
        <path d="M430 900 L520 40 h14 L444 900 Z M512 900 L600 40 h14 L526 900 Z" />
        <path d={Array.from({ length: 13 }, (_, i) => { const y = 860 - i * 64; const k = (900 - y) / 860; return `M${f(437 + 88 * k)} ${y} h${f(82)} v8 h${f(-82)} Z` }).join(' ')} />
        {/* the desk, its drawers, a pile of books, an open book, the shaded lamp */}
        <path d="M560 900 V786 H1090 V900 Z M540 790 H1110 v-18 H540 Z" />
        <path d="M600 840 h120 v6 h-120 Z M930 840 h120 v6 h-120 Z" fill="var(--sil-mid)" />
        <path d="M600 772 h110 v-18 h-110 Z M608 754 h96 v-16 h-96 Z M614 738 h84 v-15 h-84 Z" />
        <path d="M748 772 L752 760 Q790 750 826 762 L830 772 Z M826 772 L830 762 Q866 750 904 760 L908 772 Z" className="scr-books scr-books-pale" />
        <path d="M972 772 h56 v-8 h-22 v-62 h-12 v62 h-22 Z" />
        <path d="M950 704 Q950 676 1000 672 Q1050 676 1050 704 Z" />
        {/* a wing chair, its back to us */}
        <path d="M120 900 V700 Q120 640 170 630 Q230 600 290 630 Q340 640 340 700 V900 Z M96 900 V760 Q96 728 124 726 V900 Z M336 900 V726 Q364 728 364 760 V900 Z" />
        {/* a globe on its stand */}
        <circle cx={1330} cy={700} r={74} />
        <path d="M1320 900 l10 -60 l10 60 Z M1270 900 l56 -116 h8 l-48 116 Z M1390 900 l-56 -116 h-8 l48 116 Z M1324 784 h12 v-10 h-12 Z" />
        <path d="M1240 700 A90 90 0 0 1 1420 700" fill="none" stroke="currentColor" strokeWidth={8} />
      </Layer>
      <Layer depth="pulse">
        <Halo id={`${id}-halo`} x={1000} y={720} r={320} />
        <path d="M954 704 h92 v5 h-92 Z" />
        <path d="M748 772 L752 760 Q790 750 826 762 L830 772 Z M826 772 L830 762 Q866 750 904 760 L908 772 Z" opacity={0.35} />
      </Layer>
    </>
  )
}

const police: Draw = (id) => {
  const r = rng(61)
  let sky = ''
  let skyLit = ''
  for (let x = -40; x < W + 40; ) {
    const w = 70 + r() * 110
    const h = 260 + r() * 300
    sky += `M${f(x)} ${H} V${f(H - h)} H${f(x + w)} V${H} Z `
    for (let k = 0; k < 4; k++) if (r() < 0.6) skyLit += `M${f(x + 12 + r() * (w - 30))} ${f(H - h + 20 + r() * (h - 120))} h6 v9 h-6 Z `
    x += w + 4
  }
  const win = windowGrid(470, 420, 6, 2, 50, 76, 112, 120, 62, 0.45)
  return (
    <>
      <Layer depth="far">
        <path d={sky} />
        <path d={skyLit} fill="var(--lit)" opacity={0.3} />
      </Layer>
      <Layer depth="mid">
        {/* the station: cornice, parapet, steps */}
        <path d="M420 860 V330 H1180 V860 Z M400 336 H1200 V306 H400 Z M440 306 V284 H1160 V306 Z" />
        <path d="M600 880 V860 H1000 V880 Z M620 860 V842 H980 V860 Z M640 842 V824 H960 V842 Z" />
        <path d={win.dark} fill="var(--sil-near)" opacity={0.6} />
        <path d="M690 880 v-180 h8 v180 Z M902 880 v-180 h8 v180 Z" />
      </Layer>
      <Layer depth="lit">
        <path d={win.lit} opacity={0.75} />
        <path d="M740 824 V690 H860 V824 Z" opacity={0.7} />
        <text x="800" y="664" textAnchor="middle" fontSize="40" letterSpacing="10" fontFamily="'Josefin Sans', 'IBM Plex Sans Condensed', sans-serif" fontWeight="700">POLICE</text>
        <Halo id={`${id}-halo`} x={694} y={690} r={110} />
        <Halo id={`${id}-halo`} x={906} y={690} r={110} />
        <circle cx={694} cy={690} r={16} />
        <circle cx={906} cy={690} r={16} />
        <Halo id={`${id}-halo`} x={1352} y={548} r={220} />
        <path d="M1336 540 h32 l-6 22 h-20 Z" />
      </Layer>
      <Layer depth="near">
        {/* the curb, a street lamp, an old car */}
        <path d="M-40 900 V872 H1640 V900 Z" />
        <path d="M1344 900 V560 h16 V900 Z M1330 900 l14 -30 h16 l14 30 Z M1330 540 h44 l-8 -14 h-28 Z M1350 526 v-12 h4 v12 Z" />
        <path
          fillRule="evenodd"
          d="M96 866 V822 Q100 796 134 792 L226 788 L256 716 Q262 706 276 706 H412 Q424 706 430 716 L462 788 H530 Q556 792 560 822 V866 Z M276 780 L296 724 H340 V780 Z M352 780 V724 H408 L428 780 Z"
        />
        <path d="M120 820 H170 V804 H120 Z M548 800 h14 v20 h-14 Z" opacity={0.5} />
        <circle cx="196" cy="866" r="38" />
        <circle cx="468" cy="866" r="38" />
      </Layer>
    </>
  )
}

const forest: Draw = () => {
  const r = rng(71)
  const far: string[] = []
  for (let x = -20; x < W + 20; x += 22 + r() * 18) far.push(pine(x, 660 + r() * 30, 120 + r() * 90, 46 + r() * 20))
  const mid: string[] = []
  for (let x = -20; x < W + 40; x += 70 + r() * 60) mid.push(pine(x, 810 + r() * 30, 280 + r() * 200, 110 + r() * 50))
  return (
    <>
      <Layer depth="far">
        <path d={ridge(680, 30, 72)} />
        <path d={far.join(' ')} />
      </Layer>
      <Layer depth="mid">
        <path d={ridge(830, 16, 73)} />
        <path d={mid.join(' ')} />
      </Layer>
      <Layer depth="near">
        <path d={ridge(880, 22, 74)} />
        {/* two great trunks framing the view, a low branch, undergrowth */}
        <path d="M40 900 C70 600 60 300 90 -10 H210 C190 300 200 620 250 900 Z" />
        <path d="M1420 900 C1460 640 1440 300 1470 -10 H1580 C1570 300 1590 640 1640 900 Z" />
        <BareTree x={1470} base={260} h={260} seed={75} lean={-1.1} />
        <path d={Array.from({ length: 9 }, (_, i) => `M${260 + i * 130} 905 a${50 + (i % 3) * 20} ${30 + (i % 2) * 15} 0 0 1 ${120} 0 Z`).join(' ')} />
      </Layer>
    </>
  )
}

const harbour: Draw = (id) => {
  const r = rng(81)
  let ripples = ''
  for (let i = 0; i < 70; i++) {
    const y = 680 + r() ** 1.6 * 210
    ripples += `M${f(r() * W)} ${f(y)} h${f(20 + r() * 70 * (y / 900))} v1.6 h${f(-(20 + r() * 70))} Z `
  }
  const boat = (x: number, s: number) =>
    `M${x - 90 * s} ${760} Q${x - 80 * s} ${790} ${x - 50 * s} ${798} H${x + 70 * s} Q${x + 95 * s} ${780} ${x + 100 * s} ${752} Z ` +
    `M${x - 30 * s} 760 v${-40 * s} h${60 * s} v${40 * s} Z M${x - 4 * s} ${720 * 1} v${-160 * s} h${6 * s} v${160 * s} Z ` +
    `M${x + 2 * s} ${720 - 150 * s} L${x + 80 * s} ${740} L${x + 2 * s} ${740} Z`
  return (
    <>
      <Layer depth="far">
        <path d={ridge(660, 14, 82)} />
        <path d="M1120 900 L1180 660 Q1300 600 1460 610 L1640 620 V900 Z" />
        {/* the lighthouse */}
        <path d="M1356 620 L1366 430 H1398 L1408 620 Z M1350 432 h64 v-12 h-64 Z M1366 420 v-30 h32 v30 Z M1360 392 L1382 366 L1404 392 Z" />
        <rect x="-40" y="690" width={W + 80} height="260" fill="var(--sil-water)" />
      </Layer>
      <Layer depth="water">
        <path d={ripples} fill="var(--lit)" opacity={0.22} />
      </Layer>
      <Layer depth="pulse">
        <path d="M1382 405 L740 330 L740 470 Z" fill={`url(#${id}-beam)`} transform="scale(-1 1) translate(-2764 0)" />
        <path d="M1382 405 L740 330 L740 470 Z" fill={`url(#${id}-beam)`} />
        <Halo id={`${id}-halo`} x={1382} y={405} r={120} />
        <circle cx={1382} cy={405} r={9} />
      </Layer>
      <Layer depth="mid">
        {/* warehouses, the pier, two boats */}
        <path d="M-40 780 V470 L60 400 L160 470 V780 Z M150 780 V440 L280 360 L410 440 V780 Z M400 780 V500 L470 450 L540 500 V780 Z" />
        <path d="M520 772 H1120 v14 H520 Z" />
        <path d={Array.from({ length: 11 }, (_, i) => `M${540 + i * 56} 900 V772 h12 V900 Z`).join(' ')} />
        <path d={`${boat(760, 1)} ${boat(1010, 0.8)}`} />
      </Layer>
      <Layer depth="lit">
        <path d="M30 600 h26 v40 h-26 Z M210 560 h30 v44 h-30 Z M300 640 h30 v44 h-30 Z M455 560 h24 v36 h-24 Z" opacity={0.8} />
        <Halo id={`${id}-halo`} x={1520} y={556} r={200} />
        <path d="M1506 548 h28 l-6 20 h-16 Z" />
      </Layer>
      <Layer depth="near">
        <path d="M1514 900 V566 h12 V900 Z M1506 548 h28 l-6 -12 h-16 Z" />
        <path d="M60 900 V820 q30 -14 60 0 V900 Z M210 900 V840 q24 -10 48 0 V900 Z" />
        <path d="M300 900 V830 H420 V900 Z M330 830 V790 H420 V830 Z" />
      </Layer>
    </>
  )
}

const street: Draw = (id) => {
  const r = rng(91)
  const houses: string[] = []
  const chimneys: string[] = []
  const lit: string[] = []
  const dark: string[] = []
  for (let x = -60; x < W + 60; ) {
    const w = 170 + r() * 90
    const top = 260 + r() * 220
    const gable = r() < 0.5
    houses.push(gable ? `M${f(x)} 820 V${f(top)} L${f(x + w / 2)} ${f(top - 80)} L${f(x + w)} ${f(top)} V820 Z` : `M${f(x)} 820 V${f(top)} H${f(x + w)} V820 Z M${f(x - 6)} ${f(top + 4)} H${f(x + w + 6)} v-14 H${f(x - 6)} Z`)
    chimneys.push(`M${f(x + w * 0.7)} ${f(top - (gable ? 60 : 0))} v-50 h22 v50 Z`)
    const cols = Math.max(2, Math.floor(w / 60))
    const gx = w / cols
    for (let y = top + 40; y < 700; y += 90) {
      for (let i = 0; i < cols; i++) (r() < 0.32 ? lit : dark).push(`M${f(x + i * gx + gx / 2 - 14)} ${f(y)} h28 v48 h-28 Z`)
    }
    x += w + 8
  }
  return (
    <>
      <Layer depth="far">
        <path d={ridge(560, 30, 92)} />
        <path d={`M1180 600 V260 h40 V600 Z M1172 264 L1200 120 L1228 264 Z ${cross(1200, 124, 40)}`} />
      </Layer>
      <Layer depth="mid">
        <path d={`${houses.join(' ')} ${chimneys.join(' ')}`} />
        <path d={dark.join(' ')} fill="var(--sil-near)" opacity={0.55} />
      </Layer>
      <Layer depth="lit">
        <path d={lit.join(' ')} opacity={0.8} />
        {/* lamps and their reflections on the wet street */}
        {[300, 1250].map((x) => (
          <g key={x}>
            <Halo id={`${id}-halo`} x={x} y={560} r={210} />
            <path d={`M${x - 16} 552 h32 l-6 24 h-20 Z`} />
            <ellipse cx={x} cy={880} rx={30} ry={70} fill={`url(#${id}-halo)`} />
          </g>
        ))}
      </Layer>
      <Layer depth="near">
        <path d="M-40 900 V834 H1640 V900 Z" />
        {[300, 1250].map((x) => <path key={x} d={`M${x - 6} 834 V576 h12 V834 Z M${x - 18} 834 l12 -30 h12 l12 30 Z M${x - 18} 552 h36 l-8 -14 h-20 Z M${x - 2} 538 v-10 h4 v10 Z`} />)}
      </Layer>
    </>
  )
}

const DRAW: Record<PlaceId, Draw> = { church, graveyard, crypt, castle, manor, library, police, forest, harbour, street }

/** A place, drawn over the generated sky. */
export function Place({ place }: { place: PlaceId }) {
  const id = `pl${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <div className="scr-fill scr-place" data-place={place}>
      <Defs id={id} />
      {DRAW[place](id)}
    </div>
  )
}
