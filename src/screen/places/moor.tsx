// Drawn décor: moor. See the decor-artist skill.
// A bleak moor at night: a ring of standing stones on a rise, a dry-stone wall running across the
// rolling ground with a gateway in it, heather everywhere, a lone tree bent by the wind on a knoll in
// front, and far away on the low hills a farmhouse with one window still lit.
import { type Draw, H, Halo, Layer, Moon, P, W, crow, f, grass, ridge, ridgeAt, rng } from '../placeKit'

/** Ground from x1 to x2 along fn (sampled every 8 units): the filled shape, and its height at any x. */
function terrain(fn: (x: number) => number, x1 = -80, x2 = W + 80) {
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

/** A lumpy, flattish clump around cx, cy (foliage): rounder on top, flat underneath. */
function blob(cx: number, cy: number, rx: number, ry: number, r: () => number, n = 10): string {
  const pts: Array<[number, number]> = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 0.82 + r() * 0.3
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * (Math.sin(a) > 0 ? ry * 0.6 : ry) * k])
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

/** Heather: low rounded tufts along the ground, their feet sunk into it, a few twigs sticking up. */
function heather(at: (x: number) => number, seed: number, x1: number, x2: number, s = 1): string {
  const r = rng(seed)
  let d = ''
  for (let x = x1; x < x2; x += (6 + r() * 14) * s) {
    const w = (10 + r() * 18) * s
    const h = (5 + r() * 9) * s
    const y0 = at(x) + 3
    const y1 = at(x + w) + 3
    const top = Math.min(y0, y1) - h
    d += `M${f(x)} ${f(y0)} Q${f(x + w * 0.08)} ${f(top + h * 0.2)} ${f(x + w * 0.5)} ${f(top)} Q${f(x + w * 0.92)} ${f(top + h * 0.2)} ${f(x + w)} ${f(y1)} Z `
    if (r() < 0.5) {
      const tx = x + w * (0.3 + r() * 0.4)
      // a twig: planted in the ground itself, through its tuft
      d += `M${f(tx - 1)} ${f(at(tx) + 3)} L${f(tx + (r() - 0.5) * 4)} ${f(top - h * 0.7)} L${f(tx + 1)} ${f(at(tx) + 3)} Z `
    }
  }
  return d
}

/** A standing stone, foot at x, y: a rough slab with uneven sides and a slanting, broken top. */
function menhir(x: number, y: number, h: number, w: number, r: () => number, tilt = 0): { body: string; face: string; edge: string; peak: [number, number] } {
  const lean = tilt * h
  const hl = h * (0.82 + r() * 0.18)
  const hr = h * (0.82 + r() * 0.18)
  const tl: [number, number] = [x - w * (0.3 + r() * 0.14) + lean, y - hl]
  const tr: [number, number] = [x + w * (0.26 + r() * 0.14) + lean, y - hr]
  const peak: [number, number] = [x + w * (r() - 0.5) * 0.4 + lean, y - h * (1 + r() * 0.06)]
  const ml: [number, number] = [x - w * (0.5 + r() * 0.08) + lean * 0.5, y - h * 0.5]
  const mr: [number, number] = [x + w * (0.48 + r() * 0.08) + lean * 0.5, y - h * 0.45]
  const pts: Array<[number, number]> = [[x - w * 0.5, y + 4], ml, tl, peak, tr, mr, [x + w * 0.5, y + 4]]
  const body = `M${pts.map(([px, py]) => `${f(px)} ${f(py)}`).join(' L')} Z`
  // the face turned to the moon (on the right), and its moonlit edge
  const mid = x + w * 0.1 + lean * 0.4
  const face = `M${f(mid)} ${f(y + 2)} L${f(peak[0] + w * 0.08)} ${f(peak[1] + h * 0.06)} L${f(tr[0])} ${f(tr[1])} L${f(mr[0])} ${f(mr[1])} L${f(x + w * 0.5)} ${f(y + 2)} Z`
  const edge = `M${f(peak[0])} ${f(peak[1])} L${f(tr[0])} ${f(tr[1])} L${f(mr[0])} ${f(mr[1])}`
  return { body, face, edge, peak }
}

/** A hawthorn bent by years of wind (scale: 1 = 300 units tall): a thick trunk leaning left, a dense
 * wedge of crown cut by the weather, streaming away from it. */
