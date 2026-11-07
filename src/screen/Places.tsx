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

// A light goes in the lit layer of its shape's depth (`lit-far`, `lit` = mid, `lit-near`): layers of
// different depths drift apart, so a lamp's glass drawn at another depth than its post slides off it.
type Depth = 'far' | 'mid' | 'near' | 'lit' | 'lit-far' | 'lit-near' | 'pulse' | 'water'

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

/** The height of a ridge (see `ridge`) at x: to plant trees and stones on the ground, not above it. */
function ridgeAt(base: number, amp: number, seed: number): (x: number) => number {
  const r = rng(seed)
  const p = [r() * 6, r() * 6, r() * 6]
  return (x) => base - amp * (0.5 * Math.sin(x / 260 + p[0]) + 0.3 * Math.sin(x / 97 + p[1]) + 0.2 * Math.sin(x / 41 + p[2]))
}

/** Rolling ground or hills: a filled ridge line around `base`. */
function ridge(base: number, amp: number, seed: number, step = 20): string {
  const y = ridgeAt(base, amp, seed)
  let d = `M-40 ${H} L-40 ${f(y(-40))}`
  for (let x = -40; x <= W + 40; x += step) d += ` L${x} ${f(y(x))}`
  return `${d} L${W + 40} ${H} Z`
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

type Box = [x1: number, y1: number, x2: number, y2: number]

/** Windows on a grid, some lit (seeded): `lit` gets the lit ones, `dark` the rest. No window where it
 *  would overlap one of the `hidden` boxes (a porch in front of the wall). */
function windowGrid(x: number, y: number, cols: number, rows: number, w: number, h: number, gx: number, gy: number, seed: number, chance: number, hidden: Box[] = []) {
  const r = rng(seed)
  const lit: string[] = []
  const dark: string[] = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const wx = x + i * gx
      const wy = y + j * gy
      const isLit = r() < chance
      if (hidden.some(([x1, y1, x2, y2]) => wx < x2 && wx + w > x1 && wy < y2 && wy + h > y1)) continue
      ;(isLit ? lit : dark).push(`M${wx} ${wy} h${w} v${h} h${-w} Z`)
    }
  }
  return { lit: lit.join(' '), dark: dark.join(' ') }
}

/** The moon at night and dusk, the sun by day (screen.css shows one, or neither under a grey sky). */
const Moon = ({ x, y, r, id }: { x: number; y: number; r: number; id: string }) => (
  <>
    <g className="scr-moon">
      <circle cx={x} cy={y} r={r * 4} fill={`url(#${id}-moon)`} />
      <circle cx={x} cy={y} r={r} />
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
          <stop offset="0" stopColor="var(--moon)" stopOpacity="0.35" />
          <stop offset="0.3" stopColor="var(--moon)" stopOpacity="0.08" />
          <stop offset="1" stopColor="var(--moon)" stopOpacity="0" />
        </radialGradient>
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
  const nave = [760, 860, 960, 1060].map((x) => gothic(x, 650, 44, 120)).join(' ')
  return (
    <>
      <Layer depth="far">
        <Moon x={1250} y={190} r={46} id={id} />
        <path d={ridge(650, 55, 11)} />
      </Layer>
      <Layer depth="mid">
        {/* tower and spire (walls go down to the bottom: the ground is a wavy line, it must not show a gap under them) */}
        <path d={`M560 900 V380 H700 V900 Z M548 384 L630 112 L712 384 Z ${cross(630, 120, 64)}`} />
        <path d={`M548 384 h164 v-14 h-164 Z`} />
        {/* nave, its roof, buttresses and the apse */}
        <path d="M700 900 V560 H1180 V900 Z M688 566 L940 420 L1192 566 Z" />
        <path d="M735 900 v-290 h16 v290 Z M835 900 v-290 h16 v290 Z M935 900 v-290 h16 v290 Z M1035 900 v-290 h16 v290 Z M1135 900 v-290 h16 v290 Z" />
        <path d="M1180 900 V620 Q1290 620 1290 740 V900 Z" />
        <path d={ridge(866, 8, 12)} />
      </Layer>
      <Layer depth="lit">
        <Halo id={`${id}-halo`} x={630} y={800} r={160} o={0.7} />
        <path d={`${nave} ${gothic(608, 470, 44, 50)} ${arched(603, 760, 54, 100)}`} opacity={0.85} />
      </Layer>
      <Layer depth="near">
        <path d={`${stone(120, 900, 60, 120)} ${cross(230, 900, 150)} ${stone(330, 900, 46, 80)} ${stone(1290, 900, 54, 100)} ${cross(1190, 900, 110)}`} />
        <BareTree x={1440} base={900} h={620} seed={13} lean={-0.08} />
        <path d={ridge(890, 10, 14)} />
      </Layer>
    </>
  )
}

