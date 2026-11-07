// Drawn décor: fair. A travelling fair at night, deserted: the big wheel against the moon, a carousel
// whose horses wait on their poles, the striped big top with a light left on inside, strings of bulbs
// between poles (some dead, some failing), a game booth with its prizes still on the shelves, and in
// front an empty ticket booth, a rope barrier with a lost balloon tied to it, a gas lamp. See the
// decor-artist skill.
import { type Draw, Halo, Layer, Moon, P, f, grass, ridge, ridgeAt, rng } from '../placeKit'

/** A point on the quadratic curve a → b sagging by `sag` in the middle (a wire between two poles). */
const sagAt = (a: [number, number], b: [number, number], sag: number, t: number): [number, number] => {
  const c: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag * 2]
  const u = 1 - t
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]
}

/** A wire between two poles as a thin filled band (so the bulbs hanging on it touch it). */
function wire(a: [number, number], b: [number, number], sag: number, w = 1.1): string {
  const n = 24
  const top: string[] = []
  const bot: string[] = []
  for (let i = 0; i <= n; i++) {
    const [x, y] = sagAt(a, b, sag, i / n)
    top.push(`${f(x)} ${f(y - w)}`)
    bot.unshift(`${f(x)} ${f(y + w)}`)
  }
  return `M${top.join(' L')} L${bot.join(' L')} Z`
}

/** Bulbs hanging on that wire, every `step` units or so: their centres, just under it. */
function bulbsOn(a: [number, number], b: [number, number], sag: number, step: number): Array<[number, number]> {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const n = Math.max(2, Math.round(len / step))
  return Array.from({ length: n - 1 }, (_, i) => {
    const [x, y] = sagAt(a, b, sag, (i + 1) / n)
    return [x, y + 3.6] as [number, number]
  })
}

const dot = (x: number, y: number, r: number) => `M${f(x - r)} ${f(y)} a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0 a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0 Z`

/** A carousel horse in profile, prancing, centred on its pole at x, y (s: scale). */
const horse = (x: number, y: number, s: number) => {
  const p = (dx: number, dy: number) => `${f(x + dx * s)} ${f(y + dy * s)}`
  return (
    `M${p(-24, -2)} Q${p(-10, -9)} ${p(10, -7)} L${p(16, -14)} Q${p(19, -27)} ${p(27, -32)} L${p(31, -36)} L${p(33, -30)} L${p(39, -21)} L${p(37, -17)} L${p(29, -19)} ` +
    `Q${p(25, -13)} ${p(23, -5)} L${p(25, 2)} L${p(33, 10)} L${p(31, 14)} L${p(20, 7)} L${p(15, 8)} L${p(17, 23)} L${p(12, 23)} L${p(9, 9)} L${p(-12, 9)} ` +
    `L${p(-15, 23)} L${p(-20, 23)} L${p(-19, 8)} L${p(-25, 5)} L${p(-33, 14)} L${p(-32, 4)} L${p(-26, -1)} Z`
  )
}