function bentTree(x: number, base: number, k: number, seed: number): string {
  const r = rng(seed)
  const px = (dx: number) => f(x + dx * k)
  const py = (dy: number) => f(base - dy * k)
  let d = `M${px(-16)} ${base + 6} C${px(-14)} ${py(60)} ${px(-30)} ${py(120)} ${px(-60)} ${py(170)} C${px(-80)} ${py(200)} ${px(-110)} ${py(215)} ${px(-140)} ${py(232)} L${px(-126)} ${py(248)} C${px(-96)} ${py(232)} ${px(-62)} ${py(214)} ${px(-40)} ${py(184)} C${px(-16)} ${py(140)} ${px(2)} ${py(80)} ${px(16)} ${base + 6} Z `
  const limb = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    const a = Math.atan2(y0 - y1, x1 - x0)
    const nx = Math.sin(a) * w
    const ny = Math.cos(a) * w
    return `M${px(x0 + nx)} ${py(y0 + ny)} L${px(x1 + nx * 0.3)} ${py(y1 + ny * 0.3)} L${px(x1 - nx * 0.3)} ${py(y1 - ny * 0.3)} L${px(x0 - nx)} ${py(y0 - ny)} Z `
  }
  // limbs from the trunk into the crown
  d += limb(-52, 196, -34, 240, 6)
  d += limb(-110, 222, -250, 246, 6)
  d += limb(-80, 210, -160, 262, 5)
  // the crown: a wind-cut thorn, not a parasol. A dense wedge, low and clipped on the weather side
  // (right), rising and thickening downwind, its underside hanging down towards the trunk; ragged tufts
  // streaming off its lee end.
  const crown: Array<[number, number, number, number]> = [
    [-40, 238, 30, 26], [-70, 226, 34, 30], [-100, 250, 46, 38], [-140, 236, 44, 36], [-160, 272, 52, 36],
    [-200, 250, 48, 34], [-120, 288, 46, 28], [-220, 284, 44, 28], [-250, 262, 40, 26], [-280, 278, 34, 20],
    [-306, 262, 26, 16], [-60, 262, 34, 24], [-186, 214, 38, 22], [-234, 230, 34, 20],
    // hanging down the lee side, so the crown sweeps towards the ground instead of capping a bare pole
    [-150, 196, 40, 30], [-196, 186, 36, 28], [-236, 198, 32, 24], [-120, 206, 34, 26],
  ]
  for (const [cx, cy, rx, ry] of crown) d += `${blob(x + cx * k, base - cy * k, rx * k, ry * k, r)} `
  return d
}

