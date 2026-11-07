// Drawn décor: farm. An isolated farm at night: the farmhouse with its porch and one lit window upstairs,
// a big gambrel barn whose doors stand ajar on a thread of light, a silo, a windpump on its lattice
// tower, a dirt road between rail fences, and tall corn in the foreground with a scarecrow standing in it.
// See the decor-artist skill.
import { BareTree, type Draw, Halo, Layer, Moon, P, W, crow, f, grass, ridge, ridgeAt, rng } from '../placeKit'

/** A round-crowned tree (far windbreak): a short trunk and a crown of overlapping lobes. */
function leafy(x: number, base: number, h: number, w: number, r: () => number): string {
  const t = Math.max(1.5, w * 0.05)
  let d = `M${f(x - t)} ${f(base + 4)} V${f(base - h * 0.45)} H${f(x + t)} V${f(base + 4)} Z `
  const lobes = 4 + Math.floor(r() * 3)
  for (let i = 0; i < lobes; i++) {
    const cx = x + (r() - 0.5) * w * 0.55
    const cy = base - h * (0.5 + r() * 0.3)
    const rad = w * (0.22 + r() * 0.14)
    d += `M${f(cx - rad)} ${f(cy)} a${f(rad)} ${f(rad)} 0 1 0 ${f(rad * 2)} 0 a${f(rad)} ${f(rad)} 0 1 0 ${f(-rad * 2)} 0 Z `
  }
  // a top lobe, so every crown is rounded on top and joined to the trunk
  const rt = w * 0.3
  d += `M${f(x - rt)} ${f(base - h + rt)} a${f(rt)} ${f(rt)} 0 1 0 ${f(rt * 2)} 0 a${f(rt)} ${f(rt)} 0 1 0 ${f(-rt * 2)} 0 Z `
  d += `M${f(x - w * 0.3)} ${f(base - h * 0.45)} a${f(w * 0.3)} ${f(h * 0.25)} 0 1 0 ${f(w * 0.6)} 0 a${f(w * 0.3)} ${f(h * 0.25)} 0 1 0 ${f(-w * 0.6)} 0 Z `
  return d
}

/**
 * A field of tall corn from x1 to x2: a leafy mass under `top(x)`, stalks with leaves and tassels above
 * it. Its end by the road (`inner`, at x `xi` level with the tops) slants down and out like the road's
 * edge, and the last stalks there stand on the ground, whole.
 */