const graveyard: Draw = (id) => {
  const r = rng(21)
  const ground = ridgeAt(790, 14, 25)
  const stones: ReactNode[] = []
  for (let i = 0; i < 26; i++) {
    const x = 60 + i * 60 + (r() - 0.5) * 30
    if (x > 980 && x < 1180) continue
    // Set into the ground (a tilted stone lifts a corner: sink it a little more).
    const y = ground(x) + 8 + r() * 14
    const h = 50 + r() * 50
    const tilt = (r() - 0.5) * 14
    const d = r() < 0.3 ? cross(x, y, h * 1.4) : stone(x, y, h * 0.6, h)
    stones.push(<path key={i} d={d} transform={`rotate(${f(tilt)} ${f(x)} ${f(y)})`} />)
  }
  return (
    <>
      <Layer depth="far">
        <Moon x={1150} y={170} r={52} id={id} />
        <path d={ridge(620, 45, 22)} />
        {/* a chapel on the hill */}
        <path d={`M300 900 V540 H380 V900 Z M292 544 L340 506 L388 544 Z M332 506 V470 h16 v36 Z ${cross(340, 474, 30)}`} />
        <BareTree x={520} base={700} h={200} seed={23} />
        <BareTree x={1420} base={700} h={230} seed={24} />
      </Layer>
      <Layer depth="mid">
        <path d={ridge(790, 14, 25)} />
        {stones}
        {/* the mausoleum */}
        <path d="M1000 830 V630 H1160 V830 Z M985 636 L1080 570 L1175 636 Z M990 640 h180 v-10 h-180 Z" />
        <path d="M1015 830 v-190 h14 v190 Z M1131 830 v-190 h14 v190 Z" />
      </Layer>
      <Layer depth="near">
        <BareTree x={220} base={900} h={720} seed={26} lean={0.1} />
        <path d={`${stone(1380, 905, 90, 170)} ${cross(1500, 905, 200)}`} />
        <Fence y={900} h={130} gateFrom={700} gateTo={900} />
      </Layer>
    </>
  )
}

const crypt: Draw = (id) => {
  // Vaults: a solid wall pierced by round arches between columns (even-odd fill).
  // A bay right in the middle, so the lit doorway shows through it.
  const cols = [-225, 165, 555, 945, 1335, 1725]
  let vault = `M-80 -10 H${W + 80} V${H} H-80 Z`
  for (let i = 0; i < cols.length - 1; i++) {
    const x1 = cols[i] + 100
    const x2 = cols[i + 1]
    const w = x2 - x1
    vault += ` M${x1} ${H} V420 A${w / 2} ${w / 2} 0 0 1 ${x2} 420 V${H} Z`
  }
  return (
    <>
      <Layer depth="far">
        {/* back wall, a lit doorway at the top of the stairs */}
        <path d={`M-80 -10 H${W + 80} V${H} H-80 Z M736 640 V440 A64 64 0 0 1 864 440 V640 Z`} fillRule="evenodd" />
        <path d="M700 900 L736 640 H864 L900 900 Z" opacity={0.6} />
      </Layer>
      <Layer depth="lit-far">
        <path d="M736 640 V440 A64 64 0 0 1 864 440 V640 Z" opacity={0.5} />
        <Halo id={`${id}-halo`} x={800} y={560} r={170} o={0.6} />
        <path d="M770 650 h60 v8 h-60 Z M762 680 h76 v8 h-76 Z M752 715 h96 v9 h-96 Z M740 760 h120 v10 h-120 Z M726 815 h148 v11 h-148 Z" opacity={0.2} />
      </Layer>
      <Layer depth="mid">
        <path d={vault} fillRule="evenodd" />
        {/* ribs and capitals */}
        <path d={cols.map((x) => `M${x - 14} 430 h128 v22 h-128 Z`).join(' ')} />
      </Layer>
      <Layer depth="near">
        {/* the sarcophagus and two candle stands */}
        <path d="M610 900 V740 H990 V900 Z M590 744 L630 700 H970 L1010 744 Z" />
        <path d="M470 900 l20 -16 v-170 h-12 v-10 h40 v10 h-12 v170 l20 16 Z M1110 900 l20 -16 v-170 h-12 v-10 h40 v10 h-12 v170 l20 16 Z" />
        <path d="M-40 900 V-10 H90 V900 Z M1510 900 V-10 H1640 V900 Z" />
      </Layer>
      <Layer depth="pulse">
        {/* candles centred on the stands' dishes (x 498 and 1138) */}
        <Halo id={`${id}-halo`} x={498} y={674} r={180} />
        <Halo id={`${id}-halo`} x={1138} y={674} r={180} />
        <path d="M492 704 v-22 h12 v22 Z M1132 704 v-22 h12 v22 Z" className="scr-wax" />
        <path d="M498 682 q-7 -10 0 -24 q7 14 0 24 Z M1138 682 q-7 -10 0 -24 q7 14 0 24 Z" />
      </Layer>
    </>
  )
}

