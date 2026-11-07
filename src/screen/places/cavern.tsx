// Drawn décor: cavern. A natural cave seen from inside (always at night, like the crypt): a ring of
// rough rock framing a great chamber, stalactites hanging from its roof, an underground lake, a narrow
// ledge along the left wall with a torch wedged in a crack above strange carvings, a fissure in the back
// wall letting in a thread of pale light, a lantern left on a rock shelf in the foreground.
// See the decor-artist skill.
import { type Draw, Halo, Layer, P, f, ridgeAt, rng } from '../placeKit'

type Pt = [number, number]

/** A rough line through the points: each segment broken into small random steps (rock edges). */
function rough(points: Pt[], seed: number, j = 10): Pt[] {
  const r = rng(seed)
  const out: Pt[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 24))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const d = k === n ? 0 : j
      out.push([x0 + (x1 - x0) * t + (r() - 0.5) * d, y0 + (y1 - y0) * t + (r() - 0.5) * d])
    }
  }
  return out
}
const line = (p: Pt[]) => p.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')
const poly = (p: Pt[]) => `M${line(p)} Z`
/** An open stroke along some of a shape's own points (a lit edge that follows it exactly). */
const edge = (p: Pt[], from: number, to: number) => `M${line(p.slice(from, to + 1))}`

/** A stalactite hanging from y (its root, inside the rock), tip at y + h. */
const stalactite = (x: number, y: number, w: number, h: number) =>
  `M${f(x - w / 2)} ${f(y)} Q${f(x - w * 0.18)} ${f(y + h * 0.55)} ${f(x - 1)} ${f(y + h)} L${f(x + 1)} ${f(y + h)} Q${f(x + w * 0.22)} ${f(y + h * 0.5)} ${f(x + w / 2)} ${f(y)} Z`
/** A stalagmite standing on y (its foot): a lumpy cone, its two sides as points (for lit edges that follow it). */
function cone(x: number, y: number, w: number, h: number, seed: number): { left: Pt[]; right: Pt[] } {
  const r = rng(seed)
  const left: Pt[] = []
  const right: Pt[] = []
  const n = Math.max(4, Math.round(h / 16))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    // tapering, with a bulge or two of flowstone, a blunt rounded tip
    const half = (w / 2) * ((1 - t) ** 0.75 * (0.9 + 0.2 * r()) + (i === n ? 0.12 : 0))
    left.push([x - half, y - h * t])
    right.unshift([x + half, y - h * t + (i === n ? 0 : (r() - 0.5) * 2)])
  }
  right.push([x + w / 2, y])
  right.shift()
  return { left, right: [[x + w * 0.06, y - h], ...right] }
}
const stalagmite = (x: number, y: number, w: number, h: number, seed: number) => {
  const { left, right } = cone(x, y, w, h, seed)
  return poly([...left, ...right])
}
/** The same shape mirrored under the waterline y (a reflection). */
const mirrored = (x: number, y: number, w: number, h: number) =>
  `M${f(x - w / 2)} ${f(y)} Q${f(x - w * 0.24)} ${f(y + h * 0.5)} ${f(x)} ${f(y + h)} Q${f(x + w * 0.26)} ${f(y + h * 0.5)} ${f(x + w / 2)} ${f(y)} Z`

