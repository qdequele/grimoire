// Drawn décor: swamp. See the decor-artist skill.
// A bayou at night: moss-hung cypresses standing in still black water, a shack on stilts with a lit
// window, its jetty and a lantern on the mooring post, a flat-bottomed skiff tied there, reeds and a
// dead tree on the banks in front, every reflection broken by the ripples.
import type { ReactNode } from 'react'
import { type Draw, H, Halo, Layer, Moon, P, W, f, grass, rng } from '../placeKit'

/** A lumpy, flattish clump of foliage around cx, cy (a cypress's pad): rounder on top, flat underneath. */
function blob(cx: number, cy: number, rx: number, ry: number, r: () => number, n = 10): string {
  const pts: Array<[number, number]> = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 0.82 + r() * 0.3
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * (Math.sin(a) > 0 ? ry * 0.55 : ry) * k])
  }
  const mid = (i: number) => {
    const p = pts[i % n]
    const q = pts[(i + 1) % n]
    return `${f((p[0] + q[0]) / 2)} ${f((p[1] + q[1]) / 2)}`
  }
  let d = `M${mid(n - 1)}`
  for (let i = 0; i < n; i++) d += ` Q${f(pts[i][0])} ${f(pts[i][1])} ${mid(i)}`
  return `${d} Z`
}

/** A ragged hank of hanging moss whose top is at x, y (inside what holds it): three tips of uneven length. */
function strand(x: number, y: number, len: number, r: () => number): string {
  const w = 4 + r() * 7
  const s = (r() - 0.5) * 8
  const l2 = len * (0.45 + r() * 0.4)
  const l3 = len * (0.3 + r() * 0.45)
  return `M${f(x - w / 2)} ${f(y)} L${f(x + w / 2)} ${f(y)} L${f(x + w * 0.4 + s * 0.5)} ${f(y + l3)} L${f(x + w * 0.15 + s * 0.7)} ${f(y + l3 * 0.65)} L${f(x + s)} ${f(y + len)} L${f(x - w * 0.15 + s * 0.6)} ${f(y + l2 * 0.6)} L${f(x - w * 0.38 + s * 0.4)} ${f(y + l2)} Z`
}

/** A bald cypress standing in the water: flared foot, a tall trunk, flat clumps of foliage stacked up it
 * (each a few lumps), curtains of moss hanging under them. */
function cypress(x: number, base: number, h: number, w: number, seed: number, mossy = true): string {
  const r = rng(seed)
  const tw = Math.max(2, w * 0.04)
  const flare = w * 0.16
  let d = `M${f(x - flare)} ${base + 2} Q${f(x - tw * 1.2)} ${f(base - h * 0.04)} ${f(x - tw * 1.3)} ${f(base - h * 0.2)} L${f(x - tw * 0.55)} ${f(base - h * 0.93)} L${f(x + tw * 0.55)} ${f(base - h * 0.93)} L${f(x + tw * 1.3)} ${f(base - h * 0.2)} Q${f(x + tw * 1.2)} ${f(base - h * 0.04)} ${f(x + flare)} ${base + 2} Z `
  const n = 6
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1)
    const top = k === n - 1
    const side = top ? 0 : k % 2 === 0 ? -1 : 1
    const cy = base - h * (0.46 + 0.48 * t) + (r() - 0.5) * h * 0.03
    const cx = x + side * w * (0.1 + r() * 0.14) * (1 - 0.4 * t)
    const rx = w * (0.2 + r() * 0.08) * (top ? 1.15 : 1 - 0.3 * t)
    const ry = rx * 0.42
    // the limb, from inside the trunk to the middle of its clump
    if (!top) {
      const y0 = cy + ry * 0.6 + h * 0.035
      d += `M${f(x - side * tw * 0.3)} ${f(y0)} L${f(cx)} ${f(cy - 2)} L${f(cx)} ${f(cy + 4)} L${f(x - side * tw * 0.3)} ${f(y0 + 9)} Z `
    }
    // the clump: a main lump and two smaller ones overlapping its ends
    d += `${blob(cx, cy, rx, ry, r)} `
    d += `${blob(cx - rx * 0.62, cy + ry * 0.12, rx * 0.5, ry * 0.8, r)} `
    d += `${blob(cx + rx * 0.6, cy + ry * 0.08, rx * 0.48, ry * 0.85, r)} `
    if (mossy) {
      const m = 5 + Math.floor(r() * 5)
      for (let i = 0; i < m; i++) d += `${strand(cx + (r() - 0.5) * rx * 1.5, cy + ry * 0.05, ry * (1.2 + r() * 3.2), r)} `
    }
  }
  return d
}