const castle: Draw = (id) => {
  const tower = (x: number, top: number, w: number, roof: number) =>
    `M${x} 700 V${top} H${x + w} V700 Z M${x - 10} ${top + 2} L${x + w / 2} ${top - roof} L${x + w + 10} ${top + 2} Z`
  return (
    <>
      <Layer depth="far">
        <Moon x={360} y={180} r={50} id={id} />
        <path d={ridge(560, 150, 31, 30)} />
      </Layer>
      <Layer depth="mid">
        {/* the crag */}
        <path d="M380 900 L520 700 L600 690 L640 640 L1160 640 L1210 680 L1290 690 L1420 900 Z" />
        {/* curtain wall, keep and towers */}
        <path d={`M640 660 V520 H1170 V660 Z ${merlons(640, 1170, 520, 18)}`} />
        <path d={`M820 560 V300 H980 V560 Z ${merlons(820, 980, 300, 20)}`} />
        <path d={`${tower(600, 430, 76, 120)} ${tower(1150, 450, 76, 110)} ${tower(1010, 250, 52, 110)}`} />
      </Layer>
      <Layer depth="lit">
        <path d={`${arched(860, 360, 18, 34)} ${arched(925, 420, 18, 34)} ${arched(1028, 300, 16, 30)} ${arched(628, 480, 16, 28)} ${arched(895, 470, 16, 28)}`} opacity={0.9} />
        <Halo id={`${id}-halo`} x={900} y={420} r={150} o={0.45} />
      </Layer>
      <Layer depth="near">
        <path d={ridge(880, 26, 32)} />
        <BareTree x={150} base={900} h={560} seed={33} lean={0.15} />
        <BareTree x={1480} base={900} h={360} seed={34} lean={-0.2} />
      </Layer>
    </>
  )
}

const manor: Draw = (id) => {
  // No window behind the porch and its roof.
  const win = windowGrid(600, 560, 9, 2, 34, 64, 56, 130, 41, 0.35, [[770, 660, 910, 830]])
  const hill = ridgeAt(690, 40, 42)
  return (
    <>
      <Layer depth="far">
        <Moon x={1260} y={200} r={44} id={id} />
        <path d={ridge(690, 40, 42)} />
        {Array.from({ length: 14 }, (_, i) => {
          const x = 60 + i * 115 + (i % 3) * 20
          return <path key={i} d={pine(x, hill(x) + 8, 90 + (i % 4) * 30, 50)} />
        })}
      </Layer>
      <Layer depth="mid">
        <path d={ridge(820, 18, 43)} />
        {/* main block, two gables, a tower, chimneys (down into the roof), the porch */}
        <path d="M560 900 V520 H1110 V900 Z" />
        <path d="M545 528 L660 400 L775 528 Z M890 528 L1005 405 L1120 528 Z M760 528 L790 470 H900 L925 528 Z" />
        <path d="M480 900 V420 H570 V900 Z M466 424 L525 280 L584 424 Z" />
        <path d="M690 528 V350 h34 V528 Z M1030 528 V345 h34 V528 Z M686 350 h42 v-10 h-42 Z M1026 345 h42 v-10 h-42 Z" />
        <path d="M790 900 V700 h100 v200 Z M770 704 L840 660 L910 704 Z" />
        <path d={win.dark} opacity={0.6} fill="var(--sil-near)" />
      </Layer>
      <Layer depth="lit">
        <path d={`${win.lit} ${arched(508, 480, 30, 56)}`} opacity={0.85} />
        <path d="M812 830 v-100 h56 v100 Z" opacity={0.5} />
        <Halo id={`${id}-halo`} x={840} y={790} r={150} o={0.6} />
      </Layer>
      <Layer depth="near">
        <BareTree x={1400} base={900} h={600} seed={44} lean={-0.12} />
        <Fence y={900} h={100} gateFrom={760} gateTo={920} />
      </Layer>
    </>
  )
}

