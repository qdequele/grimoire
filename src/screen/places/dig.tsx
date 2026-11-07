// Drawn décor: dig. An archaeological dig in the desert: dunes, the front of a ruined temple half
// buried in sand (a colonnade, a broken pediment, the dark doorway being dug out), the camp's canvas
// tents (one lit from within), crates and a surveyor's tripod, palms at an oasis far off; in front, a
// trench with a ladder and planks, the string grid over it, a sieve and the spoil heap, a lantern on a
// crook, a fallen column drum. Daytime by default (the dust preset); lights at dusk and night.
// See the decor-artist skill.
import { type Draw, H, Halo, Layer, Moon, P, W, f, grass, rng } from '../placeKit'

/** Dune heights at x: sharp crests, smooth troughs (seeded). Same arguments as `dunes` to stand things on it. */
function duneAt(base: number, amp: number, seed: number): (x: number) => number {
  const r = rng(seed)
  const p = [r() * 6, r() * 6, r() * 6]
  const w = 180 + r() * 120
  return (x) => base - amp * (0.75 * (1 - Math.abs(Math.sin(x / w + p[0]))) ** 1.6 + 0.25 * Math.sin(x / 97 + p[1]) + 0.12 * Math.sin(x / 41 + p[2]))
}

function dunes(base: number, amp: number, seed: number): string {
  const y = duneAt(base, amp, seed)
  let d = `M-40 ${H} L-40 ${f(y(-40))}`
  for (let x = -40; x <= W + 40; x += 8) d += ` L${x} ${f(y(x))}`
  return `${d} L${W + 40} ${H} Z`
}

/** A date palm: a curving trunk and a full crown of long drooping fronds, its foot at x, y. */
function palm(x: number, y: number, h: number, lean: number, r: () => number): string {
  const tx = x + lean
  const ty = y - h
  let d = `M${f(x - 4)} ${f(y + 4)} Q${f(x - 3 + lean * 0.2)} ${f(y - h * 0.5)} ${f(tx - 1.8)} ${f(ty + 2)} L${f(tx + 1.8)} ${f(ty + 2)} Q${f(x + 3 + lean * 0.2)} ${f(y - h * 0.5)} ${f(x + 4)} ${f(y + 4)} Z `
  // the crown's heart, holding the fronds together
  d += `M${f(tx - 5)} ${f(ty + 2)} a5 4 0 1 0 10 0 a5 4 0 1 0 -10 0 Z `
  const n = 11
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.98 + (i / (n - 1)) * Math.PI * 0.96 + (r() - 0.5) * 0.18
    const len = h * (0.42 + r() * 0.16)
    const up = Math.sin(a) // -1 straight up, 0 sideways
    // the frond rises a little, then droops: tips of the side fronds hang well below the crown
    const ex = tx + Math.cos(a) * len
    const ey = ty + up * len * 0.35 + len * 0.42 * (1 + up * 0.6)
    const mx = tx + Math.cos(a) * len * 0.5
    const my = ty + up * len * 0.45
    const wdt = len * 0.1
    d += `M${f(tx)} ${f(ty - 1)} Q${f(mx)} ${f(my - wdt)} ${f(ex)} ${f(ey)} Q${f(mx)} ${f(my + wdt)} ${f(tx)} ${f(ty + 3)} Z `
  }
  return d
}

/** A column: shaft (with a little taper), echinus and abacus; `broken` cuts it with a jagged top. */
function column(x: number, top: number, w: number, broken = false): string {
  const bottom = 830
  const t = w * 0.06
  if (broken) {
    return `M${f(x - w / 2)} ${bottom} L${f(x - w / 2 + t)} ${f(top + 6)} L${f(x - w * 0.2)} ${f(top - 4)} L${f(x)} ${f(top + 8)} L${f(x + w * 0.18)} ${f(top)} L${f(x + w / 2 - t)} ${f(top + 10)} L${f(x + w / 2)} ${bottom} Z`
  }
  return `M${f(x - w / 2)} ${bottom} L${f(x - w / 2 + t)} ${f(top + 16)} H${f(x + w / 2 - t)} L${f(x + w / 2)} ${bottom} Z M${f(x - w / 2 - 2)} ${f(top + 18)} Q${f(x)} ${f(top + 24)} ${f(x + w / 2 + 2)} ${f(top + 18)} L${f(x + w / 2 + 6)} ${f(top + 8)} H${f(x - w / 2 - 6)} Z M${f(x - w / 2 - 8)} ${f(top + 9)} V${f(top)} H${f(x + w / 2 + 8)} V${f(top + 9)} Z`
}