/** A dead tree: tapered limbs as fills, a flared foot, moss hanging from the limbs that run sideways. */
function deadTree(x: number, base: number, h: number, seed: number, lean = 0): string {
  const r = rng(seed)
  let d = ''
  const grow = (x0: number, y0: number, len: number, ang: number, w0: number, depth: number) => {
    if (depth > 5 || len < 10) return
    const x1 = x0 + Math.cos(ang) * len
    const y1 = y0 + Math.sin(ang) * len
    const w1 = w0 * 0.66
    const nx = -Math.sin(ang)
    const ny = Math.cos(ang)
    d += `M${f(x0 + (nx * w0) / 2)} ${f(y0 + (ny * w0) / 2)} L${f(x1 + (nx * w1) / 2)} ${f(y1 + (ny * w1) / 2)} L${f(x1 - (nx * w1) / 2)} ${f(y1 - (ny * w1) / 2)} L${f(x0 - (nx * w0) / 2)} ${f(y0 - (ny * w0) / 2)} Z `
    // a knot where the limb forks, so the next limbs leave no notch
    const k = w1 / 2
    d += `M${f(x1 - k)} ${f(y1)} a${f(k)} ${f(k)} 0 1 0 ${f(2 * k)} 0 a${f(k)} ${f(k)} 0 1 0 ${f(-2 * k)} 0 Z `
    if (depth >= 1 && Math.abs(Math.cos(ang)) > 0.4) {
      for (let i = 0; i < 2; i++) {
        const t = 0.25 + r() * 0.65
        d += `${strand(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 1, (30 + r() * 90) * (1 - depth / 8), r)} `
      }
    }
    const n = depth === 0 ? 2 : r() < 0.35 ? 3 : 2
    for (let i = 0; i < n; i++) grow(x1, y1, len * (0.62 + r() * 0.16), ang + (i - (n - 1) / 2) * 0.72 + (r() - 0.5) * 0.5, w1, depth + 1)
  }
  const w = h * 0.07
  // the flared foot, its top a little narrower than the trunk there so no ledge shows
  const sh = Math.tan(lean) * 90 // the trunk leans: its sides 90 units up are shifted by this
  d += `M${f(x - w * 1.5)} ${base + 4} Q${f(x - w * 0.6)} ${base - 24} ${f(x + sh - w * 0.42)} ${base - 90} L${f(x + sh + w * 0.42)} ${base - 90} Q${f(x + w * 0.6)} ${base - 24} ${f(x + w * 1.5)} ${base + 4} Z `
  grow(x, base, h * 0.34, -Math.PI / 2 + lean, w, 0)
  return d
}

/** A broken snag: a dead trunk snapped off, a stub of a limb. */
const snag = (x: number, base: number, h: number, w: number) =>
  `M${f(x - w * 0.9)} ${base + 2} Q${f(x - w * 0.45)} ${f(base - h * 0.08)} ${f(x - w * 0.4)} ${f(base - h * 0.3)} L${f(x - w * 0.28)} ${f(base - h * 0.86)} L${f(x - w * 0.1)} ${f(base - h * 0.93)} L${f(x)} ${f(base - h)} L${f(x + w * 0.1)} ${f(base - h * 0.9)} L${f(x + w * 0.26)} ${f(base - h * 0.95)} L${f(x + w * 0.32)} ${f(base - h * 0.3)} Q${f(x + w * 0.45)} ${f(base - h * 0.08)} ${f(x + w * 0.9)} ${base + 2} Z ` +
  `M${f(x + w * 0.2)} ${f(base - h * 0.58)} L${f(x + w * 1.7)} ${f(base - h * 0.74)} L${f(x + w * 1.72)} ${f(base - h * 0.7)} L${f(x + w * 0.24)} ${f(base - h * 0.5)} Z`

