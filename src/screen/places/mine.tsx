// Drawn décor: mine. A mine seen from outside at night: the timber headframe over the shaft with its
// sheave wheel and its back leg, the winding cable running down to the engine house and its chimney,
// a level track on a timber trestle coming out of a tunnel mouth in the hillside, tipping carts on it,
// the last one tipped over the spoil heap; a shed and a lamp in the foreground, hills and firs behind.
// See the decor-artist skill.
import { type Draw, Halo, Layer, Moon, P, arched, f, grass, ragPine, ridge, ridgeAt, rng } from '../placeKit'

type Pt = [number, number]
const line = (p: Pt[]) => p.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')
const poly = (p: Pt[]) => `M${line(p)} Z`

/** A rough line through the points: each segment broken into small random steps (rock, earth). */
function rough(points: Pt[], seed: number, j = 8): Pt[] {
  const q = rng(seed)
  const out: Pt[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 22))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const d = k === n ? 0 : j
      out.push([x0 + (x1 - x0) * t + (q() - 0.5) * d, y0 + (y1 - y0) * t + (q() - 0.5) * d])
    }
  }
  return out
}

const YARD = 784 // the mine yard (mid)
const TRACK = 638 // top of the trestle's rail

/** A cart's skip (the V-shaped body) and its chassis with two wheels on the rail, apart: a skip tips on its hinge. */
const cartSkip = (x: number) => `M${x - 26} ${TRACK - 36} h52 l-8 24 h-36 Z`
const cartChassis = (x: number) =>
  `M${x - 22} ${TRACK - 13} h44 v5 h-44 Z M${x - 18} ${TRACK - 4} a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z M${x + 8} ${TRACK - 4} a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z M${x - 16} ${TRACK - 9} h4 v5 h-4 Z M${x + 12} ${TRACK - 9} h4 v5 h-4 Z`

/** A tipping cart on the rail at x: a V-shaped skip on a small chassis, two wheels on the rail. */
const cart = (x: number) =>
  `M${x - 26} ${TRACK - 36} h52 l-8 24 h-36 Z M${x - 20} ${TRACK - 12} h40 v4 h-40 Z ` +
  `M${x - 18} ${TRACK - 4} a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z M${x + 8} ${TRACK - 4} a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z`