const library: Draw = (id) => {
  // Shelves full of books: random widths and heights, a few leaning.
  const r = rng(51)
  const books: string[] = []
  const shelves: string[] = []
  const fill = (x1: number, x2: number, top: number, bottom: number, step: number) => {
    for (let y = top; y + step <= bottom; y += step) {
      shelves.push(`M${x1 - 12} ${y + step - 10} H${x2 + 12} v12 H${x1 - 12} Z`)
      let x = x1
      while (x < x2 - 10) {
        const w = 9 + r() * 16
        const h = step * (0.55 + r() * 0.35)
        if (r() < 0.06) {
          x += w * 2.5
          continue
        }
        books.push(`M${f(x)} ${f(y + step - 10)} v${f(-h)} h${f(w - 2)} v${f(h)} Z`)
        x += w
      }
    }
  }
  fill(30, 560, 60, 880, 120)
  fill(1040, 1570, 60, 880, 120)
  fill(640, 960, 660, 880, 110)
  return (
    <>
      <Layer depth="far">
        {/* the back wall, a tall window onto the night */}
        <path d={`M-80 -10 H${W + 80} V${H} H-80 Z ${arched(680, 110, 240, 500)}`} fillRule="evenodd" />
        <path d="M795 140 h10 v470 h-10 Z M680 340 h240 v10 h-240 Z M680 470 h240 v10 h-240 Z" />
        <path d={arched(680, 110, 240, 500)} fill={`url(#${id}-shaft)`} />
      </Layer>
      <Layer depth="mid">
        <path d="M0 0 H600 V900 H0 Z M1000 0 H1600 V900 H1000 Z M620 640 H980 V900 H620 Z" fill="var(--sil-near)" />
        <path d={books.join(' ')} className="scr-books" />
        <path d={shelves.join(' ')} />
      </Layer>
      <Layer depth="near">
        {/* the ladder, the desk, its lamp and a pile of books */}
        {/* its top rests on the bookcase (shelves end at x 572), with room for the near layer's drift */}
        <path d="M330 900 L440 60 h14 L344 900 Z M420 900 L520 60 h14 L434 900 Z" />
        <path d={Array.from({ length: 13 }, (_, i) => { const y = 860 - i * 64; const k = (900 - y) / 840; const x1 = 337 + 110 * k; const x2 = 427 + 100 * k; return `M${f(x1)} ${y} H${f(x2)} v8 H${f(x1)} Z` }).join(' ')} />
        <path d="M540 900 V780 H1080 V900 Z M520 784 H1100 v-18 H520 Z" />
        <path d="M640 766 h120 v-20 h-120 Z M650 746 h100 v-18 h-100 Z M662 728 h80 v-16 h-80 Z" />
        <path d="M930 766 h40 v-8 h-14 v-70 h-12 v70 h-14 Z M900 690 L920 640 H980 L1000 690 Z" />
      </Layer>
      <Layer depth="pulse">
        <Halo id={`${id}-halo`} x={950} y={700} r={300} />
        <path d="M904 690 h92 v6 h-92 Z" />
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
        {/* down to the pavement, behind the curb (no gap onto the town behind); the steps shaded to show */}
        <path d="M420 880 V330 H1180 V880 Z M400 336 H1200 V306 H400 Z M440 306 V284 H1160 V306 Z" />
        <path d="M600 880 V860 H1000 V880 Z M620 860 V842 H980 V860 Z M640 842 V824 H960 V842 Z" fill="var(--sil-near)" opacity={0.45} />
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
      <Layer depth="lit-near">
        {/* the street lamp's glass, on its post */}
        <Halo id={`${id}-halo`} x={1352} y={548} r={220} />
        <path d="M1336 540 h32 l-6 22 h-20 Z" />
      </Layer>
    </>
  )
}