export const moor: Draw = (id) => {
  const r = rng(801)
  // the rise the stones stand on (its top almost flat), the ground falling away and rising again on the right
  const plateau = (x: number) => 1 / (1 + ((x - 610) / 300) ** 4)
  const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
  const hill = terrain((x) => 768 - 170 * plateau(x) - 52 * smooth(900, 1640, x) + 5 * Math.sin(x / 61) * (1 - plateau(x)))
  // the wall: its foot running from the left foreground up to the right, smaller as it recedes
  const wallFoot = (x: number) => 846 - 112 * ((x + 40) / 1680) + 4 * Math.sin(x / 90)
  const wallH = (x: number) => 36 - 20 * ((x + 40) / 1680)
  const gate: [number, number] = [968, 1004]
  let wallTop = ''
  let coping = ''
  const courses: string[] = []
  const wallPiece = (x1: number, x2: number) => {
    const pts: string[] = []
    for (let x = x1; x <= x2; x += 6) pts.push(`L${f(x)} ${f(wallFoot(x) - wallH(x) + (r() - 0.5) * 2.4)}`)
    pts.push(`L${f(x2)} ${f(wallFoot(x2) - wallH(x2))}`)
    wallTop += `M${f(x1)} ${f(wallFoot(x1) + 8)} ${pts.join(' ').replace(/^L/, 'L')} L${f(x2)} ${f(wallFoot(x2) + 8)} Z `
    // coping stones set on edge along the top, and the courses of stones in its face
    for (let x = x1 + 1; x < x2 - 8; ) {
      const k = wallH(x) / 36
      const w = (6 + r() * 7) * k
      const hh = (2 + r() * 4) * k
      const y = Math.max(wallFoot(x) - wallH(x), wallFoot(x + w) - wallH(x + w))
      coping += `M${f(x)} ${f(y + 3)} Q${f(x)} ${f(y - hh)} ${f(x + w / 2)} ${f(y - hh)} Q${f(x + w)} ${f(y - hh)} ${f(x + w)} ${f(y + 3)} Z `
      x += w * (0.75 + r() * 0.2)
    }
    for (let x = x1 + 4; x < x2 - 10; x += 10 + r() * 14) {
      const k = wallH(x) / 30
      const y = wallFoot(x) - wallH(x) * (0.25 + r() * 0.55)
      courses.push(`M${f(x)} ${f(y)} h${f((6 + r() * 8) * k)} v${f(3.5 * k)} h${f(-(6 + r() * 8) * k)} Z`)
    }
  }
  wallPiece(-40, gate[0])
  wallPiece(gate[1], W + 40)
  // gateposts either side of the gap
  const post = (x: number) => `M${f(x - 4)} ${f(wallFoot(x) + 8)} V${f(wallFoot(x) - wallH(x) - 12)} h8 V${f(wallFoot(x) + 8)} Z`
  // the ring: stones on an ellipse round the top of the rise, the back ones smaller and higher
  const ring = Array.from({ length: 13 }, (_, i) => {
    const a = (i / 13) * Math.PI * 2 + 0.3
    const s = Math.sin(a)
    const x = 610 + 190 * Math.cos(a)
    const y = 640 + 30 * s
    const k = 0.72 + 0.28 * (s + 1) / 2
    return { x, y, s, h: (56 + r() * 56) * k, w: (26 + r() * 20) * k, i }
  }).filter((st) => st.i !== 4 && st.i !== 9)
  const stones = ring.sort((a, b) => a.s - b.s).map((st) => ({ ...st, ...menhir(st.x, st.y, st.h, st.w, r, st.i === 7 ? -0.12 : 0) }))
  const front = stones.find((st) => st.i === 3)!
  const far = ridgeAt(690, 30, 802)
  const farm = 1084
  const fy = far(farm) + 4
  const near = terrain((x) => 872 + 6 * Math.sin(x / 70) - 84 * Math.exp(-(((x - 1350) / 230) ** 2)))
  const treeBase = near.at(1350) + 4
  return (
    <>
      <Layer depth="far">
        <Moon x={1250} y={170} r={42} id={id} />
        <P d={ridge(640, 34, 803, 30)} fill="var(--sil-haze)" />
        <P d={ridge(690, 30, 802)} />
        {/* the farmhouse, its barn and a windbreak of trees, far off on the hills */}
        <P data-ground d={`M${farm} ${fy} V${fy - 22} H${farm + 34} V${fy} Z M${farm + 34} ${fy} V${fy - 14} H${farm + 64} V${fy} Z`} />
        <P d={`M${farm - 4} ${fy - 20} L${farm + 17} ${fy - 36} L${farm + 38} ${fy - 20} Z M${farm + 32} ${fy - 13} L${farm + 49} ${fy - 24} L${farm + 66} ${fy - 13} Z M${farm + 24} ${fy - 26} v-14 h5 v14 Z`} />
        <P d={`${blob(farm - 22, fy - 22, 16, 14, r)} M${farm - 24} ${fy + 2} V${fy - 14} h4 V${fy + 2} Z ${blob(farm - 42, fy - 16, 12, 11, r)} M${farm - 44} ${fy + 2} V${fy - 10} h3 V${fy + 2} Z`} />
      </Layer>
      <Layer depth="lit-far">
        <g className="scr-glow">
          <Halo id={`${id}-halo`} x={farm + 12} y={fy - 10} r={46} o={0.8} />
          <P d={`M${farm + 8} ${fy - 14} h7 v8 h-7 Z`} />
        </g>
      </Layer>
      <Layer depth="mid">
        <P d={hill.d} />
        {/* heather over the rise and the fields */}
        <P d={heather(hill.at, 804, -40, W + 40, 0.6)} data-ground="each" />
        {/* one stone fallen long ago, lying in the grass at the edge of the ring */}
        <P d="M452 668 Q446 656 462 651 L526 646 Q538 650 536 662 Z" fill="var(--sil-near)" />
        <P d={heather(() => 666, 808, 444, 540, 0.5)} data-ground="each" />
        {/* the stones, back ones first, each with its moonlit face and edge, heather round its foot */}
        {stones.map((st) => (
          <g key={st.i}>
            <P d={st.body} fill="var(--sil-near)" />
            <P d={st.face} fill="var(--moon)" opacity={0.08} />
            <path d={st.edge} className="scr-rim" strokeWidth={2} />
            <P d={heather(() => st.y + 1, 810 + st.i, st.x - st.w * 0.75, st.x + st.w * 0.6, 0.5)} data-ground="each" />
          </g>
        ))}
        <P d={crow(front.peak[0], front.peak[1] + 1, 0.9)} fill="var(--sil-near)" />
        {/* the dry-stone wall and its gateway */}
        <P data-ground d={`${wallTop} ${post(gate[0] - 2)} ${post(gate[1] + 2)}`} fill="var(--sil-near)" />
        <P d={coping} fill="var(--sil-near)" />
        {/* grass along its foot */}
        <P d={grass((x) => wallFoot(x) + 5, 809, -40, W + 40, 9)} data-ground="each" />
        <P d={courses.join(' ')} fill="var(--sil-back)" opacity={0.4} />
      </Layer>
      <Layer depth="near">
        <P d={near.d} />
        <P d={bentTree(1350, treeBase, 1.05, 805)} />
        <P d={heather(near.at, 806, -40, W + 40, 1.4)} data-ground="each" />
        <P d={grass(near.at, 807, -40, W + 40, 20)} data-ground="each" />
      </Layer>
    </>
  )
}