export const mine: Draw = (id) => {
  // The headframe: two legs tapering to the sheave platform, ties and cross braces between them.
  const L = (y: number) => 504 + ((YARD - y) / (YARD - 262)) * 46
  const R = (y: number) => 656 - ((YARD - y) / (YARD - 262)) * 46
  const ties = [330, 420, 510, 600, 690]
  const legs = `M499 ${YARD + 4} L545 262 H555 L509 ${YARD + 4} Z M651 ${YARD + 4} L605 262 H615 L661 ${YARD + 4} Z`
  const tieBars = ties.map((y) => `M${f(L(y) - 4)} ${y} H${f(R(y) + 4)} v6 H${f(L(y) - 4)} Z`).join(' ')
  const braces = ties.slice(0, -1).map((y1, i) => {
    const y2 = ties[i + 1]
    return `M${f(L(y1))} ${y1 + 6} L${f(R(y2))} ${y2 - 2} l0 4 L${f(L(y1))} ${y1 + 10} Z M${f(R(y1))} ${y1 + 6} L${f(L(y2))} ${y2 - 2} l0 4 L${f(R(y1))} ${y1 + 10} Z`
  }).join(' ')
  // The sheave wheel on its stand: rim, spokes, hub.
  const wx = 580
  const wy = 212
  const spokes = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 6
    const c = Math.cos(a)
    const s = Math.sin(a)
    return `M${f(wx - 36 * c - 1.4 * s)} ${f(wy - 36 * s + 1.4 * c)} L${f(wx + 36 * c - 1.4 * s)} ${f(wy + 36 * s + 1.4 * c)} L${f(wx + 36 * c + 1.4 * s)} ${f(wy + 36 * s - 1.4 * c)} L${f(wx - 36 * c + 1.4 * s)} ${f(wy - 36 * s - 1.4 * c)} Z`
  }).join(' ')

  // The hillside on the right, cut back where the tunnel goes in; firs along its top.
  const hill = rough([[1086, YARD + 6], [1136, 762], [1172, 722], [1190, 670], [1200, 610], [1214, 568], [1252, 548], [1304, 530], [1364, 504], [1432, 474], [1504, 452], [1584, 432], [1700, 414]], 407, 8)
  const top = hill.filter(([x]) => x >= 1214)
  const hillAt = (x: number) => {
    for (let i = 0; i < top.length - 1; i++) {
      const [x0, y0] = top[i]
      const [x1, y1] = top[i + 1]
      if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
    return top[top.length - 1][1]
  }
  const r = rng(401)
  const hillFirs = [1262, 1300, 1352, 1396, 1452, 1500, 1548, 1600, 1650].map((x) => ragPine(x, hillAt(x) + 10, 90 + r() * 70, 40 + r() * 18, r)).join(' ')
  // Small firs along the far ridge.
  const farAt = ridgeAt(690, 40, 403)
  const farFirs = Array.from({ length: 26 }, (_, i) => 20 + i * 62 + r() * 30).map((x) => ragPine(x, farAt(x) + 6, 30 + r() * 26, 14 + r() * 8, r)).join(' ')

  // The trestle: the rail and its stringer, legs down to the ground or the heap, cross braces.
  const trestleLegs = [904, 956, 1008, 1060, 1112, 1164].map((x) => `M${x - 4} ${TRACK + 8} h8 V${YARD + 4} h-8 Z`).join(' ')
  const trestleBraces = [904, 956, 1008, 1060, 1112].map((x) => `M${x} ${TRACK + 18} L${x + 52} ${TRACK + 92} v4 L${x} ${TRACK + 22} Z M${x + 52} ${TRACK + 18} L${x} ${TRACK + 92} v4 L${x + 52} ${TRACK + 22} Z`).join(' ')

  return (
    <>
      <Layer depth="far">
        <Moon x={980} y={170} r={38} id={id} />
        <P d={ridge(610, 110, 402, 30)} fill="var(--sil-haze)" />
        <P d={ridge(690, 40, 403)} />
        <P d={farFirs} />
      </Layer>
      <Layer depth="mid">
        {/* the yard */}
        <P d={ridge(YARD, 3, 404)} />
        {/* the engine house, its chimney, the winding cable from the wheel into its wall */}
        <P data-ground d={`M70 ${YARD + 6} V520 H330 V${YARD + 6} Z M56 524 L200 446 L344 524 Z M262 500 V252 h30 V500 Z M256 254 h42 v-10 h-42 Z`} />
        <P d={`M262 ${YARD + 6} V680 h48 V${YARD + 6} Z`} fill="var(--sil-near)" opacity={0.5} />
        <path d="M546 191 L329 543" stroke="currentColor" strokeWidth={3.5} fill="none" />
        {/* the headframe, its back leg, the platform, the wheel on its stand, the cage hanging in the shaft */}
        <P data-ground d={legs} />
        <P d={`${tieBars} ${braces}`} />
        <P data-ground d={`M562 262 L392 ${YARD + 4} H406 L574 262 Z`} />
        <P d="M524 266 h112 v-12 h-112 Z" />
        <P d={`M${wx - 40} ${wy} a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0 Z M${wx - 33} ${wy} a33 33 0 1 0 66 0 a33 33 0 1 0 -66 0 Z`} fillRule="evenodd" />
        <P d={`${spokes} M${wx - 7} ${wy} a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M${wx - 24} 256 L${wx - 3} ${wy} h6 L${wx + 24} 256 Z`} />
        <P d={`M${wx + 39} ${wy} h2.4 V520 h-2.4 Z M${wx + 22} 520 h40 v50 h-40 Z`} />
        {/* the shed over the shaft's mouth */}
        <P data-ground d={`M470 ${YARD + 6} V722 H704 V${YARD + 6} Z M458 726 L587 694 L716 726 Z`} />
        {/* the hillside, the tunnel mouth in it: timber posts and lintel, the dark inside */}
        <P d={`M${line(hill)} L1700 910 L1100 910 Z`} />
        <P d={hillFirs} />
        <P d={poly(rough([[1204, TRACK + 4], [1206, 594], [1222, 562], [1270, 550], [1314, 566], [1330, 604], [1326, TRACK + 4]], 408, 6))} fill="var(--sil-back)" opacity={0.35} />
        <P d={`M1232 ${TRACK + 2} V588 Q1258 576 1284 588 V${TRACK + 2} Z`} fill="var(--sil-near)" />
        <P d={`M1220 ${TRACK + 10} V568 h12 V${TRACK + 10} Z M1284 ${TRACK + 10} V568 h12 V${TRACK + 10} Z M1212 584 h92 v-12 h-92 Z`} fill="var(--sil-far)" />
        <P d="M1292 592 h18 v4 h-18 Z M1292 616 h18 v3 h-18 Z" fill="var(--sil-near)" />
        {/* the trestle (its feet in the heap or on the yard), the spoil heap, the track running out of the tunnel to the end over the heap */}
        <P d={`${trestleLegs} ${trestleBraces}`} />
        <P d="M708 790 Q790 724 846 680 Q880 656 914 678 Q1000 728 1100 790 Z" fill="var(--sil-far)" />
        <g fill="none" stroke="var(--sil-back)" strokeWidth={2} opacity={0.5}>
          <path d="M862 676 Q834 720 800 772 M898 674 Q918 720 948 780 M878 670 Q872 730 866 784 M940 694 Q990 740 1030 786" />
        </g>
        <P d={`M872 ${TRACK} H1220 v10 H872 Z`} />
        {/* the carts: two coming out; the last one's skip tipped over the heap on its hinge, its chassis and
            wheels still on the rail (the whole cart drawn tipped hung in the air past the trestle's end) */}
        <P d={`${cart(1030)} ${cart(1110)}`} />
        <P d={cartChassis(900)} />
        <P d={cartSkip(900)} transform={`translate(0 3) rotate(-32 ${900 - 18} ${TRACK - 12})`} />
        <g className="scr-rim" strokeWidth={2}>
          <path d={`M200 446 L344 524 M${wx} ${wy - 40} A40 40 0 0 1 ${wx + 40} ${wy} M914 678 Q1000 728 1100 790 M${line(top)} M872 ${TRACK} H1196`} />
        </g>
        {/* the tunnel's timbers and the rail into it, catching the lantern */}
        <g className="scr-rim scr-rim-lamp" strokeWidth={2}>
          <path d={`M1196 ${TRACK} H1220 M1296 ${TRACK + 10} V584 M1284 ${TRACK + 2} V588 M1232 588 Q1258 576 1284 588`} />
        </g>
      </Layer>
      <Layer depth="lit">
        {/* the engine house's windows, the shaft shed's window */}
        <P d={`${arched(98, 588, 30, 72)} ${arched(150, 588, 30, 72)} ${arched(202, 588, 30, 72)} M600 738 h22 v22 h-22 Z`} fill={`url(#${id}-glass)`} />
        <Halo id={`${id}-halo`} x={165} y={630} r={160} o={0.45} />
      </Layer>
      <Layer depth="pulse-mid">
        {/* the lantern on the tunnel's right post */}
        <g className="scr-glow">
          <Halo id={`${id}-halo`} x={1302} y={606} r={150} />
          <P d="M1294 598 h14 v18 h-14 Z" />
        </g>
      </Layer>
      <Layer depth="near">
        <P d={ridge(878, 10, 405)} />
        <P d={grass(ridgeAt(878, 10, 405), 406)} data-ground="each" />
        {/* a tool shed on the left, timber props stacked by it */}
        <P data-ground d="M40 896 V706 H270 V896 Z M26 710 L148 650 L284 710 Z" />
        <P d="M200 896 V790 h44 V896 Z" fill="var(--sil-mid)" opacity={0.5} />
        <P data-ground d="M276 896 V852 h120 V896 Z M286 852 V832 h100 V852 Z" />
        <g fill="var(--sil-mid)" opacity={0.6} transform="translate(100 0)">
          <path d="M184 874 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z M204 874 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z M224 874 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z M244 874 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z M264 874 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z M196 843 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M216 843 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M236 843 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M256 843 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z" />
        </g>
        {/* the lamp post on the right, its lantern hanging from the arm */}
        <P data-ground d="M1394 896 V560 h10 V896 Z M1384 896 l10 -30 h10 l10 30 Z M1398 566 h48 v5 h-48 Z M1438 571 h4 v10 h-4 Z M1426 581 h28 v6 h-28 Z M1428 621 h24 v6 h-24 Z M1429 587 h3 v34 h-3 Z M1448 587 h3 v34 h-3 Z" />
        <g className="scr-rim" strokeWidth={2}>
          <path d="M148 650 L284 710" />
        </g>
      </Layer>
      <Layer depth="lit-near">
        <P d="M120 760 h34 v30 h-34 Z" fill={`url(#${id}-glass)`} />
        <Halo id={`${id}-halo`} x={1440} y={604} r={200} />
        <P d="M1432 587 h16 v34 h-16 Z" />
      </Layer>
    </>
  )
}