/** Cypress knees: little stumps poking out of the water around a trunk. */
const knees = (xs: number[], base: number, r: () => number) =>
  xs.map((x) => { const h = 8 + r() * 14; return `M${f(x - 5)} ${base + 2} L${f(x - 1.5)} ${f(base - h)} L${f(x + 2)} ${f(base - h + 2)} L${f(x + 5)} ${base + 2} Z` }).join(' ')

/** A bank's top edge from x1 to x2 (sampled every 8 units) and the matching height function, for grass. */
function bank(fn: (x: number) => number, x1: number, x2: number) {
  const xs: number[] = []
  for (let x = x1; x < x2; x += 8) xs.push(x)
  xs.push(x2)
  const ys = xs.map(fn)
  const at = (x: number) => {
    if (x <= x1) return ys[0]
    if (x >= x2) return ys[ys.length - 1]
    const i = Math.min(xs.length - 2, Math.floor((x - x1) / 8))
    const t = (x - xs[i]) / (xs[i + 1] - xs[i])
    return ys[i] * (1 - t) + ys[i + 1] * t
  }
  const d = `M${x1} ${H + 10} ${xs.map((x, i) => `L${f(x)} ${f(ys[i])}`).join(' ')} L${x2} ${H + 10} Z`
  return { d, at }
}

/** Cattails: a stalk sunk in the bank, a velvet head, a spike above it. */
function cattails(at: (x: number) => number, xs: number[], r: () => number): string {
  return xs.map((x) => {
    const y = at(x) + 4
    const h = 70 + r() * 60
    const lean = (r() - 0.5) * 16
    const top = y - h
    return `M${f(x - 1.4)} ${f(y)} L${f(x + lean - 1)} ${f(top)} L${f(x + lean + 1)} ${f(top)} L${f(x + 1.4)} ${f(y)} Z ` +
      `M${f(x + lean - 3.5)} ${f(top + 26)} Q${f(x + lean - 4)} ${f(top + 2)} ${f(x + lean)} ${f(top + 1)} Q${f(x + lean + 4)} ${f(top + 2)} ${f(x + lean + 3.5)} ${f(top + 26)} Z ` +
      `M${f(x + lean - 0.8)} ${f(top + 4)} L${f(x + lean)} ${f(top - 14)} L${f(x + lean + 0.8)} ${f(top + 4)} Z`
  }).join(' ')
}

/** Its reflection: the shapes mirrored about the waterline y, faint and broken by the ripples. */
const reflect = (y: number, id: string, children: ReactNode, o = 0.5) => (
  <g clipPath={`url(#${id}-ripples)`} opacity={o}>
    <g transform={`translate(0 ${2 * y}) scale(1 -1)`}>{children}</g>
  </g>
)

/** Broken streaks of light on the water, under a light at x. */
function streak(x: number, y0: number, y1: number, w: number, seed: number): string {
  const q = rng(seed)
  let d = ''
  for (let y = y0; y < y1; y += 6 + q() * 6) {
    const k = w * (0.4 + q() * 0.8) * (0.6 + ((y - y0) / (y1 - y0)) * 0.8)
    d += `M${f(x - k / 2 + (q() - 0.5) * w * 0.5)} ${f(y)} h${f(k)} v2.2 h${f(-k)} Z `
  }
  return d
}