const forest: Draw = () => {
  // Trees planted on their ridge (a little below its line), not standing on air above a dip.
  const r = rng(71)
  const farGround = ridgeAt(680, 30, 72)
  const midGround = ridgeAt(830, 16, 73)
  const far: string[] = []
  for (let x = -20; x < W + 20; x += 22 + r() * 18) far.push(pine(x, farGround(x) + 6 + r() * 24, 120 + r() * 90, 46 + r() * 20))
  const mid: string[] = []
  for (let x = -20; x < W + 40; x += 70 + r() * 60) mid.push(pine(x, midGround(x) + 6 + r() * 24, 280 + r() * 200, 110 + r() * 50))
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
        {/* warehouses on their quay (not on the water), the pier, two boats */}
        <path d="M-40 780 V470 L60 400 L160 470 V780 Z M150 780 V440 L280 360 L410 440 V780 Z M400 780 V500 L470 450 L540 500 V780 Z" />
        <path d="M-40 900 V776 H640 V900 Z" />
        <path d="M520 772 H1120 v14 H520 Z" />
        <path d={Array.from({ length: 11 }, (_, i) => `M${540 + i * 56} 900 V772 h12 V900 Z`).join(' ')} />
        <path d={`${boat(760, 1)} ${boat(1010, 0.8)}`} />
      </Layer>
      <Layer depth="lit">
        <path d="M30 600 h26 v40 h-26 Z M210 560 h30 v44 h-30 Z M300 640 h30 v44 h-30 Z M455 560 h24 v36 h-24 Z" opacity={0.8} />
      </Layer>
      <Layer depth="near">
        {/* on the quay: a lamp, bollards, crates */}
        <path d="M584 900 V566 h12 V900 Z M576 548 h28 l-6 -12 h-16 Z" />
        <path d="M60 900 V820 q30 -14 60 0 V900 Z M210 900 V840 q24 -10 48 0 V900 Z" />
        <path d="M300 900 V830 H420 V900 Z M330 830 V790 H420 V830 Z" />
      </Layer>
      <Layer depth="lit-near">
        <Halo id={`${id}-halo`} x={590} y={556} r={200} />
        <path d="M576 548 h28 l-6 20 h-16 Z" />
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
    // Terraced: each house touches the next, down to the street (behind its edge).
    houses.push(gable ? `M${f(x)} 840 V${f(top)} L${f(x + w / 2)} ${f(top - 80)} L${f(x + w)} ${f(top)} V840 Z` : `M${f(x)} 840 V${f(top)} H${f(x + w)} V840 Z M${f(x - 6)} ${f(top + 4)} H${f(x + w + 6)} v-14 H${f(x - 6)} Z`)
    // The chimney starts inside the house, so it never floats above a sloping roof.
    chimneys.push(`M${f(x + w * 0.7)} ${f(top)} V${f(top - (gable ? 110 : 50))} h22 V${f(top)} Z`)
    const cols = Math.max(2, Math.floor(w / 60))
    const gx = w / cols
    for (let y = top + 40; y < 700; y += 90) {
      for (let i = 0; i < cols; i++) (r() < 0.32 ? lit : dark).push(`M${f(x + i * gx + gx / 2 - 14)} ${f(y)} h28 v48 h-28 Z`)
    }
    x += w
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
      </Layer>
      <Layer depth="near">
        <path d="M-40 900 V834 H1640 V900 Z" />
        {[300, 1250].map((x) => <path key={x} d={`M${x - 6} 834 V576 h12 V834 Z M${x - 18} 834 l12 -30 h12 l12 30 Z M${x - 18} 552 h36 l-8 -14 h-20 Z M${x - 2} 538 v-10 h4 v10 Z`} />)}
      </Layer>
      <Layer depth="lit-near">
        {/* the lamps' glass on their posts, and their reflections on the wet street */}
        {[300, 1250].map((x) => (
          <g key={x}>
            <Halo id={`${id}-halo`} x={x} y={560} r={210} />
            <path d={`M${x - 16} 552 h32 l-6 24 h-20 Z`} />
            <ellipse cx={x} cy={880} rx={30} ry={70} fill={`url(#${id}-halo)`} />
          </g>
        ))}
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