function cornField(x1: number, x2: number, top: (x: number) => number, inner: 'left' | 'right', xi: number, seed: number) {
  const r = rng(seed)
  const t0 = top(xi)
  const edge = (y: number) => xi + (inner === 'right' ? 1 : -1) * (y - t0) * 0.5
  const inMass = (x: number, y: number) => (inner === 'right' ? x <= edge(y) : x >= edge(y))
  // the mass of leaves, its top line a little ragged, its end slanting
  const mx1 = inner === 'left' ? xi : x1
  const mx2 = inner === 'left' ? x2 : xi
  let mass = inner === 'left' ? `M${f(edge(910))} 910 L${xi} ${f(t0 + 8)}` : `M${x1} 910`
  for (let x = mx1; x <= mx2; x += 6) mass += ` L${x} ${f(top(x) + 4 + r() * 14)}`
  mass += inner === 'right' ? ` L${xi} ${f(t0 + 8)} L${f(edge(910))} 910 Z` : ` L${x2} 910 Z`
  const stalks: string[] = []
  const leaves: string[] = []
  for (let x = x1 + 4; x < x2 - 2; ) {
    const t = top(x)
    const h = 40 + r() * 46
    const alone = !inMass(x, t + 40)
    const base = alone ? 900 : t + 40
    const tip = t - h
    const lean = (r() - 0.5) * 8
    stalks.push(`M${f(x - 2.4)} ${f(base)} L${f(x - 1 + lean)} ${f(tip)} L${f(x + 1 + lean)} ${f(tip)} L${f(x + 2.4)} ${f(base)} Z`)
    // the tassel: three thin spikes from the tip
    for (const a of [-0.5, 0, 0.45]) {
      const len = 10 + r() * 8
      const tx = x + lean
      leaves.push(`M${f(tx - 0.8)} ${f(tip + 1)} L${f(tx + Math.sin(a) * len)} ${f(tip - Math.cos(a) * len)} L${f(tx + 0.8)} ${f(tip + 1)} Z`)
    }
    // drooping leaves on alternate sides, starting on the stalk (more on a stalk standing alone)
    const n = alone ? 4 + Math.floor(r() * 2) : 2 + Math.floor(r() * 2)
    for (let k = 0; k < n; k++) {
      const u = 0.2 + (k / n) * (alone ? 0.7 : 0.55) + r() * 0.06
      const ly = tip + ((alone ? base - 30 : base) - tip) * u
      const lx = x + lean * (1 - (ly - tip) / (base - tip))
      const dir = (k + Math.floor(r() * 2)) % 2 === 0 ? 1 : -1
      const L = 26 + r() * 24
      leaves.push(
        `M${f(lx)} ${f(ly)} Q${f(lx + dir * L * 0.5)} ${f(ly - L * 0.45)} ${f(lx + dir * L)} ${f(ly + L * 0.2)} Q${f(lx + dir * L * 0.45)} ${f(ly - L * 0.22)} ${f(lx)} ${f(ly + 4)} Z`,
      )
    }
    x += alone ? 7 + r() * 6 : 9 + r() * 12
  }
  // leaves inside the mass, a shade paler, so it reads as foliage and not as a bank of earth
  // (one path per direction: drawn whole for its transparency, mirrored leaves wind the other way and their overlaps would be holes)
  const shade: [string[], string[]] = [[], []]
  for (let x = x1 + 6; x < x2; x += 10 + r() * 10) {
    for (const depth of [18, 46, 80]) {
      const ly = top(x) + depth + r() * 12
      if (ly > 880 || !inMass(x - 30, ly + 10) || !inMass(x + 30, ly + 10)) continue
      const dir = r() < 0.5 ? 1 : -1
      const L = 22 + r() * 20
      shade[dir > 0 ? 0 : 1].push(`M${f(x)} ${f(ly)} Q${f(x + dir * L * 0.5)} ${f(ly - L * 0.4)} ${f(x + dir * L)} ${f(ly + L * 0.25)} Q${f(x + dir * L * 0.45)} ${f(ly - L * 0.18)} ${f(x)} ${f(ly + 3)} Z`)
    }
  }
  return { mass, stalks: stalks.join(' '), leaves: leaves.join(' '), shade: shade.map((s) => s.join(' ')) }
}

