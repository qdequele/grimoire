// Drawn décor: asylum. A sanatorium seen from the road: a long institutional building (two wings of
// small barred windows, end pavilions, a central block with a pediment and a clock tower), behind a high
// wall with closed iron gates, the drive running up to the lit door, bare trees. See the decor-artist skill.
import { BareTree, type Draw, Halo, Layer, Moon, P, arched, crow, f, grass, ridge, ridgeAt } from '../placeKit'

const box = (x: number, y: number, w: number, h: number) => `M${x} ${y} h${w} v${h} h${-w} Z`

/** A Lombardy poplar: a tall narrow flame on the ridge. */
const poplar = (x: number, base: number, h: number, w: number) =>
  `M${f(x - w * 0.12)} ${f(base + 4)} L${f(x - w * 0.12)} ${f(base - h * 0.06)} Q${f(x - w * 0.62)} ${f(base - h * 0.45)} ${f(x)} ${f(base - h)} Q${f(x + w * 0.62)} ${f(base - h * 0.45)} ${f(x + w * 0.12)} ${f(base - h * 0.06)} L${f(x + w * 0.12)} ${f(base + 4)} Z`

export const asylum: Draw = (id) => {
  // Windows: two rows on each wing, three on each pavilion, three on the central block.
  type Win = { x: number; y: number; w: number; h: number; arch?: boolean }
  const wingX = [318, 362, 406, 450, 494, 538, 582]
  const all: Win[] = [
    ...[566, 650].flatMap((y) => [...wingX, ...wingX.map((x) => 1580 - x)].map((x) => ({ x, y, w: 20, h: 40 }))),
    ...[530, 610, 690].flatMap((y) => [196, 244, 1336, 1384].map((x) => ({ x, y, w: 20, h: 40 }))),
    ...[452, 540, 628].flatMap((y) => [680, 724, 854, 898].map((x) => ({ x, y, w: 22, h: 54, arch: true }))),
    { x: 784, y: 440, w: 32, h: 64, arch: true },
    { x: 784, y: 540, w: 32, h: 64, arch: true },
  ]
  const shape = (o: Win) => (o.arch ? arched(o.x, o.y, o.w, o.h) : box(o.x, o.y, o.w, o.h))
  // A few rooms still awake; the rest dark.
  const lit = new Set([3, 9, 17, 33, 22, 26, 31, 37, 42, 47, 51, 58])
  const litW = all.filter((_, i) => lit.has(i))
  const darkW = all.filter((_, i) => !lit.has(i))
  // The bars: uprights and a crossbar on every window, inside its opening.
  const bars = ({ x, y, w, h, arch }: Win) => {
    const n = w > 24 ? 3 : 2
    const top = arch ? y + w / 2 - 2 : y
    let d = ''
    for (let k = 1; k <= n; k++) d += `M${f(x + (k * w) / (n + 1))} ${f(top)} V${y + h} `
    return `${d}M${x} ${f(y + h * 0.45)} h${w}`
  }
  // Brick courses on the wall, broken at its piers.
  const piers = [-30, 170, 370, 1206, 1406, 1606]
  const courses = Array.from({ length: 6 }, (_, i) => {
    const y = 768 + i * 14
    let d = ''
    let x0 = -40
    for (const p of [...piers.filter((p) => p < 700), 700]) {
      if (p > x0) d += `M${x0} ${y} H${p} v2 H${x0} Z `
      x0 = p + 24
    }
    x0 = 900
    for (const p of piers.filter((p) => p > 900)) {
      d += `M${x0} ${y} H${p} v2 H${x0} Z `
      x0 = p + 24
    }
    return d
  }).join(' ')
  // The gate: two leaves of iron bars under an arched top rail, spikes above.
  const gateTop = (x: number) => 714 - 26 * Math.sin((Math.PI * (x - 732)) / 136)
  let gate = ''
  for (let x = 738; x < 864; x += 11) gate += `M${f(x)} 852 V${f(gateTop(x) - 2)} l2 -10 l2 10 V852 Z `
  for (let x = 732; x < 868; x += 4) gate += `M${x} ${f(gateTop(x) + 4)} L${x + 4.4} ${f(gateTop(x + 4) + 4)} V${f(gateTop(x + 4) + 9)} L${x} ${f(gateTop(x) + 9)} Z `
  gate += 'M732 762 H868 v5 H732 Z M732 834 H868 v5 H732 Z M797 852 V700 h6 V852 Z'
  const spikes = Array.from({ length: 92 }, (_, i) => -36 + i * 18)
    .filter((x) => x < 696 || x > 900)
    .map((x) => `M${x} 744 l3 -10 l3 10 Z`)
    .join(' ')
  // Poplars and firs along the far ridge, in clumps.
  const farGround = ridgeAt(706, 24, 102)
  const trees = [20, 52, 84, 130, 1460, 1496, 1534, 1572, 1610]
    .map((x, i) => poplar(x, farGround(x), 120 + ((i * 37) % 60), 34 + ((i * 13) % 12)))
    .join(' ')
  return (
    <>
      <Layer depth="far">
        <Moon x={1250} y={170} r={42} id={id} />
        <P d={ridge(640, 36, 101, 30)} fill="var(--sil-haze)" />
        <P d={ridge(706, 24, 102)} />
        <P d={trees} />
      </Layer>
      <Layer depth="mid">
        {/* the boiler-house stack behind the right wing, its foot on the ground behind the building */}
        <P d="M1166 806 L1173 300 H1191 L1198 806 Z M1167 308 h30 v-12 h-30 Z" />
        <P d={ridge(800, 5, 103)} />
        {/* the wings and their hipped roofs, the end pavilions, the central block with its pediment */}
        <P data-ground d="M270 812 V540 H660 V812 Z M940 812 V540 H1330 V812 Z" />
        <P d="M256 546 L302 486 H636 L672 546 Z M928 546 L964 486 H1298 L1344 546 Z" />
        <P d={[360, 556, 1022, 1218].map((x) => `M${x} 500 V454 h22 V500 Z M${x - 4} 458 h30 v-8 h-30 Z`).join(' ')} />
        <P data-ground d="M170 812 V500 H290 V812 Z M1310 812 V500 H1430 V812 Z" />
        <P d="M158 506 L192 438 H268 L302 506 Z M1298 506 L1332 438 H1408 L1442 506 Z" />
        <P data-ground d="M650 812 V420 H950 V812 Z" />
        <P d="M640 426 H960 v-16 H640 Z M644 412 L800 344 L956 412 Z" />
        {/* the clock tower: its foot inside the pediment, a belfry, a small dome and a vane */}
        <P d="M762 386 V280 H838 V386 Z M754 286 H846 v-10 H754 Z M770 278 V222 H830 V278 Z M764 228 Q800 170 836 228 Z M798 206 V160 h4 V206 Z M800 182 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z M782 158 h32 v3 h-32 Z M812 153.5 l9 6 l-9 6 Z M779 153 h8 v13 h-8 Z" />
        <P d={`${arched(777, 232, 18, 38)} ${arched(805, 232, 18, 38)}`} fill="var(--sil-near)" />
        {/* string courses between the floors */}
        <P d="M262 630 H668 v5 H262 Z M932 630 H1338 v5 H932 Z M170 598 H290 v5 H170 Z M1310 598 H1430 v5 H1310 Z M170 680 H290 v5 H170 Z M1310 680 H1430 v5 H1310 Z M650 524 H950 v5 H650 Z M650 614 H950 v5 H650 Z" fill="var(--sil-back)" opacity={0.55} />
        {/* faces turned from the light: the pavilions' and the tower's shaded sides */}
        <P d="M170 812 V500 h20 V812 Z M1310 812 V500 h20 V812 Z M762 361 V280 h18 V353 Z M650 812 V420 h14 V812 Z M770 278 V222 h12 V278 Z" fill="var(--sil-near)" opacity={0.35} />
        {/* the windows, dark, and their bars */}
        <P d={darkW.map(shape).join(' ')} fill="var(--sil-near)" opacity={0.7} />
        <P d={darkW.map(bars).join(' ')} stroke="var(--sil-back)" strokeWidth={2} fill="none" opacity={0.45} />
        {/* the door at the top of the drive, the steps, the drive running down to the gate */}
        <P d="M766 812 h68 v-6 h-68 Z M772 806 h56 v-6 h-56 Z" fill="var(--sil-back)" />
        <P d="M778 812 H822 L890 900 H710 Z" fill="var(--sil-back)" opacity={0.75} />
        <g className="scr-rim" strokeWidth={2}>
          <path d="M302 486 H636 L650 509 M964 486 H1298 L1310 502 M192 438 H268 L302 506 M1332 438 H1408 L1442 506 M644 412 L800 344 L956 412 M800 199 Q818 199 836 228" />
        </g>
      </Layer>
      <Layer depth="lit">
        <Halo id={`${id}-halo`} x={800} y={780} r={150} o={0.6} />
        <P d={litW.map(shape).join(' ')} fill={`url(#${id}-glass)`} />
        {/* the door, open */}
        <P d="M784 800 V766 A16 16 0 0 1 816 766 V800 Z" fill={`url(#${id}-glass)`} />
        {/* someone standing at a barred window, in the left pavilion */}
        <P d="M248 650 V638 Q248 630 255 628 Q251 624 251 619 A5 5 0 0 1 261 619 Q261 624 257 628 Q264 630 264 638 V650 Z" fill="var(--sil-mid)" opacity={0.9} />
        {/* the bars over the lit panes */}
        <P d={litW.map(bars).join(' ')} stroke="var(--sil-mid)" strokeWidth={2.5} fill="none" />
        {/* the clock face, lit from inside */}
        <circle cx={800} cy={314} r={20} opacity={0.65} />
        <P d="M799 314 V300 h2 V314 Z M800 313 h10 v2 h-10 Z" fill="var(--sil-mid)" />
        {/* the lanterns on the gate piers */}
        {[716, 884].map((x) => (
          <g key={x}>
            <Halo id={`${id}-halo`} x={x} y={668} r={90} />
            <P d={`M${x - 6} 686 h12 l3 -24 h-18 Z`} />
          </g>
        ))}
      </Layer>
      <Layer depth="mid-front">
        {/* bare trees inside the grounds, in front of the house and behind the wall (their feet hidden by it) */}
        <BareTree x={470} base={806} h={330} seed={105} lean={0.1} />
        <BareTree x={1110} base={806} h={300} seed={106} lean={-0.12} />
        {/* the high wall: coping, piers, spikes along the top; down below the drive's foot */}
        <P d="M-40 856 V750 H712 V856 Z M888 856 V750 H1640 V856 Z" />
        <P d="M-44 752 H712 v-10 H-44 Z M888 752 H1644 v-10 H888 Z" />
        <P d={piers.map((x) => `M${x} 856 V734 h24 V856 Z M${x - 4} 738 h32 v-8 h-32 Z`).join(' ')} />
        <P d={spikes} />
        <P d={courses} fill="var(--sil-back)" opacity={0.18} />
        {/* the gate piers, their caps carrying the lanterns, and the closed gate between them */}
        <P d="M700 856 V692 H732 V856 Z M868 856 V692 H900 V856 Z M694 696 h44 v-10 h-44 Z M862 696 h44 v-10 h-44 Z" />
        {/* the lanterns' frames over their glass: a base, corner posts, a roof and a finial */}
        <P d={[716, 884].map((x) => `M${x - 9} 686 h18 v-3 h-18 Z M${x - 8} 684 l-3 -22 h3 l2 22 Z M${x + 8} 684 l3 -22 h-3 l-2 22 Z M${x - 14} 664 h28 l-14 -12 Z M${x - 1} 654 v-8 h2 v8 Z`).join(' ')} />
        <P d={gate} />
        {/* a crow on the coping */}
        <P d={crow(1262, 742, 1)} />
        <g className="scr-rim scr-rim-lamp" strokeWidth={2}>
          <path d="M694 686 H738 M862 686 H906" />
        </g>
      </Layer>
      <Layer depth="near">
        <P d={ridge(890, 8, 104)} />
        <P d={grass(ridgeAt(890, 8, 104), 107)} data-ground="each" />
        <BareTree x={96} base={900} h={720} seed={108} lean={0.12} />
        <BareTree x={1516} base={900} h={560} seed={109} lean={-0.16} />
      </Layer>
    </>
  )
}