export const cavern: Draw = (id) => {
  // The chamber's roof (mid): its lower edge, rolling.
  const ceil = ridgeAt(196, 60, 171)
  let roof = `M-80 -10 L-80 ${f(ceil(-80))}`
  for (let x = -60; x <= 1680; x += 20) roof += ` L${x} ${f(ceil(x))}`
  roof += ' L1680 -10 Z'
  const drips: Array<[number, number, number]> = [[480, 26, 80], [536, 16, 44], [600, 30, 110], [790, 22, 64], [840, 34, 130], [960, 26, 96], [1010, 18, 48], [1066, 30, 104]]
  const roofDrips = drips.map(([x, w, h]) => stalactite(x, ceil(x) - 12, w, h)).join(' ')

  // The left wall, the ledge along it, the cliff under the ledge down to the water.
  const wallFace = rough([[440, ceil(440) - 20], [470, 290], [520, 390], [556, 470], [578, 560]], 172, 12)
  const leftWall = poly([[-80, -10], [440, -10], ...wallFace, [590, 578], [597, 593], [604, 614], [-80, 884]])
  // The ledge narrows as it runs back to where the wall meets the far shore.
  const front = (x: number) => 578 + ((590 - x) * (790 - 578)) / 670
  const ledgeTop = `M578 560 L590 578 L-80 790 L-80 735 Z`
  const cliff = `M590 578 L597 593 L604 614 L-80 884 L-80 790 Z`
  // The right wall, its foot in the water.
  const rightFace = rough([[1130, ceil(1130) - 20], [1110, 290], [1088, 390], [1062, 480], [1040, 560], [1030, 604]], 173, 12)
  const rightWall = poly([[1680, -10], [1130, -10], ...rightFace, [1080, 640], [1260, 712], [1460, 770], [1680, 820]])

  // The column (a stalactite grown into its stalagmite) and the stalagmites standing in the lake.
  const colTop = ceil(700) - 14
  const colL = rough([[656, colTop], [672, 250], [688, 330], [682, 390], [692, 450], [684, 520], [674, 592], [652, 666]], 187, 5)
  const colR = rough([[748, 666], [730, 592], [718, 520], [714, 450], [720, 400], [712, 340], [724, 262], [744, colTop]], 188, 5)
  const column = poly([...colL, ...colR])
  const mites: Array<[number, number, number, number]> = [[618, 668, 36, 46], [646, 664, 22, 26], [996, 668, 72, 128], [1042, 660, 30, 40]]
  const tall = cone(996, 668, 72, 128, 3)

  // Strata on the back wall: thin wavy bands, thicker in the middle.
  const strata = ([[300, 240, 1420, 10], [420, 200, 1440, 8], [520, 240, 1420, 7]] as const).map(([y, x1, x2, t], i) => {
    const at = ridgeAt(y, 26, 190 + i, 40)
    const top: Pt[] = []
    const bottom: Pt[] = []
    for (let x = x1; x <= x2; x += 40) {
      const k = Math.sin((Math.PI * (x - x1)) / (x2 - x1))
      top.push([x, at(x) - t * k * 0.5])
      bottom.unshift([x, at(x) + t * k * 0.5])
    }
    return poly([...top, ...bottom])
  }).join(' ')

  // The fissure in the back wall.
  const cx = 930
  const lips = rough([[cx - 8, 196], [cx + 6, 250], [cx, 330], [cx + 12, 400], [cx + 5, 462], [cx - 5, 462], [cx - 12, 400], [cx - 20, 330], [cx - 14, 250]], 180, 3)
  const crack = rough([[cx - 4, 214], [cx + 1, 260], [cx - 4, 330], [cx + 5, 400], [cx + 1, 456], [cx - 2, 456], [cx - 7, 400], [cx - 13, 330], [cx - 7, 260]], 182, 2)

  // Ripples on the lake, catching the light.
  const r = rng(174)
  let ripples = ''
  for (let i = 0; i < 40; i++) {
    const y = 620 + r() ** 1.4 * 270
    const len = 8 + r() * 46 * ((y - 600) / 290)
    ripples += `M${f(200 + r() * 1200)} ${f(y)} h${f(len)} v1.2 h${f(-len)} Z `
  }
  const streak = (x: number, y0: number, y1: number, w: number, seed: number) => {
    const q = rng(seed)
    let d = ''
    for (let y = y0; y < y1; y += 6 + q() * 6) {
      const k = w * (0.4 + q() * 0.8) * (0.6 + ((y - y0) / (y1 - y0)) * 0.8)
      d += `M${f(x - k / 2 + (q() - 0.5) * w * 0.6)} ${f(y)} h${f(k)} v2 h${f(-k)} Z `
    }
    return d
  }

  // The near ring of rock: everything but a great irregular opening.
  const q = rng(175)
  const mouth: Pt[] = [[150, 910], [168, 780], [128, 650], [104, 560]]
  for (let a = Math.PI * 0.97; a > 0.03; a -= 0.06) {
    mouth.push([800 + 700 * Math.cos(a) + (q() - 0.5) * 18, 560 - 440 * Math.sin(a) + (q() - 0.5) * 14])
  }
  mouth.push([1496, 560], [1470, 660], [1488, 790], [1460, 910])
  const topAt = (x: number) => 560 - 440 * Math.sqrt(Math.max(0, 1 - ((x - 800) / 700) ** 2))
  const nearDrips = ([[250, 34, 110], [320, 22, 64], [420, 40, 180], [500, 18, 56], [1110, 26, 84], [1190, 44, 200], [1270, 20, 60], [1350, 30, 100]] as const)
    .map(([x, w, h]) => stalactite(x, topAt(x) - 30, w, h)).join(' ')
  const shelf = rough([[1170, 910], [1186, 842], [1240, 812], [1330, 804], [1420, 806], [1520, 798], [1700, 790], [1700, 910]], 176, 6)
  const stoneA = rough([[250, 910], [262, 850], [300, 812], [380, 796], [460, 806], [520, 838], [548, 910]], 177, 6)
  const stoneB = rough([[640, 910], [652, 872], [700, 852], [760, 858], [800, 884], [808, 910]], 178, 5)

  return (
    <>
      <Layer depth="far">
        {/* the back wall of the chamber, its strata, the way on (a dark passage), the shore rocks */}
        <P d="M-80 -10 H1680 V900 H-80 Z" />
        <P d="M-80 -10 H1680 V900 H-80 Z" fill="var(--lit)" opacity={0.07} />
        <P d={strata} fill="var(--sil-back)" opacity={0.25} />
        {/* stalagmites on the far shore */}
        <P d={`${stalagmite(812, 604, 50, 86, 21)} ${stalagmite(850, 602, 22, 34, 22)} ${stalagmite(1168, 602, 26, 44, 23)} ${stalagmite(440, 604, 30, 40, 24)}`} fill="var(--sil-back)" />
        {/* the fissure's dark lips */}
        <P d={poly(lips)} fill="var(--sil-back)" />
        <P d={poly(rough([[-80, 620], [-80, 600], [180, 594], [420, 602], [620, 590], [840, 600], [1000, 592], [1200, 600], [1420, 590], [1680, 598], [1680, 620]], 181, 6))} fill="var(--sil-mid)" opacity={0.8} />
        {/* the lake, holding the wall's light far off, a pale line where it meets the shore */}
        <P d="M-80 614 H1680 V900 H-80 Z" fill="var(--sil-back)" />
        <P d="M-80 614 H1680 V900 H-80 Z" fill={`url(#${id}-sheen)`} opacity={0.35} />
        <P d="M-80 613 H1680 v2.5 H-80 Z" fill="var(--sil-haze)" opacity={0.5} />
      </Layer>
      <Layer depth="lit-far">
        {/* the thread of pale light in the fissure, its glow on the wall, spilling down onto the water */}
        <circle cx={cx} cy={340} r={320} fill={`url(#${id}-moon)`} />
        <P d={poly(crack)} fill="var(--moon)" opacity={0.38} />
        <P d={`M${cx - 10} 300 L${cx + 6} 300 L${cx + 50} 612 L${cx - 52} 612 Z`} fill={`url(#${id}-shaft)`} filter={`url(#${id}-soft)`} />
        <ellipse cx={cx} cy={626} rx={170} ry={20} fill={`url(#${id}-moon)`} />
        {/* its broken reflection, drifting with it (in the water layer it slid away from the fissure) */}
        <P d={streak(cx, 636, 860, 34, 183)} fill="var(--moon)" opacity={0.3} />
      </Layer>
      <Layer depth="water">
        <P d={ripples} opacity={0.1} />
        <g className="scr-glow">
          <P d={streak(566, 640, 800, 22, 184)} opacity={0.4} />
        </g>
      </Layer>
      <Layer depth="mid">
        {/* the left wall, the ledge running back along it (lit from above), the cliff under it */}
        <P d={leftWall} />
        <P d={ledgeTop} fill="var(--sil-back)" opacity={0.8} />
        <P d={cliff} fill="var(--sil-near)" opacity={0.45} />
        {/* carvings on the wall above the ledge: cut into the rock, catching the torch */}
        <g fill="none" stroke="var(--sil-near)" strokeWidth={5} strokeLinecap="round" opacity={0.55}>
          <path d="M380 440 a16 16 0 1 1 -16 -16 a26 26 0 1 1 -26 26 a36 36 0 1 1 36 36 M440 500 q14 -22 28 0 q14 22 28 0 M290 530 l20 -30 l20 30 l20 -30 M470 400 a10 6 0 1 0 0.1 0" />
        </g>
        <g className="scr-rim scr-rim-lamp" strokeWidth={1.6}>
          <path d="M380 440 a16 16 0 1 1 -16 -16 a26 26 0 1 1 -26 26 a36 36 0 1 1 36 36 M440 500 q14 -22 28 0 q14 22 28 0 M290 530 l20 -30 l20 30 l20 -30 M470 400 a10 6 0 1 0 0.1 0" />
          <path d={`M590 578 L200 ${f(front(200))}`} strokeWidth={2} />
          <path d={edge(wallFace, Math.floor(wallFace.length / 2), wallFace.length - 1)} strokeWidth={2} />
        </g>
        {/* the torch, wedged in a crack */}
        <P d="M530 532 L548 480 l6 2 L537 534 Z" fill="var(--sil-near)" />
        <P d="M543 486 l14 4 l-2 7 l-14 -4 Z" fill="var(--sil-near)" />
        {/* the right wall */}
        <P d={rightWall} />
        <g className="scr-rim" strokeWidth={1.6}>
          <path d={edge(rightFace, 2, rightFace.length - 1)} />
        </g>
        {/* the column and the stalagmites, standing in the lake, mirrored in it */}
        <P d={column} />
        <P d={mites.map(([x, y, w, h], i) => stalagmite(x, y, w, h, i + 1)).join(' ')} />
        <P d={`M652 666 Q676 720 690 780 H712 Q726 720 748 666 Z ${mites.map(([x, y, w, h]) => mirrored(x, y, w, h * 0.6)).join(' ')}`} fill="var(--sil-near)" opacity={0.3} />
        <g className="scr-rim" strokeWidth={1.6}>
          <path d={`${edge(colR, 0, colR.length - 1)} ${edge(tall.left, 0, tall.left.length - 1)}`} />
        </g>
        <g className="scr-rim scr-rim-lamp" strokeWidth={1.6}>
          <path d={edge(colL, 0, colL.length - 1)} />
        </g>
        {/* the roof and its stalactites, last: the column and the walls' lit edges run up into it */}
        <P d={roof} />
        <P d={roofDrips} />
      </Layer>
      <Layer depth="pulse-mid">
        <Halo id={`${id}-halo`} x={552} y={470} r={230} />
        <P d="M542 490 q-12 -20 0 -42 q3 14 8 11 q0 -17 12 -28 q6 25 0 36 q8 -3 6 11 q-3 12 -14 12 Z" />
      </Layer>
      <Layer depth="near">
        {/* the ring of rock around us, its stalactites, the stones in the water, the shelf with the lantern */}
        <P d={`M-80 -10 H1680 V910 H-80 Z M${line(rough(mouth, 186, 10))} Z`} fillRule="evenodd" />
        <P d={nearDrips} />
        {/* faces of the near rock, a little lighter where they turn to the chamber */}
        <P d={`${poly(rough([[20, 600], [70, 570], [96, 640], [110, 760], [70, 840], [30, 760]], 191, 8))} ${poly(rough([[1530, 600], [1560, 640], [1590, 760], [1560, 820], [1520, 720]], 192, 8))} ${poly(rough([[560, 40], [700, 22], [860, 30], [960, 52], [820, 70], [660, 66]], 193, 6))}`} fill="var(--sil-mid)" opacity={0.3} />
        <P d={`${poly(stoneA)} ${poly(stoneB)}`} />
        {/* the shelf, a shade lighter than the ring: lit by its lantern (dark, the lantern stood on nothing) */}
        <P d={poly(shelf)} fill="var(--sil-mid)" />
        <P d={`${stalagmite(1480, 806, 30, 64, 11)} ${stalagmite(1512, 804, 20, 34, 12)}`} />
        {/* the lantern: base, posts, cap, handle */}
        <P d="M1222 812 h52 v-7 h-52 Z M1226 806 v-44 h5 v44 Z M1265 806 v-44 h5 v44 Z M1220 764 h56 l-10 -14 h-36 Z M1242 751 v-7 h12 v7 Z" />
        <path d="M1236 746 q12 -22 24 0" fill="none" stroke="currentColor" strokeWidth={3} />
        <g className="scr-rim scr-rim-lamp" strokeWidth={2}>
          <path d={edge(shelf, 3, 12)} />
        </g>
        <g className="scr-rim" strokeWidth={1.6}>
          <path d={`${edge(stoneA, 2, 9)} ${edge(stoneB, 2, 5)}`} />
        </g>
      </Layer>
      <Layer depth="pulse">
        <Halo id={`${id}-halo`} x={1248} y={784} r={220} />
        <P d="M1231 806 h34 v-42 h-34 Z" />
      </Layer>
    </>
  )
}
