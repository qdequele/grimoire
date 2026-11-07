// Drawn décor: ship. On the deck of a 1920s steamer at sea, looking out over the starboard rail: the
// deckhouse with its lit portholes and the wheelhouse on top, the funnel, a mast with its crow's nest,
// shrouds and ratlines, a lifeboat under its canvas cover on two davits, coils of rope and bitts on the
// deck, a life ring on the rail; beyond, the swell, a lighthouse on a far headland and another ship's
// lights on the horizon. See the decor-artist skill.
import { type Draw, Halo, Layer, Moon, P, f, rng } from '../placeKit'

const HORIZON = 590
const RAIL = 686 // top of the rail
const DECK = 812 // the deck's edge, at the foot of the rail

/** A swell: sharp crests and rounded troughs (a trochoid), filled down past the frame. */
function swell(base: number, amp: number, len: number, phase: number): { d: string; crest: (x: number) => number } {
  // sharp crests, rounded troughs, a longer roll making some crests higher than others
  const crest = (x: number) => base - amp * (1 - Math.abs(Math.sin((x + phase) / len))) ** 2 * (0.6 + 0.4 * Math.sin((x + phase * 3) / 230)) + amp * 0.3
  let d = `M-80 900 L-80 ${f(crest(-80))}`
  for (let x = -70; x <= 1680; x += 10) d += ` L${x} ${f(crest(x))}`
  return { d: `${d} L1680 900 Z`, crest }
}