export const swamp: Draw = (id) => {
  const r = rng(301)
  // the water's surface, broken into bands: reflections show only on the bands
  let strips = ''
  for (let y = 640; y < H + 80;) {
    const band = 3 + r() * 6
    strips += `M-100 ${f(y)} H${W + 100} v${f(band)} H-100 Z `
    y += band + 1 + r() * 2.5 * (1 + (y - 660) / 160)
  }
  let ripples = ''
  for (let i = 0; i < 80; i++) {
    const y = 672 + r() ** 1.4 * 228
    const len = 8 + r() * 50 * ((y - 640) / 260)
    ripples += `M${f(r() * W)} ${f(y)} h${f(len)} v1.2 h${f(-len)} Z `
  }
  // the far shore: low scrub and a line of cypresses in the mist
  const haze: string[] = []
  for (let x = -30; x < W + 30; x += 50 + r() * 90) haze.push(cypress(x, 668, 70 + r() * 90, 60 + r() * 50, 400 + Math.round(x), false))
  const farTrees: string[] = []
  for (let x = -10; x < W + 30; x += 120 + r() * 200) {
    if (x > 600 && x < 820) continue
    farTrees.push(cypress(x, 672, 50 + r() * 60, 50 + r() * 40, 500 + Math.round(x), false))
  }
  const left = bank((x) => 846 + 7 * Math.sin(x / 53) + 5 * Math.sin(x / 23 + 1) + (x > 300 ? (x - 300) ** 2 / 1100 : 0), -40, 548)
  const right = bank((x) => 850 + 6 * Math.sin(x / 47) + 4 * Math.sin(x / 19) + (x < 1400 ? (1400 - x) ** 2 / 900 : 0), 1186, W + 40)
  const k = rng(302)
  // the shack on stilts (stilt feet at 766), its jetty (posts at 770) and the skiff (waterline 793)
  const shack = (
    <>
      <P d="M1058 740 V758 h6 V740 Z M1118 740 V758 h6 V740 Z M1176 740 V758 h6 V740 Z M1226 740 V758 h6 V740 Z" fill="var(--sil-back)" />
      <P d="M1044 738 V766 h8 V738 Z M1100 738 V766 h8 V738 Z M1158 738 V766 h8 V738 Z M1210 738 V766 h8 V738 Z" />
      <P d="M1052 742 L1100 764 M1100 742 L1052 764 M1166 742 L1210 764 M1210 742 L1166 764" stroke="currentColor" strokeWidth={2.5} fill="none" />
      <P d="M1028 728 H1236 V740 H1028 Z" />
      <P d="M1040 730 V612 H1222 V730 Z" />
      <P d="M1024 618 L1131 554 L1238 618 V625 H1024 Z" />
      <P d="M1186 600 V524 h9 V600 Z M1181 526 h19 v-7 h-19 Z" />
    </>
  )
  const jetty = (
    <>
      <P d="M914 741 V770 h7 V741 Z M964 741 V770 h7 V741 Z M1012 741 V770 h7 V741 Z" />
      <P d="M906 732 H1034 V741 H906 Z" />
      {/* the mooring post, taller, and the arm the lantern hangs from */}
      <P d="M902 700 V772 h9 V700 Z M900 698 h13 v4 h-13 Z M880 705 H904 v3 H880 Z M881 708 h2 v7 h-2 Z" />
      {/* the lantern: cap, body (dark by day, lit at night) and foot */}
      <P d="M877 716 h12 l-3 -4 h-6 Z M878 715 h10 v14 h-10 Z M877 729 h12 v3 h-12 Z" />
    </>
  )
  const skiff = (
    <>
      <P d="M750 776 L768 794 H884 L900 776 Z" />
      <P d="M742 774 L906 769 v3 L742 777 Z" />
    </>
  )
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <clipPath id={`${id}-ripples`} clipPathUnits="userSpaceOnUse">
            <path d={strips} />
          </clipPath>
        </defs>
      </svg>
      <Layer depth="far">
        <Moon x={700} y={176} r={40} id={id} />
        <P d={haze.join(' ')} fill="var(--sil-haze)" />
        <P d={farTrees.join(' ')} />
        <P d="M-40 676 Q200 664 420 670 T860 668 T1300 670 T1640 666 V680 H-40 Z" />
        {/* the water */}
        <rect x="-40" y="672" width={W + 80} height="260" fill="var(--sil-water)" />
      </Layer>
      <Layer depth="water">
        <P d={ripples} opacity={0.16} />
        <g className="scr-moon">
          <P d={streak(700, 680, 900, 56, 303)} opacity={0.3} />
        </g>
        <g className="scr-sun">
          <P d={streak(700, 680, 900, 84, 303)} opacity={0.3} />
        </g>
        {/* lily pads on the still water in front */}
        <P d="M640 884 a26 6 0 1 0 1 0 Z M700 892 a18 4.5 0 1 0 1 0 Z M820 878 a22 5 0 1 0 1 0 Z M600 870 a14 3.5 0 1 0 1 0 Z" fill="var(--sil-mid)" opacity={0.8} />
      </Layer>
      <Layer depth="mid">
        {/* reflections first, under what casts them */}
        {reflect(772, id, <P d={cypress(380, 772, 520, 330, 311)} />)}
        {reflect(742, id, <P d={cypress(560, 742, 360, 240, 312)} />)}
        {reflect(752, id, <P d={snag(1292, 752, 160, 24)} />)}
        {reflect(778, id, <P d={cypress(1440, 778, 560, 340, 313)} />)}
        {reflect(766, id, shack)}
        {reflect(770, id, jetty)}
        {reflect(794, id, skiff)}
        <P d={cypress(380, 772, 520, 330, 311)} />
        <P d={knees([318, 336, 430, 452, 470], 774, k)} />
        <P d={cypress(560, 742, 360, 240, 312)} />
        <P d={knees([520, 604, 616], 744, k)} />
        <P d={snag(1292, 752, 160, 24)} />
        <P d={cypress(1440, 778, 560, 340, 313)} />
        <P d={knees([1380, 1398, 1486], 780, k)} />
        {/* reeds standing in the shallows */}
        <P d={grass(772, 304, 250, 300, 40)} />
        <P d={grass(744, 305, 600, 650, 30)} />
        {shack}
        {/* the door, the dark window (lit at night), a shutter hanging askew, the boards */}
        <P d="M1056 730 V650 H1088 V730 Z M1124 640 h34 v34 h-34 Z" fill="var(--sil-near)" />
        <P d="M1162 638 l15 3 v34 l-15 -3 Z" fill="var(--sil-near)" opacity={0.8} />
        <P d={[1048, 1102, 1112, 1186, 1200, 1214].map((x) => `M${x} 618 V728`).join(' ') + ' M1092 622 V728 M1172 622 V636 M1172 680 V728'} stroke="var(--sil-back)" strokeWidth={1.5} opacity={0.6} fill="none" />
        {jetty}
        {skiff}
        {/* the skiff's rope to the mooring post */}
        <path d="M894 778 Q906 772 905 744" stroke="currentColor" strokeWidth={1.6} fill="none" />
        {/* rings on the water round the trunks and the stilts */}
        <g className="scr-rim" strokeWidth={1.2} strokeDasharray="14 9 22 12" style={{ opacity: 0.16 }}>
          <path d="M330 778 Q380 786 432 778 M520 748 Q560 754 604 748 M1394 784 Q1440 792 1490 784 M1036 770 Q1130 778 1226 770" />
        </g>
        <g className="scr-rim" strokeWidth={2}>
          <path d="M1024 618 L1131 554 M906 732 H1034 M752 776 H898" />
        </g>
      </Layer>
      <Layer depth="lit">
        <Halo id={`${id}-halo`} x={1141} y={657} r={170} o={0.55} />
        <P d="M1124 640 h34 v34 h-34 Z" fill={`url(#${id}-glass)`} />
        <path d="M1141 640 v34 M1124 657 h34" stroke="var(--sil-mid)" strokeWidth={2.5} fill="none" />
        {/* the window on the water, under the shack's reflection */}
        <P d={streak(1141, 846, 896, 30, 306)} opacity={0.45} />
      </Layer>
      <Layer depth="pulse-mid">
        <g className="scr-glow">
          <Halo id={`${id}-halo`} x={882} y={724} r={110} />
          <P d="M878 715 h10 v14 h-10 Z" />
          <path d="M881.5 715 v14 M884.5 715 v14" stroke="var(--sil-mid)" strokeWidth={1.2} fill="none" />
          <P d={streak(882, 798, 840, 16, 307)} opacity={0.4} />
        </g>
      </Layer>
      <Layer depth="near">
        <P d={left.d} />
        <P d={deadTree(120, 856, 640, 308, 0.1)} />
        <P d={knees([214, 236, 262, 40], 852, k)} />
        <P d={grass(left.at, 309, -40, 530, 64)} data-ground="each" />
        <P d={cattails(left.at, [330, 352, 371, 420, 446], k)} data-ground />
        <P d={right.d} />
        <P d={grass(right.at, 310, 1200, W + 40, 70)} data-ground="each" />
        <P d={cattails(right.at, [1232, 1250, 1290, 1312, 1520, 1546], k)} data-ground />
      </Layer>
      <Layer depth="pulse">
        {/* a will-o'-wisp over the water: it floats, on purpose */}
        <g className="scr-glow" data-free>
          <Halo id={`${id}-halo`} x={468} y={714} r={56} o={0.7} />
          <circle cx={468} cy={714} r={3.2} />
        </g>
      </Layer>
    </>
  )
}