export const fair: Draw = (id) => {
  const r = rng(71)
  // ---- the big wheel
  const hx = 470
  const hy = 370
  const R = 250
  const ring = (ro: number, ri: number) => `M${hx} ${hy - ro} a${ro} ${ro} 0 1 0 0.1 0 Z M${hx} ${hy - ri} a${ri} ${ri} 0 1 1 -0.1 0 Z`
  const pol = (a: number, rad: number): [number, number] => [hx + Math.cos(a) * rad, hy + Math.sin(a) * rad]
  const spokes = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI * 2) / 16
    const n = 1.6 / 250
    const [x1, y1] = pol(a - n * 6, 12)
    const [x2, y2] = pol(a - n, R - 2)
    const [x3, y3] = pol(a + n, R - 2)
    const [x4, y4] = pol(a + n * 6, 12)
    return `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} L${f(x3)} ${f(y3)} L${f(x4)} ${f(y4)} Z`
  }).join(' ')
  // zigzag ties between the outer and the inner ring
  const ties = Array.from({ length: 48 }, (_, i) => {
    const a = (i * Math.PI * 2) / 48
    const b = ((i + 1) * Math.PI * 2) / 48
    const [x1, y1] = pol(a, R - 1)
    const [x2, y2] = pol(b, R - 19)
    const t = 1
    return `M${f(x1 - t)} ${f(y1)} L${f(x1 + t)} ${f(y1)} L${f(x2 + t)} ${f(y2)} L${f(x2 - t)} ${f(y2)} Z`
  }).join(' ')
  // the cars, each hanging under its pivot on the outer ring
  const cars = Array.from({ length: 12 }, (_, i) => {
    const [px, py] = pol((i * Math.PI * 2) / 12 + 0.13, R)
    return `M${f(px - 1.2)} ${f(py - 2)} h2.4 v14 h-2.4 Z M${f(px - 16)} ${f(py + 17)} Q${f(px)} ${f(py + 6)} ${f(px + 16)} ${f(py + 17)} Z M${f(px - 13)} ${f(py + 15)} h2.4 v14 h-2.4 Z M${f(px + 10.6)} ${f(py + 15)} h2.4 v14 h-2.4 Z M${f(px - 15)} ${f(py + 27)} H${f(px + 15)} V${f(py + 36)} Q${f(px + 15)} ${f(py + 43)} ${f(px + 6)} ${f(py + 43)} H${f(px - 6)} Q${f(px - 15)} ${f(py + 43)} ${f(px - 15)} ${f(py + 36)} Z`
  }).join(' ')
  // the A-frame legs and their braces
  const leg = (xb: number) => `M${f(hx - 3)} ${hy} L${f(xb - 6)} 806 H${f(xb + 6)} L${f(hx + 3)} ${hy} Z`
  const legAt = (xb: number, y: number) => hx + ((xb - hx) * (y - hy)) / (806 - hy)
  const braces = [520, 640, 740]
    .map((y) => `M${f(legAt(330, y))} ${y - 2} H${f(legAt(610, y))} v4 H${f(legAt(330, y))} Z`)
    .join(' ')
  const wheelBulbs = Array.from({ length: 40 }, (_, i) => pol((i * Math.PI * 2) / 40, R))
  const hubBulbs = Array.from({ length: 8 }, (_, i) => pol((i * Math.PI * 2) / 8 + 0.2, 21))

  // ---- the carousel
  const cx = 860
  const scallops = (x1: number, x2: number, y: number, n: number) => {
    const w = (x2 - x1) / n
    let d = `M${x1} ${y - 2} H${x2} V${y} `
    for (let i = n - 1; i >= 0; i--) d += `A${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(x1 + i * w)} ${y} `
    return `${d}Z`
  }
  const carouselTips = Array.from({ length: 12 }, (_, i) => [712 + (i + 0.5) * (296 / 12), 612] as [number, number])

  // ---- the big top
  const roof = 'M1078 566 Q1190 532 1224 330 H1236 Q1262 400 1305 404 Q1348 400 1374 330 H1386 Q1420 532 1532 566 Z'
  const roofStripes: string[] = []
  for (let i = 0; i < 9; i++) {
    const x = 1078 + i * 25
    if (i % 2 === 0) roofStripes.push(`M1230 330 L${x} 568 H${x + 25} Z`)
  }
  for (let i = 0; i < 9; i++) {
    const x = 1307 + i * 25
    if (i % 2 === 1) roofStripes.push(`M1380 330 L${x} 568 H${x + 25} Z`)
  }
  const wallStripes = Array.from({ length: 9 }, (_, i) => `M${1098 + i * 48} 806 V572 h24 V806 Z`).join(' ')
  const topTips = Array.from({ length: 19 }, (_, i) => [1076 + 12 + i * 24, 590] as [number, number])

  // ---- strings of bulbs: (pole top, pole top, sag)
  const strings: Array<[[number, number], [number, number], number]> = [
    [[680, 436], [860, 478], 26],
    [[860, 478], [1230, 300], 46],
    // (its pole kept inside the frame at both ends of the drift: at x 1568 it slid out, the string hanging from nothing)
    [[1380, 300], [1519, 474], 26],
  ]
  const stringBulbs = strings.flatMap(([a, b, s]) => bulbsOn(a, b, s, 19))
  // some bulbs are dead (dark), a few are failing (they flicker)
  const dead = new Set<number>()
  const failing = new Set<number>()
  stringBulbs.forEach((_, i) => {
    const k = r()
    if (k < 0.16) dead.add(i)
    else if (k < 0.3) failing.add(i)
  })
  const deadWheel = new Set([3, 4, 17, 26, 27, 28, 35])

  // ---- far tents on the far field, the fair going on in the dark
  const farTents = [
    [60, 742, 70, 58],
    [150, 744, 50, 44],
    [1560, 740, 80, 62],
  ]
    .map(([x, y, w, h]) => `M${x - w / 2} ${y + 4} L${x - w / 2 + 6} ${y - h * 0.45} L${x} ${y - h} L${x + w / 2 - 6} ${y - h * 0.45} L${x + w / 2} ${y + 4} Z M${x - 1} ${y - h + 2} V${y - h - 16} h2 V${y - h + 2} Z`)
    .join(' ')

  // ---- the game booth's prizes on their shelves: dolls and bottles
  const prizes = Array.from({ length: 9 }, (_, i) => {
    const x = 276 + i * 18
    return i % 3 === 1
      ? `M${x - 3} 735 V722 h6 V735 Z M${x - 1.5} 722 V715 h3 V722 Z`
      : `M${x - 6} 735 Q${x - 6} 722 ${x} 722 Q${x + 6} 722 ${x + 6} 735 Z ${dot(x, 716, 5.5)}`
  }).join(' ')

  // ---- near: the rope barrier and its stanchions
  const stanchions = [330, 560, 790, 1020]
  const ropes = stanchions.slice(0, -1).map((x, i) => wire([x + 4, 836], [stanchions[i + 1] - 4, 836], 18, 2.2)).join(' ')

  return (
    <>
      <Layer depth="far">
        <Moon x={620} y={196} r={44} id={id} />
        <P d={ridge(652, 30, 71, 30)} fill="var(--sil-haze)" />
        <P d={ridge(742, 6, 72)} />
        <P d={farTents} />
      </Layer>
      <Layer depth="mid">
        <P d={ridge(800, 4, 73)} />
        {/* the big wheel: legs and braces, rings, spokes, hub, cars, the boarding platform */}
        <P d={`${leg(330)} ${leg(610)} ${braces}`} />
        <P d={ring(R + 2.5, R - 2.5)} fillRule="evenodd" />
        <P d={ring(R - 16, R - 20)} fillRule="evenodd" />
        <P d={`${spokes} ${ties}`} />
        <P d={dot(hx, hy, 16)} />
        <P d={cars} />
        <P data-ground d="M400 806 V782 H540 V806 Z M380 806 V794 H400 V806 Z" />
        {/* the carousel: platform, centre column, the drum with its mirrors, poles and horses, canopy, valance, finial */}
        <P data-ground d="M708 808 V780 H1012 V808 Z" />
        <P d="M796 782 V604 H924 V782 Z" fill="var(--sil-back)" />
        <P d="M850 782 V604 h20 V782 Z" />
        <P d={[752, 806, 914, 968].map((x) => `M${x - 1.5} 782 V600 h3 V782 Z`).join(' ')} />
        <P d={`${horse(752, 700, 1)} ${horse(806, 730, 1)} ${horse(914, 712, 1)} ${horse(968, 690, 1)}`} />
        <P d={`M712 590 Q800 562 856 512 H864 Q920 562 1008 590 Z ${scallops(712, 1008, 604, 12)} M712 588 H1008 V604 H712 Z`} />
        <P d={`${dot(860, 506, 7)} M859 500 V466 h2 V500 Z M861 468 L884 474 L861 480 Z`} />
        {/* the big top: guy ropes, poles and pennants, roof and its stripes, valance, walls and stripes, the door */}
        <P d="M1230 302 L1046 806 M1380 302 L1566 806" stroke="currentColor" strokeWidth={1.6} fill="none" />
        <P d="M1227 340 V300 h6 V340 Z M1377 340 V300 h6 V340 Z M1229 302 V270 h2 V302 Z M1379 302 V270 h2 V302 Z M1231 272 L1258 279 L1231 286 Z M1381 272 L1408 279 L1381 286 Z" />
        <P data-ground d="M1092 808 V560 H1518 V808 Z" />
        <P d={roof} />
        <clipPath id={`${id}-bigtop`}>
          <path d={roof} />
        </clipPath>
        <g clipPath={`url(#${id}-bigtop)`}>
          <P d={roofStripes.join(' ')} fill="var(--sil-back)" />
        </g>
        <P d={wallStripes} fill="var(--sil-back)" />
        <P d={`${scallops(1076, 1532, 590, 19)} M1076 566 H1532 V590 H1076 Z`} />
        <P d="M1276 808 L1294 650 H1316 L1334 808 Z" fill="var(--sil-near)" />
        <P d="M1294 652 Q1278 720 1262 808 H1276 L1294 652 Z M1316 652 Q1332 720 1348 808 H1334 L1316 652 Z" fill="var(--sil-back)" />
        {/* the game booth under the wheel: posts, awning, counter, back wall and the prizes on it */}
        <P data-ground d="M252 806 V690 h8 V806 Z M432 806 V690 h8 V806 Z M256 808 V762 H436 V808 Z" />
        <P d="M262 762 V690 H432 V762 Z" fill="var(--sil-back)" />
        <P d={`M262 738 H432 v3 H262 Z ${prizes}`} fill="var(--sil-near)" />
        <P d={`M240 692 L256 668 H436 L452 692 Z ${scallops(240, 452, 704, 8)} M240 690 H452 V704 H240 Z`} />
        <P d="M252 756 H440 v8 H252 Z" />
        {/* the light poles and the strings of bulbs between them */}
        <P data-ground d="M677 806 V432 h6 V806 Z M670 436 h20 v4 h-20 Z M1516 806 V470 h6 V806 Z M1509 474 h20 v4 h-20 Z" />
        <P d={strings.map(([a, b, s]) => wire(a, b, s)).join(' ')} />
        <P d={[...dead].map((i) => dot(stringBulbs[i][0], stringBulbs[i][1], 3.2)).join(' ')} />
        <P d={[...deadWheel].map((i) => dot(wheelBulbs[i][0], wheelBulbs[i][1], 3)).join(' ')} />
        {/* moonlight on the edges facing it */}
        <g className="scr-rim" strokeWidth={2}>
          <path d="M712 590 Q800 562 856 512 M1078 566 Q1190 532 1224 330 M1305 404 Q1348 400 1374 330 M240 692 L256 668 H436" />
          <path d={`M${hx - 177} ${hy - 177} A${R + 2} ${R + 2} 0 0 1 ${hx + 120} ${hy - 219}`} />
        </g>
      </Layer>
      <Layer depth="lit">
        {/* glow about the wheel's hub, the carousel and the strings */}
        <Halo id={`${id}-halo`} x={hx} y={hy} r={300} o={0.22} />
        <Halo id={`${id}-halo`} x={cx} y={640} r={220} o={0.4} />
        <Halo id={`${id}-halo`} x={1305} y={760} r={140} o={0.5} />
        <Halo id={`${id}-halo`} x={346} y={720} r={130} o={0.55} />
        {/* the wheel's bulbs, on its outer ring and round the hub */}
        <P d={wheelBulbs.filter((_, i) => !deadWheel.has(i)).map(([x, y]) => dot(x, y, 3)).join(' ')} />
        <P d={hubBulbs.map(([x, y]) => dot(x, y, 2.6)).join(' ')} />
        {/* the carousel: bulbs on the valance's tips, its mirrors lit on the drum */}
        <P d={carouselTips.map(([x, y]) => dot(x, y, 3)).join(' ')} />
        <P d={[804, 826, 878, 900].map((x) => `M${x} 680 V630 a8 8 0 0 1 16 0 V680 Z`).join(' ')} fill={`url(#${id}-glass)`} opacity={0.55} />
        {/* the big top: bulbs on its valance, a light left on inside, through the door */}
        <P d={topTips.map(([x, y]) => dot(x, y, 3)).join(' ')} />
        <P d="M1286 806 L1298 680 H1312 L1324 806 Z" fill={`url(#${id}-glass)`} opacity={0.6} />
        {/* the booth's bulb under its awning, and its light on the prizes */}
        <P d={`${dot(346, 710, 5)} M344 703 h4 v3 h-4 Z`} />
        <P d="M262 718 H432 V756 H262 Z" fill={`url(#${id}-glass)`} opacity={0.3} />
        {/* the strings' bulbs that still work */}
        <P d={stringBulbs.filter((_, i) => !dead.has(i) && !failing.has(i)).map(([x, y]) => dot(x, y, 3.2)).join(' ')} />
      </Layer>
      <Layer depth="pulse-mid">
        {/* the failing bulbs (off by day, like the lit layers: .scr-glow) */}
        <g className="scr-glow">
          <P d={[...failing].map((i) => dot(stringBulbs[i][0], stringBulbs[i][1], 3.2)).join(' ')} />
        </g>
      </Layer>
      <Layer depth="near">
        <P d={ridge(890, 5, 74)} />
        {/* the empty ticket booth: body, onion roof and finial, the plain board over its window, the counter */}
        <P data-ground d="M116 896 V640 H236 V896 Z" />
        <P d="M102 646 Q102 600 148 584 Q168 574 172 552 H180 Q184 574 204 584 Q250 600 250 646 Z M174 556 V528 h4 V556 Z" />
        <P d={dot(176, 528, 6)} />
        <P d="M132 664 H220 V684 H132 Z" fill="var(--sil-back)" opacity={0.6} />
        <P d="M132 778 H220 v8 H132 Z M110 646 H242 v8 H110 Z" />
        {/* the rope barrier, a lost balloon tied to it */}
        <P data-ground="each" d={stanchions.map((x) => `M${x - 4} 894 V834 h8 V894 Z M${x - 12} 896 V888 h24 V896 Z`).join(' ')} />
        <P d={stanchions.map((x) => dot(x, 830, 7)).join(' ')} />
        <P d={ropes} />
        <P d="M562 826 Q590 790 576 752 Q566 722 590 700 l2 1.4 Q570 722 579 752 Q594 792 565 828 Z" />
        <P d="M590 700 l-4 -6 h10 Z M591 696 Q568 690 568 664 Q568 640 591 640 Q614 640 614 664 Q614 690 591 696 Z" />
        {/* the gas lamp */}
        <P data-ground d="M1465 896 V560 h10 V896 Z M1453 896 L1461 870 h18 L1487 896 Z M1457 562 h26 l-4 -8 h-18 Z M1459 520 h22 l-4 -10 h-14 Z M1468 510 V500 h4 V510 Z" />
        <P d={grass(ridgeAt(890, 5, 74), 75)} data-ground="each" />
        <g className="scr-rim" strokeWidth={2}>
          <path d="M102 646 Q102 600 148 584 Q168 574 172 552 M576 645 Q591 637 606 645" />
        </g>
      </Layer>
      <Layer depth="lit-near">
        {/* the ticket booth's window, lit, nobody behind it; bulbs along its eave */}
        <Halo id={`${id}-halo`} x={176} y={740} r={120} o={0.6} />
        <P d="M144 776 V722 A32 32 0 0 1 208 722 V776 Z" fill={`url(#${id}-glass)`} />
        <P d="M176 690 V776" stroke="var(--sil-near)" strokeWidth={3} fill="none" />
        <P d={Array.from({ length: 7 }, (_, i) => dot(122 + i * 18, 658, 3)).join(' ')} />
      </Layer>
      <Layer depth="pulse">
        {/* the gas lamp's flame, flickering (off by day) */}
        <g className="scr-glow">
          <Halo id={`${id}-halo`} x={1470} y={538} r={160} />
          <P d="M1461 554 h18 l2 -34 h-22 Z" />
        </g>
      </Layer>
    </>
  )
}
