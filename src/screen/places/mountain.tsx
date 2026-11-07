// Drawn décor: mountain. See the decor-artist skill.
// High mountains at night: snowy jagged peaks far away, their faces turned to the moon paler; a pass
// between two nearer shoulders, a stone refuge on the col with a lit window and a smoking chimney,
// firs on the slopes, a path winding up through the snow to its door; rocks and snow in front.
import { type Draw, H, Halo, Layer, Moon, P, f, grass, ragPine, ridge, ridgeAt, rng } from '../placeKit'

type Pt = [number, number]

/** A rough line through the given points: each segment broken into small random steps (rock). */
function jag(points: Pt[], seed: number, rough = 10): Pt[] {
  const r = rng(seed)
  const out: Pt[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 24))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const j = k === n ? 0 : rough
      out.push([x0 + (x1 - x0) * t + (r() - 0.5) * j * 0.6, y0 + (y1 - y0) * t + (r() - 0.5) * j])
    }
  }
  return out
}

const line = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join(' ')

/** A range: its ridge line closed down to the bottom of the frame. */
const range = (pts: Pt[]) => `${line(pts)} L${f(pts[pts.length - 1][0])} ${H + 10} L${f(pts[0][0])} ${H + 10} Z`

/** The ridge's height at x (the polyline through the points). */
function heightAt(pts: Pt[]): (x: number) => number {
  return (x) => {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]
      const [x1, y1] = pts[i]
      if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1)
    }
    return pts[pts.length - 1][1]
  }
}

/** The ridge points between x1 and x2 (the top edge of a snowfield or a lit face: exactly the ridge). */
const between = (pts: Pt[], x1: number, x2: number) => pts.filter(([x]) => x >= x1 && x <= x2)

/**
 * The snow and the moonlit faces of a range of peaks. `summits`: [x of the summit, x of the valley after it]
 * pairs. Each summit gets a cap (the ridge down to `cap` below it, a ragged lower edge) and its right
 * flank, turned to the moon, a paler face down to the valley.
 */
function snows(pts: Pt[], summits: Array<[number, number]>, cap: number, seed: number) {
  const r = rng(seed)
  const at = heightAt(pts)
  let caps = ''
  let faces = ''
  for (const [sx, vx] of summits) {
    const sy = at(sx)
    const vy = at(vx)
    // the lit face: the ridge from the summit to the valley, then a ragged spine back up to the summit
    const ridgeTop = between(pts, sx, vx)
    const spine = jag([[vx - (vx - sx) * 0.15, vy + 26], [sx + (vx - sx) * 0.3, sy + (vy - sy) * 0.9 + 40], [sx + 2, sy + 6]], Math.round(r() * 1000), 14)
    faces += `${line([[sx, sy], ...ridgeTop, [vx, vy], ...spine])} Z `
    // the cap: the ridge points within `cap` of the summit, both sides, and a ragged edge under them
    const left = pts.filter(([x, y]) => x < sx && x > sx - 200 && y < sy + cap)
    const right = pts.filter(([x, y]) => x > sx && x < sx + 200 && y < sy + cap)
    const lx = left.length ? left[0][0] : sx - 20
    const rx = right.length ? right[right.length - 1][0] : sx + 20
    const edge = jag([[rx, at(rx)], [sx + (rx - sx) * 0.4, sy + cap * 1.1], [sx, sy + cap * 0.7], [sx - (sx - lx) * 0.5, sy + cap * 1.05], [lx, at(lx)]], Math.round(r() * 1000), 12).slice(1, -1)
    caps += `${line([...left, [sx, sy], ...right, ...edge])} Z `
  }
  return { caps, faces }
}

/** Puffs of smoke rising from x, y and leaning right as they climb (one path: filled with a fading gradient). */
function smoke(x: number, y: number, seed: number): string {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < 12; i++) {
    const t = i / 11
    const cx = x + t * t * 80 + (r() - 0.5) * 5
    const cy = y - 1 - t * 120
    const rad = 5 + t * 18 + r() * 3
    d += `M${f(cx - rad)} ${f(cy)} a${f(rad)} ${f(rad * 0.85)} 0 1 0 ${f(2 * rad)} 0 a${f(rad)} ${f(rad * 0.85)} 0 1 0 ${f(-2 * rad)} 0 Z `
  }
  return d
}