export const farm: Draw = (id) => {
  const r = rng(61)
  const far = ridgeAt(726, 14, 62)
  // the windbreak behind the farm: round trees and a few poplars, in clumps, none behind the barn
  const trees: string[] = []
  for (let x = -20; x < W + 30; x += 22 + r() * 34) {
    if ((x > 640 && x < 1180) || r() < 0.2) continue
    const base = far(x) + 2
    if (r() < 0.22) {
      // a poplar: tall and narrow
      const h = 90 + r() * 50
      trees.push(`M${f(x - 2)} ${f(base + 4)} V${f(base - 20)} H${f(x + 2)} V${f(base + 4)} Z M${f(x)} ${f(base - h)} Q${f(x + 13)} ${f(base - h * 0.55)} ${f(x + 8)} ${f(base - 14)} H${f(x - 8)} Q${f(x - 13)} ${f(base - h * 0.55)} ${f(x)} ${f(base - h)} Z`)
    } else trees.push(leafy(x, base, 46 + r() * 40, 40 + r() * 26, r))
  }

  // the dirt road, from the yard between the house and the barn down to the bottom of the frame
  const road = (t: number) => ({ y: 784 + (906 - 784) * t, l: 592 - 82 * t, rr: 658 + 360 * t })
  // its rail fences, one each side, posts closer together far away
  const posts: string[] = []
  const rails: string[] = []
  for (const side of [-1, 1]) {
    const ts = [0, 0.07, 0.16, 0.28, 0.44, 0.66, 0.96]
    const pt = ts.map((t) => {
      const p = road(t)
      const h = 14 + 110 * t
      const x = side < 0 ? p.l - 10 - 40 * t : p.rr + 10 + 50 * t
      return { x, y: p.y, h, w: 2 + 6 * t }
    })
    pt.forEach((p) => posts.push(`M${f(p.x - p.w / 2)} ${f(p.y + 2)} V${f(p.y - p.h)} H${f(p.x + p.w / 2)} V${f(p.y + 2)} Z`))
    for (let i = 0; i + 1 < pt.length; i++) {
      const a = pt[i]
      const b = pt[i + 1]
      for (const k of [0.45, 0.85]) {
        const ya = a.y - a.h * k
        const yb = b.y - b.h * k
        const ta = 1 + a.h * 0.03
        const tb = 1 + b.h * 0.03
        rails.push(`M${f(a.x)} ${f(ya - ta)} L${f(b.x)} ${f(yb - tb)} L${f(b.x)} ${f(yb + tb)} L${f(a.x)} ${f(ya + ta)} Z`)
      }
    }
  }
  const roadD = `M${road(0).l} ${road(0).y} H${road(0).rr} L${road(1).rr} ${road(1).y} H${road(1).l} Z`
  // wheel ruts down the road
  const ruts = [0.3, 0.7]
    .map((k) => {
      const a = road(0)
      const b = road(1)
      const xa = a.l + (a.rr - a.l) * k
      const xb = b.l + (b.rr - b.l) * k
      return `M${f(xa - 1)} ${a.y + 2} L${f(xb - 5)} ${b.y} H${f(xb + 5)} L${f(xa + 1)} ${a.y + 2} Z`
    })
    .join(' ')

  // the windpump's wheel: blades between two rings
  const wheel = { x: 1420, y: 410 }
  const blades = Array.from({ length: 18 }, (_, i) => {
    const a = (i * Math.PI * 2) / 18
    const b = a + 0.2
    const p = (ang: number, rad: number) => `${f(wheel.x + Math.cos(ang) * rad)} ${f(wheel.y + Math.sin(ang) * rad)}`
    return `M${p(a, 14)} L${p(a, 51)} L${p(b, 51)} L${p(b + 0.05, 16)} Z`
  }).join(' ')
  // its lattice tower: two legs and the braces between them
  const legL = (y: number) => 1384 + ((790 - y) / 320) * 28
  const legR = (y: number) => 1456 - ((790 - y) / 320) * 28
  const braces: string[] = []
  const levels = [790, 712, 640, 576, 520, 472]
  for (let i = 0; i + 1 < levels.length; i++) {
    const y1 = levels[i]
    const y2 = levels[i + 1]
    braces.push(`M${f(legL(y1))} ${y1 - 2} L${f(legR(y2))} ${y2 - 1} L${f(legR(y2))} ${y2 + 2} L${f(legL(y1))} ${y1 + 1} Z`)
    braces.push(`M${f(legR(y1))} ${y1 - 2} L${f(legL(y2))} ${y2 - 1} L${f(legL(y2))} ${y2 + 2} L${f(legR(y1))} ${y1 + 1} Z`)
    braces.push(`M${f(legL(y2) - 1)} ${y2 - 2} H${f(legR(y2) + 1)} v4 H${f(legL(y2) - 1)} Z`)
  }

  const left = cornField(-60, 548, (x) => 700 + ((x + 60) / 560) * 90, 'right', 470, 66)
  const right = cornField(1030, 1660, (x) => 790 - ((x - 1060) / 600) * 100, 'left', 1100, 67)

  return (
    <>
      <Layer depth="far">
        <Moon x={300} y={170} r={42} id={id} />
        <P d={ridge(650, 34, 61, 30)} fill="var(--sil-haze)" />
        <P d={ridge(726, 14, 62)} />
        <P d={trees.join(' ')} />
      </Layer>
      <Layer depth="mid">
        <P d={ridge(778, 5, 63)} />
        {/* the road, paler than the fields, and its ruts */}
        <P d={roadD} fill="var(--sil-haze)" opacity={0.35} />
        <P d={ruts} fill="var(--sil-mid)" opacity={0.5} />
        {/* a dead tree by the house */}
        <BareTree x={96} base={790} h={470} seed={68} lean={0.12} />
        {/* the farmhouse: the gabled main block, the lower wing beside it (its roof seen side on), chimneys */}
        <P data-ground d="M340 796 V560 H520 V796 Z M170 796 V610 H345 V796 Z" />
        <P d="M330 568 L430 466 L530 568 Z M160 616 L186 556 H346 V616 Z" />
        <P d="M216 576 V498 h26 V576 Z M212 502 h34 v-8 h-34 Z M468 532 V440 h22 V532 Z M464 444 h30 v-8 h-30 Z" />
        {/* the porch: its roof, posts, railing and steps */}
        <P d="M154 702 L164 682 H528 L536 702 Z" />
        <P d={`${[168, 248, 326, 400, 512].map((x) => `M${x} 704 h8 V780 h-8 Z`).join(' ')} M168 740 H404 v5 H168 Z M168 772 H520 v4 H168 Z ${Array.from({ length: 23 }, (_, i) => { const x = 180 + i * 10; return x > 396 ? '' : `M${x} 745 h2.5 v28 h-2.5 Z` }).join(' ')}`} />
        <P d="M408 790 V780 H508 V790 Z M414 780 V772 H502 V780 Z" />
        {/* dark windows and the door (the attic's round vent in the gable) */}
        <P d="M196 712 h36 v52 h-36 Z M266 712 h36 v52 h-36 Z M438 712 h44 v56 h-44 Z M360 712 h30 v62 h-30 Z M422 530 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 Z" fill="var(--sil-near)" opacity={0.6} />
        {/* the face of the wing's roof turned from the moon, in shadow */}
        <P d="M186 556 H346 V572 H180 Z" fill="var(--sil-near)" opacity={0.35} />
        {/* the barn: walls, gambrel roof, cupola and weathervane (the cupola stands on the ridge, behind the gable's peak: its foot goes down inside the roof, or its corners stood on air beside the peak) */}
        <P data-ground d="M770 796 V610 H1136 V796 Z" />
        <P d="M752 616 L800 520 L945 452 L1090 520 L1138 616 Z" />
        <P d="M927 474 V412 H963 V474 Z M919 414 L945 388 L971 414 Z M944 392 V352 h2 V392 Z M922 362 L966 360 L966 364 L922 366 Z M966 356 L976 362 L966 368 Z M922 358 h-8 l4 5 l-4 5 h8 Z" />
        <P d={[0, 1, 2].map((i) => `M933 ${420 + i * 9} h24 v3 h-24 Z`).join(' ')} fill="var(--sil-near)" opacity={0.6} />
        {/* the open loft door, the hay rope hanging in it from the track above, the big doors and their braces */}
        <P d="M918 528 h54 v66 h-54 Z" fill="var(--sil-near)" opacity={0.75} />
        <P d="M940 516 h10 v12 h-10 Z M944.2 528 V572 h1.6 V528 Z M941 572 h8 v3 q0 8 -6 8 q-4 0 -4 -4 h3 q0 2 1 2 q3 0 3 -6 Z" />
        <g stroke="var(--sil-back)" strokeWidth={4} fill="none" opacity={0.75}>
          <path d="M878 778 V646 H1012 V778 M878 646 L943 778 M943 646 L878 778 M947 646 L1012 778 M1012 646 L947 778 M943 646 V778 M947 646 V778" />
          <path d="M770 616 L1134 616" />
        </g>
        {/* the silo: body, domed cap, a vent; its hoops */}
        <P data-ground d="M1132 796 V472 H1206 V796 Z" />
        <P d="M1132 478 Q1134 440 1169 434 Q1204 440 1206 478 Z M1163 438 V420 h12 V438 Z M1159 422 h20 v-5 h-20 Z" />
        <P d={[520, 580, 640, 700, 760].map((y) => `M1132 ${y} H1206 v3 H1132 Z`).join(' ')} fill="var(--sil-back)" opacity={0.45} />
        {/* the windpump: tower, platform, gearbox, wheel, tail vane, pump rod; the tank it fills */}
        <P d={`M1382 792 L1410 472 h4 L1388 792 Z M1458 792 L1430 472 h-4 L1452 792 Z ${braces.join(' ')}`} />
        <P d="M1394 474 V466 H1446 V474 Z M1412 468 V414 h18 V468 Z M1419 474 V792 h2 V474 Z" />
        <P d={`M${wheel.x} ${wheel.y - 53} a53 53 0 1 0 0.1 0 Z M${wheel.x} ${wheel.y - 48} a48 48 0 1 1 -0.1 0 Z`} fillRule="evenodd" />
        <P d={`${blades} M${wheel.x - 10} ${wheel.y} a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 Z M${wheel.x} ${wheel.y - 3} H1500 v6 H${wheel.x} Z M1494 398 L1520 392 V428 L1494 422 Z`} />
        <P data-ground d="M1466 792 V752 H1566 V792 Z M1460 754 h112 v-6 h-112 Z" />
        {/* the fences along the road, darker than the ground they stand on (in its tone they vanished) */}
        <P data-ground="each" d={posts.join(' ')} fill="var(--sil-near)" />
        <P d={rails.join(' ')} fill="var(--sil-near)" />
        {/* moonlight from the upper left on the edges facing it */}
        <g className="scr-rim" strokeWidth={2}>
          <path d="M342 556 L430 466 M160 616 L186 556 H340 M154 702 L164 682 H528 M752 616 L800 520 L927 460.4 M919 414 L945 388 M1132 780 V476 Q1134 440 1169 434 M1382 792 L1410 472 M1394 466 H1446" />
          <path d={`M${wheel.x - 37} ${wheel.y - 37} A53 53 0 0 1 ${wheel.x + 37} ${wheel.y - 37}`} />
        </g>
      </Layer>
      <Layer depth="lit">
        {/* the one lit window, upstairs in the gable, and its sash bars */}
        <Halo id={`${id}-halo`} x={430} y={618} r={130} o={0.55} />
        <P d="M406 588 h48 v62 h-48 Z" fill={`url(#${id}-glass)`} />
        <P d="M430 588 V650 M406 619 H454" stroke="var(--sil-mid)" strokeWidth={3} fill="none" />
        {/* a thread of light between the barn's doors, standing ajar, and on the yard in front of them */}
        <P d="M943 648 h4 v130 h-4 Z" opacity={0.85} />
        <Halo id={`${id}-halo`} x={945} y={760} r={90} o={0.5} />
      </Layer>
      <Layer depth="near">
        <P d={ridge(890, 6, 64)} />
        {/* the corn, left and right of the road */}
        <P d={left.mass} />
        <P d={right.mass} />
        <P d={`${left.stalks} ${right.stalks}`} />
        <P d={`${left.leaves} ${right.leaves}`} />
        {[0, 1].map((k) => <P key={k} d={`${left.shade[k]} ${right.shade[k]}`} fill="var(--sil-mid)" opacity={0.45} />)}
        {/* the scarecrow in the corn: pole and crossbar, coat, drooping sleeves, sack head, hat */}
        <P d="M1288 790 V548 h5 V790 Z M1214 600 H1366 v5 H1214 Z" />
        <P d="M1262 598 H1318 L1326 680 L1318 690 L1310 682 L1302 694 L1292 684 L1282 696 L1274 684 L1264 692 L1256 682 Z" />
        <P d="M1264 598 L1222 600 L1216 618 L1220 632 L1226 622 L1230 636 L1236 620 L1262 616 Z M1316 598 L1360 600 L1366 620 L1362 634 L1356 622 L1350 636 L1346 620 L1318 616 Z" />
        <P d="M1272 600 L1276 588 Q1270 584 1270 572 A20 20 0 0 1 1310 572 Q1310 584 1304 588 L1308 600 Z" />
        <P d="M1256 560 Q1268 554 1280 554 L1282 536 Q1290 528 1302 534 L1304 552 Q1318 552 1326 558 Q1292 566 1256 560 Z" />
        <P d="M1216 618 l-6 10 l8 -4 Z M1366 620 l6 10 l-8 -4 Z M1278 598 l-4 8 l6 -5 Z M1302 598 l4 8 l-6 -5 Z" />
        {/* the sack's dark eye holes */}
        <P d="M1281 571 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z M1294 571 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z" fill="var(--sil-mid)" />
        {/* a crow on the scarecrow's arm */}
        <P d={crow(1350, 601, 0.9, true)} />
        {/* the mailbox at the end of the road */}
        <P data-ground d="M980 894 V796 h8 V894 Z" />
        <P d="M960 800 V780 Q960 768 972 768 H996 Q1008 768 1008 780 V800 Z M1008 778 h3 v-22 h12 v8 h-9 v14 Z" />
        <P d={grass(ridgeAt(890, 6, 64), 65)} data-ground="each" />
        <g className="scr-rim" strokeWidth={2}>
          <path d="M1256 560 Q1268 554 1280 554 M1214 600 H1262" />
        </g>
      </Layer>
    </>
  )
}