export const ship: Draw = (id) => {
  // Ripples on the far sea, and broken streaks of light under the moon and the lights.
  const r = rng(301)
  let ripples = ''
  for (let i = 0; i < 70; i++) {
    const y = HORIZON + 6 + r() ** 1.5 * 300
    const len = 10 + r() * 50 * ((y - HORIZON) / 300)
    ripples += `M${f(r() * 1600)} ${f(y)} h${f(len)} v1.4 h${f(-len)} Z `
  }
  const streak = (x: number, y0: number, y1: number, w: number, seed: number) => {
    const q = rng(seed)
    let d = ''
    for (let y = y0; y < y1; y += 6 + q() * 6) {
      const k = w * (0.4 + q() * 0.8) * (0.5 + ((y - y0) / (y1 - y0)) * 0.9)
      d += `M${f(x - k / 2 + (q() - 0.5) * w * 0.6)} ${f(y)} h${f(k)} v2 h${f(-k)} Z `
    }
    return d
  }
  const back = swell(632, 12, 46, 20)
  const front = swell(664, 18, 64, 0)
  // foam: short strokes riding the tops of some crests, following them
  const caps = (s: { crest: (x: number) => number }, len: number, phase: number, seed: number) => {
    const q = rng(seed)
    let d = ''
    for (let k = -2; k < 40; k++) {
      const x = Math.PI * len * k - phase
      if (x < -60 || x > 1660 || q() < 0.45) continue
      const a = x - 6 - q() * 14
      const b = x + 4 + q() * 16
      d += `M${f(a)} ${f(s.crest(a))}`
      for (let u = a + 3; u < b; u += 3) d += ` L${f(u)} ${f(s.crest(u))}`
      d += ' '
    }
    return d
  }

  // The rail: top rail, middle rail, stanchions.
  const stanchions = Array.from({ length: 16 }, (_, i) => -50 + i * 112).map((x) => `M${x} ${DECK + 2} V${RAIL + 6} h7 V${DECK + 2} Z`).join(' ')
  // Shrouds from the crow's nest down to the rail, ratlines across each pair.
  const shrouds: Array<[number, number]> = [[740, 772], [890, 922]]
  const ratlines = shrouds.map(([a, b]) => {
    let d = ''
    for (let y = 262; y < RAIL - 10; y += 30) {
      const t = (y - 226) / (RAIL - 226)
      const xa = (a < 826 ? 820 : 830) + (a - (a < 826 ? 820 : 830)) * t
      const xb = (b < 826 ? 822 : 832) + (b - (b < 826 ? 822 : 832)) * t
      d += `M${f(xa)} ${f(y)} H${f(xb)} `
    }
    return d
  }).join(' ')
  const portholes: Array<[number, number]> = [[90, 560], [176, 560]]

  return (
    <>
      <Layer depth="far">
        <Moon x={1240} y={190} r={40} id={id} />
        {/* the headland and its lighthouse, the steamer on the horizon */}
        <P d="M430 592 L470 584 L520 576 L566 568 L612 566 L650 572 L690 582 L730 592 Z" />
        <P d="M595 568 L597 528 H603 L605 568 Z M591 529 h18 v-3 h-18 Z M594 516 L600 509 L606 516 Z" />
        <P d="M988 592 L994 580 H1074 L1080 592 Z M1004 580 V570 H1054 V580 Z M1020 570 V556 h10 V570 Z M1062 580 V548 h2 V580 Z" />
        <path d="M603 528 L605 568" className="scr-rim" strokeWidth={1.4} />
        {/* the sea */}
        <rect x="-80" y={HORIZON} width="1760" height="320" fill="var(--sil-water)" />
      </Layer>
      <Layer depth="lit-far">
        {/* the lighthouse lamp, its beam sweeping both ways; the steamer's portholes */}
        <P d="M600 524 L250 500 L250 548 Z" fill={`url(#${id}-beam)`} />
        <P d="M600 524 L250 500 L250 548 Z" fill={`url(#${id}-beam)`} transform="scale(-1 1) translate(-1200 0)" />
        <Halo id={`${id}-halo`} x={600} y={521} r={60} />
        <P d="M596 516 h8 v10 h-8 Z" />
        <P d="M1010 584 h4 v3 h-4 Z M1022 584 h4 v3 h-4 Z M1034 584 h4 v3 h-4 Z M1046 584 h4 v3 h-4 Z M1012 573 h6 v4 h-6 Z M1040 573 h6 v4 h-6 Z" fill={`url(#${id}-glass)`} />
      </Layer>
      <Layer depth="water">
        <P d={ripples} opacity={0.18} />
        <g className="scr-moon">
          <P d={streak(1240, HORIZON + 6, 900, 70, 302)} opacity={0.3} />
        </g>
        <g className="scr-sun">
          <P d={streak(1240, HORIZON + 6, 900, 100, 302)} opacity={0.32} />
        </g>
        <g className="scr-glow">
          <P d={streak(600, HORIZON + 4, 680, 10, 303)} opacity={0.45} />
          <P d={streak(1030, HORIZON + 4, 640, 14, 304)} opacity={0.35} />
        </g>
      </Layer>
      <Layer depth="mid">
        {/* the swell running past the ship, whitecaps on its crests */}
        <P d={back.d} fill="var(--sil-back)" opacity={0.55} />
        <P d={front.d} fill="var(--sil-back)" />
        <g className="scr-rim" strokeWidth={1.6}>
          <path d={`${caps(back, 46, 20, 305)} ${caps(front, 64, 0, 306)}`} />
        </g>
      </Layer>
      <Layer depth="near">
        {/* the rail, the deck at its foot */}
        <P d={`M-80 ${RAIL} H1680 v8 H-80 Z M-80 ${RAIL + 62} H1680 v4 H-80 Z ${stanchions}`} />
        <P d={`M-80 910 V${DECK} H1680 V910 Z`} fill="var(--sil-mid)" />
        <P d={`M-80 ${DECK} H1680 v5 H-80 Z`} />
        <P d={[832, 854, 880].map((y) => `M-80 ${y} H1680 v1.5 H-80 Z`).join(' ')} opacity={0.6} />
        {/* a life ring hanging from the rail */}
        <path d={`M1238 ${RAIL + 8} V${RAIL + 22}`} stroke="currentColor" strokeWidth={2} fill="none" />
        <P d={`M1206 ${RAIL + 50} a32 32 0 1 0 64 0 a32 32 0 1 0 -64 0 Z M1218 ${RAIL + 50} a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 Z`} fillRule="evenodd" />
        {/* the davits and the lifeboat hanging from them under its canvas */}
        <P data-ground d={`M1146 ${DECK + 4} V560 Q1146 518 1188 514 L1190 524 Q1157 528 1157 560 V${DECK + 4} Z M1434 ${DECK + 4} V560 Q1434 518 1392 514 L1390 524 Q1423 528 1423 560 V${DECK + 4} Z`} />
        {/* the falls (filled, so the blocks hang on something) and their blocks */}
        <P d="M1187 520 h2.4 v70 h-2.4 Z M1389.6 520 h2.4 v70 h-2.4 Z M1184 540 h8 v12 h-8 Z M1387 540 h8 v12 h-8 Z" />
        {/* a double-ended boat: its sheer rising to both ends, the canvas humped over it */}
        <P d="M1152 578 Q1290 600 1428 578 Q1420 618 1384 642 Q1290 654 1196 642 Q1160 618 1152 578 Z M1160 584 Q1290 556 1420 584 Q1290 598 1160 584 Z" />
        {/* the mast: its foot on the deck, the crow's nest, the cross-trees, the truck at its head */}
        <P data-ground d={`M820 846 V96 h12 V846 Z M806 226 L802 198 H850 L846 226 Z M762 258 h128 v6 h-128 Z M818 96 h16 v-8 h-16 Z M812 846 v-14 h28 v14 Z`} />
        <P d="M834 296 h16 v20 h-16 Z M836 294 h12 v-3 h-12 Z" />
        {/* shrouds and ratlines, the stays: each rope ends on what holds it */}
        <g stroke="currentColor" fill="none" strokeWidth={1.6}>
          <path d={`M820 226 L740 ${RAIL} M822 226 L772 ${RAIL} M830 226 L890 ${RAIL} M832 226 L922 ${RAIL} M826 100 L404 420 M826 100 L1100 ${RAIL}`} />
          <path d={ratlines} strokeWidth={1} />
        </g>
        {/* coils of rope and a pair of bitts on the deck */}
        <P data-ground d="M540 876 a60 16 0 1 0 120 0 a60 16 0 1 0 -120 0 Z" />
        <g fill="none" stroke="var(--sil-mid)" strokeWidth={2} opacity={0.8}>
          <path d="M556 872 a44 11 0 1 0 88 0 a44 11 0 1 0 -88 0 M572 869 a28 7 0 1 0 56 0 a28 7 0 1 0 -56 0" />
        </g>
        <P data-ground d="M980 864 v-38 h20 v38 Z M1032 864 v-38 h20 v38 Z M976 828 h28 v-6 h-28 Z M1028 828 h28 v-6 h-28 Z M1000 840 h32 v8 h-32 Z" />
        <path d="M990 836 q26 14 52 0 q-26 -14 -52 0" stroke="var(--sil-mid)" strokeWidth={4} fill="none" />
        {/* the deckhouse, the wheelhouse on its roof, the funnel behind */}
        {/* (raked aft) */}
        <P d="M160 312 L146 122 H256 L270 312 Z M140 124 h122 v-12 h-122 Z" />
        <P d="M149 162 h110 l1.4 18 h-110 Z" fill="var(--sil-back)" opacity={0.6} />
        <P data-ground d="M-80 850 V430 H400 V850 Z M-92 432 h504 v-16 h-504 Z M40 418 V300 H330 V418 Z M28 302 h314 v-12 h-314 Z" />
        <P d="M220 850 V650 h62 V850 Z" fill="var(--sil-mid)" opacity={0.6} />
        {/* the lantern on its bracket at the deckhouse's corner */}
        <P d="M398 600 h40 v4 h-40 Z M432 604 h4 v10 h-4 Z M422 614 h24 v6 h-24 Z M422 652 h24 v6 h-24 Z M424 620 h3 v32 h-3 Z M441 620 h3 v32 h-3 Z" />
        <g className="scr-rim" strokeWidth={2}>
          <path d={`M400 ${RAIL} H820 M832 ${RAIL} H1146 M1157 ${RAIL} H1423 M1434 ${RAIL} H1680 M1238 ${RAIL + 18} A32 32 0 0 1 1270 ${RAIL + 50} M-92 416 H412 M28 290 H342 M256 124 L268.4 290 M1160 584 Q1290 556 1420 584 M832 96 V198 M832 226 V258 M832 264 V294 M832 316 V${RAIL}`} />
        </g>
        {portholes.map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r={19} className="scr-rim" strokeWidth={3} />
        ))}
      </Layer>
      <Layer depth="lit-near">
        {/* portholes and wheelhouse windows, the masthead light */}
        <P d={portholes.map(([x, y]) => `M${x - 15} ${y} a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0 Z`).join(' ')} fill={`url(#${id}-glass)`} />
        <P d="M62 320 h46 v44 h-46 Z M126 320 h46 v44 h-46 Z M190 320 h46 v44 h-46 Z M254 320 h46 v44 h-46 Z" fill={`url(#${id}-glass)`} opacity={0.85} />
        <Halo id={`${id}-halo`} x={842} y={306} r={90} />
        <P d="M837 299 h10 v14 h-10 Z" />
      </Layer>
      <Layer depth="pulse">
        <g className="scr-glow">
          <Halo id={`${id}-halo`} x={434} y={636} r={170} />
          <P d="M427 620 h14 v32 h-14 Z" />
        </g>
      </Layer>
    </>
  )
}