export const dig: Draw = (id) => {
  const r = rng(91)
  const farAt = duneAt(722, 26, 92)
  const midAt = duneAt(800, 16, 93)
  const nearAt = duneAt(836, 10, 94)

  // ---- the temple front: the ruined cella wall and its doorway, six columns (a wider bay at the door,
  // the two last broken), the entablature over the first four, the left half of the pediment
  const cols = [600, 680, 800, 880, 960, 1040]
  const colW = 34
  const tops = [500, 500, 500, 500, 640, 716]
  const fluting = cols
    .map((x, i) => {
      const top = tops[i] + (i < 4 ? 26 : 14)
      return [-8, 0, 8].map((dx) => `M${x + dx} ${top} V${830}`).join(' ')
    })
    .join(' ')
  const entablature = 'M570 500 V470 H910 V500 Z M564 472 V456 H916 V472 Z M558 458 V448 H922 V458 Z'
  const pediment = 'M558 450 L725 380 L740 392 L732 404 L750 412 L742 428 L760 436 L756 450 Z'
  // the cella wall's top, broken down in steps to the right
  // the broken edge, from the top of the wall down to the sand: (x, y) points, y going down
  const edge: Array<[number, number]> = [[906, 496], [906, 510], [912, 526], [928, 530], [933, 556], [949, 563], [952, 602], [969, 608], [975, 646], [990, 655], [995, 704], [1000, 716]]
  const cella = `M606 830 V496 ${edge.map(([x, y]) => `L${x} ${y}`).join(' ')} V830 Z`
  const wallRight = (y: number) => {
    for (let i = 1; i < edge.length; i++) {
      const [x0, y0] = edge[i - 1]
      const [x1, y1] = edge[i]
      if (y <= y1) return x0 + ((x1 - x0) * (y - y0)) / Math.max(1, y1 - y0)
    }
    return 1000
  }
  const courseYs = [560, 600, 640, 680, 720, 760, 800]
  const courses = courseYs
    .map((y, i) => {
      const right = wallRight(y)
      // the course's line, and the joints between its blocks (staggered course to course)
      let d = `M606 ${y} H${right - 2} v2.4 H606 Z`
      const above = i === 0 ? 516 : courseYs[i - 1] + 2.4
      for (let x = 640 + (i % 2) * 34; x < wallRight(above) - 10; x += 68) d += ` M${x} ${f(above)} V${y} h2 V${f(above)} Z`
      return d
    })
    .join(' ')

  // ---- the camp: the lit tent (front and its side running back), a smaller tent, crates
  const tentA = 'M1172 808 L1262 682 L1352 808 Z'
  const tentASide = 'M1262 682 L1334 670 L1430 800 L1352 808 Z'
  const doorA = 'M1240 808 L1262 726 L1284 808 Z'
  const tentB = 'M1400 808 L1452 734 L1504 808 Z'
  const tentBSide = 'M1452 734 L1494 728 L1530 802 L1504 808 Z'

  // ---- palms at the oasis on the far dunes, low bushes at their feet
  const palms = [
    [140, 92, -12],
    [178, 118, 10],
    [212, 80, 16],
    [256, 104, -8],
  ]
    .map(([x, h, lean]) => palm(x, farAt(x) + 3, h, lean, r))
    .join(' ')
  const bushes = [110, 196, 290].map((x) => `M${x - 26} ${f(farAt(x) + 5)} Q${x - 20} ${f(farAt(x) - 9)} ${x} ${f(farAt(x) - 10)} Q${x + 20} ${f(farAt(x) - 9)} ${x + 26} ${f(farAt(x) + 5)} Z`).join(' ')
  // two kites wheeling high over the dig
  const kite = (x: number, y: number, s: number) => `M${x} ${y} q${8 * s} ${-7 * s} ${18 * s} ${-2 * s} q${-9 * s} ${-1 * s} ${-18 * s} ${5 * s} q${-9 * s} ${-6 * s} ${-18 * s} ${-5 * s} q${10 * s} ${-5 * s} ${18 * s} ${2 * s} Z`

  // ---- near: the trench (its far wall lit, its layers of earth), pegs and the string grid on its far edge
  const rim = 852
  const pegs = [350, 430, 510, 590, 670, 750]
  const strata = [858, 864, 869].map((y, i) => `M338 ${y} Q${450 + i * 20} ${y + 2} 560 ${y - 1} T782 ${y + 1} V${y + 1.8} Q${680 - i * 10} ${y + 3} 560 ${y + 0.8} T338 ${y + 1.6} Z`).join(' ')
  // the sieve: a frame tilted on its trestle, the mesh crossing inside it
  const sieve = (u: number, v: number) => [1036 + 90 * u + 4 * v, 806 - 36 * u + 22 * v] as const
  const pt = (u: number, v: number) => sieve(u, v).map(f).join(' ')
  const mesh = [
    ...Array.from({ length: 7 }, (_, i) => `M${pt((i + 1) / 8, 0)} L${pt((i + 1) / 8, 1)}`),
    ...Array.from({ length: 3 }, (_, i) => `M${pt(0, (i + 1) / 4)} L${pt(1, (i + 1) / 4)}`),
  ].join(' ')

  return (
    <>
      <Layer depth="far">
        <Moon x={1240} y={160} r={40} id={id} />
        <P data-free d={`${kite(1000, 250, 1.2)} ${kite(1080, 300, 0.9)}`} />
        <P d={dunes(650, 30, 95)} fill="var(--sil-haze)" />
        <P d={dunes(722, 26, 92)} />
        <P d={`${palms} ${bushes}`} />
      </Layer>
      <Layer depth="mid">
        {/* the cella wall behind the colonnade, in shadow, its stone courses, its dark doorway and lintel (its top and its
            left end hidden behind the entablature and the first column: a slot of sky between them read as a gap) */}
        <P d={cella} fill="var(--sil-back)" />
        <P d={courses} fill="var(--sil-mid)" opacity={0.25} />
        <P d="M712 830 V618 H768 V830 Z" fill="var(--sil-near)" />
        <P d="M702 620 V604 H778 V620 Z" />
        {/* the columns, their fluting, the entablature and the broken pediment */}
        <P d={cols.map((x, i) => column(x, tops[i], colW, i >= 4)).join(' ')} />
        <P d={fluting} stroke="var(--sil-near)" strokeWidth={1.4} fill="none" opacity={0.5} />
        <P d={`${entablature} ${pediment}`} />
        {/* the sand over everything, dug out in front of the doorway: the cut's sides catching the light */}
        <P d={dunes(800, 16, 93)} />
        <P d="M690 798 L710 840 H770 L790 798 Z" fill="var(--sil-near)" />
        <P d="M690 798 L710 840 H716 L698 798 Z M790 798 L770 840 H764 L782 798 Z" fill="var(--sil-back)" opacity={0.8} />
        {/* the surveyor's tripod and its instrument */}
        <P data-ground d="M499 712 L472 806 h4 L501 714 Z M501 712 L528 806 h-4 L499 714 Z M499 712 L502 808 h3 L502 712 Z" />
        <P d="M490 714 V700 H510 V714 Z M506 704 V698 H530 V704 Z M496 700 V694 h8 V700 Z" />
        {/* the camp: the lit tent and its side, the smaller tent, guy ropes, crates */}
        <P data-ground d={tentASide} fill="var(--sil-back)" />
        <P data-ground d={tentA} />
        <P d="M1260 684 V664 h4 V684 Z" />
        <P d={doorA} fill="var(--sil-near)" />
        <P data-ground d={tentBSide} fill="var(--sil-back)" />
        <P data-ground d={tentB} />
        <P d="M1262 668 L1150 808 M1262 668 L1372 808 M1452 738 L1388 808" stroke="currentColor" strokeWidth={1.4} fill="none" />
        <P data-ground d="M1090 808 V770 H1140 V808 Z M1136 808 V780 H1174 V808 Z M1100 772 V744 H1136 V772 Z" />
        <P d="M1090 788 H1140 v2 H1090 Z M1136 794 H1174 v2 H1136 Z M1100 757 H1136 v2 H1100 Z" fill="var(--sil-back)" opacity={0.6} />
        {/* light from the upper right on the edges facing it (down to the sand on each column: stopping short left
            an unlit foot, going on would draw the line over the sand) */}
        <g className="scr-rim" strokeWidth={2}>
          <path d={`${cols.map((x, i) => `M${x + colW / 2 - 2} ${tops[i] + (i < 4 ? 26 : 12)} L${f(x + colW / 2 - 0.4)} ${f(midAt(x + colW / 2) - 1)}`).join(' ')} M922 448 V458 M916 458 V472 M725 380 L740 392`} />
          <path d="M1262 682 L1334 670 L1430 800 M1452 734 L1494 728 L1530 802" />
        </g>
      </Layer>
      <Layer depth="lit">
        {/* the lamp in the tent: its canvas glowing, the door open on it */}
        <Halo id={`${id}-halo`} x={1262} y={780} r={160} o={0.55} />
        <P d={tentA} fill={`url(#${id}-glass)`} opacity={0.35} />
        <P d={doorA} fill={`url(#${id}-glass)`} />
        {/* a faint glow deep in the temple's doorway */}
        <P d="M712 830 V620 H768 V830 Z" fill={`url(#${id}-glass)`} opacity={0.14} />
      </Layer>
      <Layer depth="near">
        {/* a fallen column, half in the sand, its fluting (running out of the frame at both ends of the drift) */}
        <P d="M-60 862 V796 H200 V862 Z M200 796 a14 33 0 0 1 0 66 Z" />
        <P d="M-60 812 H200 M-60 828 H200" stroke="var(--sil-back)" strokeWidth={2} fill="none" opacity={0.5} />
        <P d={dunes(836, 10, 94)} />
        {/* the trench: its far wall, lit, with its layers of earth, below the sand's crest */}
        <P d={`M330 ${rim} H790 L780 872 H340 Z`} fill="var(--sil-back)" opacity={0.7} />
        <P d={strata} fill="var(--sil-near)" opacity={0.35} />
        <P d={`${pegs.map((x) => `M${x - 1.5} ${rim + 2} V${rim - 34} h3 V${rim + 2} Z`).join(' ')} M${pegs[0]} ${rim - 30} H${pegs[pegs.length - 1]} v1.4 H${pegs[0]} Z`} />
        {/* the ladder, up out of the trench; a plank across it */}
        <P d="M414 884 L436 784 h5 L420 884 Z M448 884 L470 784 h5 L454 884 Z" />
        <P d={Array.from({ length: 5 }, (_, i) => { const y = 870 - i * 20; const k = (884 - y) / 100; return `M${f(416 + 22 * k)} ${y} h${f(34)} v4 h${f(-34)} Z` }).join(' ')} />
        <P d={`M560 ${rim - 3} H600 L606 886 H554 Z`} />
        {/* the spoil heap, a shovel stuck in it; the sieve on its trestle */}
        <P data-ground d="M800 872 Q840 796 890 790 Q950 796 1000 872 Z" />
        <P d="M878 796 L868 726 h4 L882 796 Z M862 726 h16 v4 h-16 Z M878 796 l-6 14 l14 -2 Z" />
        <P data-ground d="M1036 868 L1048 818 h5 L1042 868 Z M1062 868 L1054 818 h-5 L1056 868 Z M1108 868 L1120 784 h5 L1114 868 Z M1134 868 L1126 784 h-5 L1128 868 Z" />
        <P d={`M${pt(0, 0)} L${pt(1, 0)} L${pt(1, 1)} L${pt(0, 1)} Z M${pt(0.05, 0.18)} L${pt(0.95, 0.18)} L${pt(0.95, 0.82)} L${pt(0.05, 0.82)} Z`} fillRule="evenodd" />
        <P d={mesh} stroke="currentColor" strokeWidth={1.2} fill="none" />
        {/* a wheelbarrow left by the tents */}
        <P data-ground d="M1338 824 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 Z" />
        <P d="M1352 824 L1366 800 H1440 L1452 790 h4 L1446 814 H1376 Z M1440 814 L1476 790 l3 4 L1446 820 Z M1410 814 L1404 842 h4 L1416 814 Z" />
        {/* the lantern on its crook */}
        <P data-ground d="M268 866 V706 h5 V866 Z" />
        <P d="M268 708 Q268 690 286 690 Q304 690 304 708 V716 h-4 V708 Q300 694 286 694 Q272 694 272 708 Z" />
        <P d="M301 716 V726 h2 V716 Z M294 726 h16 l-3 -6 h-10 Z M294 752 h16 v5 h-16 Z M295 726 h2 v26 h-2 Z M307 726 h2 v26 h-2 Z" />
        {/* dry tufts here and there */}
        <P d={`${grass(nearAt, 96, 1220, 1320, 14)} ${grass(nearAt, 97, 1420, 1480, 12)} ${grass(nearAt, 98, 236, 260, 12)}`} data-ground="each" />
        <g className="scr-rim" strokeWidth={2}>
          <path d="M200 796 a14 33 0 0 1 0 66 M890 790 Q950 796 1000 872 M340 884 H780" />
        </g>
      </Layer>
      <Layer depth="pulse">
        {/* the lantern's flame (off by day) */}
        <g className="scr-glow">
          <Halo id={`${id}-halo`} x={302} y={740} r={150} />
          <P d="M297 726 h10 v26 h-10 Z" />
        </g>
      </Layer>
    </>
  )
}