export const mountain: Draw = (id) => {
  // the far peaks: a pale range in the mist, a nearer jagged one
  const back = jag([[-40, 470], [120, 386], [260, 430], [420, 352], [600, 414], [760, 332], [930, 404], [1100, 344], [1260, 420], [1420, 360], [1640, 404]], 601, 12)
  const peaks = jag([[-40, 560], [60, 424], [150, 470], [300, 300], [400, 390], [540, 222], [680, 410], [780, 344], [880, 446], [1010, 290], [1120, 402], [1290, 252], [1420, 384], [1520, 332], [1640, 424]], 602, 14)
  const far = snows(peaks, [[60, 150], [300, 400], [540, 680], [780, 880], [1010, 1120], [1290, 1420], [1520, 1640]], 70, 603)
  const farBack = snows(back, [[120, 260], [420, 600], [760, 930], [1100, 1260], [1420, 1640]], 40, 604)
  // the two shoulders of the pass and the col between them, where the refuge stands
  const shoulders = [
    ...jag([[-40, 490], [60, 452], [150, 466], [240, 436], [330, 486], [430, 534], [540, 594], [640, 640], [720, 666], [790, 678]], 605, 10),
    ...jag([[790, 678], [900, 676]], 606, 0).slice(1),
    ...jag([[900, 676], [980, 646], [1080, 594], [1180, 548], [1280, 508], [1360, 478], [1460, 444], [1560, 456], [1640, 436]], 607, 10).slice(1),
  ]
  const slope = heightAt(shoulders)
  // moonlit snow on the left shoulder, which faces the moon; shadowed rock on the right one
  const litFace = `${line([...between(shoulders, 240, 700), ...jag([[700, slope(700)], [660, 690], [560, 672], [470, 620], [380, 576], [300, 516], [244, 440]], 615, 16).slice(1)])} Z`
  // firs on the slopes: thin near the col, bigger lower down
  const r = rng(608)
  const firs: string[] = []
  const plant = (x1: number, x2: number, below: [number, number], h: [number, number], step: number) => {
    for (let x = x1; x < x2; x += step * (0.6 + r() * 0.8)) {
      const base = slope(x) + below[0] + r() * (below[1] - below[0])
      const hh = h[0] + r() * (h[1] - h[0])
      firs.push(ragPine(x, base, hh, hh * 0.38, r))
    }
  }
  plant(600, 770, [6, 30], [40, 80], 26)
  plant(930, 1120, [6, 36], [44, 90], 24)
  plant(330, 560, [60, 150], [90, 150], 36)
  plant(1120, 1360, [70, 170], [100, 170], 34)
  plant(40, 300, [120, 220], [120, 190], 44)
  plant(1380, 1640, [120, 230], [120, 200], 44)
  // the path, trodden dark through the snow, zigzagging down from the refuge's door
  const path = [
    'M824 684 L760 700',
    'M760 700 Q700 712 690 722 Q700 734 780 748',
    'M780 748 Q840 760 830 770 Q800 784 680 800',
    'M680 800 Q600 818 620 832 Q660 850 780 870',
    'M780 870 Q860 890 820 920',
  ]
  const near = ridgeAt(862, 16, 609)
  const q = rng(610)
  const nearFirs = `${ragPine(70, 880, 600, 200, q)} ${ragPine(1556, 884, 640, 210, q)} ${ragPine(1460, 878, 360, 130, q)}`
  const boulderL: Pt[] = [[-40, 910], [-34, 770], [20, 730], [70, 700], [150, 676], [214, 700], [262, 742], [300, 760], [340, 830], [356, 910]]
  const boulderR: Pt[] = [[1200, 910], [1222, 826], [1270, 784], [1330, 760], [1400, 750], [1446, 784], [1470, 850], [1480, 910]]
  const bl = jag(boulderL, 611, 8)
  const br = jag(boulderR, 612, 8)
  // snow lying on their tops: the rock's own outline on top, a ragged edge under it
  const capOn = (pts: Pt[], x1: number, x2: number, depth: number, seed: number) => {
    const top = between(pts, x1, x2)
    const at = heightAt(pts)
    const n = 6
    const under: Pt[] = Array.from({ length: n - 1 }, (_, i) => { const x = x2 - ((x2 - x1) * (i + 1)) / n; return [x, at(x) + depth * (0.5 + 0.5 * Math.sin((i + 1) / n * Math.PI))] })
    return `${line([[x1, at(x1)], ...top, [x2, at(x2)], ...jag(under, seed, 10)])} Z`
  }
  const capL = capOn(bl, 0, 290, 34, 620)
  const capR = capOn(br, 1236, 1456, 30, 621)
  // stones and snow poles marking the path, rocks on the valley floor
  const poles = 'M690 722 v-28 h3 v28 Z M833 772 v-30 h3 v30 Z M616 834 v-34 h4 v34 Z'
  const valley = [jag([[980, 806], [1000, 780], [1040, 772], [1070, 790], [1078, 808]], 622, 6), jag([[470, 868], [492, 838], [540, 828], [576, 850], [584, 870]], 623, 6)]
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          {/* the smoke, thick at the chimney, thinning away as it climbs */}
          <linearGradient id={`${id}-mtsmoke`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--sil-haze)" stopOpacity="0.6" />
            <stop offset="1" stopColor="var(--sil-haze)" stopOpacity="0.05" />
          </linearGradient>
        </defs>
      </svg>
      <Layer depth="far">
        <Moon x={1180} y={150} r={38} id={id} />
        <P d={range(back)} fill="var(--sil-haze)" />
        <P d={farBack.caps} fill="var(--moon)" opacity={0.12} />
        <P d={range(peaks)} />
        <P d={far.faces} fill="var(--moon)" opacity={0.08} />
        <P d={far.caps} fill="var(--moon)" opacity={0.2} />
      </Layer>
      <Layer depth="mid">
        <P d={range(shoulders)} />
        {/* snow over both shoulders, brighter where the moon falls */}
        <P d={range(shoulders)} fill="var(--moon)" opacity={0.06} />
        <P d={litFace} fill="var(--moon)" opacity={0.07} />
        <P d={path.join(' ')} stroke="var(--sil-mid)" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.85} />
        <P d={firs.join(' ')} />
        <P d={`${poles} ${valley.map((v) => `${line(v)} Z`).join(' ')}`} />
        <P d={valley.map((v) => capOn(v, v[1][0], v[v.length - 2][0], 8, 624)).join(' ')} fill="var(--moon)" opacity={0.18} />
        {/* the refuge on the col: stone walls, a steep roof, its chimney, a woodpile by the wall */}
        <P data-ground d="M812 684 V614 H900 V684 Z" />
        <P d="M802 618 L856 566 L910 618 V625 H802 Z M880 600 V572 h12 V600 Z M877 573 h18 v-5 h-18 Z" />
        <P data-ground d="M902 684 V666 h30 V684 Z" />
        <P d="M824 684 V648 H842 V684 Z M862 632 h20 v22 h-20 Z" fill="var(--sil-near)" />
        <P d="M907 670 a3 3 0 1 0 0.1 0 Z M915 670 a3 3 0 1 0 0.1 0 Z M923 670 a3 3 0 1 0 0.1 0 Z M911 677 a3 3 0 1 0 0.1 0 Z M919 677 a3 3 0 1 0 0.1 0 Z M927 677 a3 3 0 1 0 0.1 0 Z" fill="var(--sil-back)" />
        {/* stone courses, broken at the door and the window */}
        <P d="M814 628 H898 M814 642 H860 M884 642 H898 M846 656 H860 M884 656 H898 M846 670 H898" stroke="var(--sil-back)" strokeWidth={1.4} opacity={0.6} fill="none" />
        {/* snow on the roof, thicker on the slope turned to the moon */}
        <P d="M802 618 L856 566 L910 618 L904 619 L856 573 L808 619 Z" fill="var(--moon)" opacity={0.18} />
        <P d="M856 566 L910 618 V625 L902 624 L856 580 Z" fill="var(--moon)" opacity={0.12} />
        {/* smoke from the chimney, leaning with the wind */}
        <P d={smoke(886, 568, 613)} fill={`url(#${id}-mtsmoke)`} />
        <g className="scr-rim" strokeWidth={2}>
          <path d="M856 566 L910 618" />
        </g>
      </Layer>
      <Layer depth="lit">
        <Halo id={`${id}-halo`} x={872} y={643} r={150} o={0.6} />
        <P d="M862 632 h20 v22 h-20 Z" fill={`url(#${id}-glass)`} />
        <path d="M872 632 v22 M862 643 h20" stroke="var(--sil-mid)" strokeWidth={2} fill="none" />
        {/* its light on the snow in front of the wall */}
        <ellipse cx={874} cy={702} rx={46} ry={9} fill={`url(#${id}-halo)`} />
      </Layer>
      <Layer depth="near">
        <P d={ridge(862, 16, 609)} />
        <P d={ridge(862, 16, 609)} fill="var(--moon)" opacity={0.09} />
        <P d={line(bl) + ' Z'} />
        <P d={capL} fill="var(--moon)" opacity={0.22} />
        <P d={line(br) + ' Z'} />
        <P d={capR} fill="var(--moon)" opacity={0.22} />
        <P d={nearFirs} />
        <P d={[[400, 470], [610, 660], [930, 1010], [1110, 1150]].map(([a, b], i) => grass(near, 614 + i, a, b, 16)).join(' ')} data-ground="each" />
        <g className="scr-rim" strokeWidth={2}>
          <path d={line(between(br, 1384, 1470))} />
        </g>
      </Layer>
    </>
  )
}
