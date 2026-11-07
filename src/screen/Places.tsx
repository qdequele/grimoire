// Drawn décors for the ambiance screen: a place in silhouettes, when the scene has no picture.
// Original drawings, generated from code (seeded, so a place always looks the same).
//
// Each place is a few full-screen SVG layers (far, mid, near…), all on the same 1600×900 frame anchored
// at the bottom. The layers drift at different speeds (parallax) and the lit layer breathes: each layer is
// its own element, so the browser only moves and fades it (screen.css, `.scr-par`), it never redraws.
// Colours come from the preset's palette (CSS variables), so a graveyard is blue in the night, green
// during a ritual, red in a nightmare.
import { useId, type ReactNode } from 'react'
import type { PlaceId } from './ambiance'
import {
  BareTree,
  Defs,
  type Draw,
  Fence,
  H,
  Halo,
  Layer,
  Moon,
  P,
  W,
  arched,
  bat,
  cross,
  crow,
  f,
  gothic,
  grass,
  jagged,
  merlons,
  motorCar,
  pine,
  ragPine,
  ridge,
  ridgeAt,
  rng,
  stone,
} from './placeKit'
import { asylum } from './places/asylum'
import { station } from './places/station'
import { swamp } from './places/swamp'
import { dig } from './places/dig'
import { mountain } from './places/mountain'
import { museum } from './places/museum'
import { cavern } from './places/cavern'
import { farm } from './places/farm'
import { ship } from './places/ship'
import { fair } from './places/fair'
import { mine } from './places/mine'
import { moor } from './places/moor'

// ------------------------------------------------------------------ the places


const church: Draw = (id) => {
  // A gothic parish church seen from the side: west tower and spire, a tall nave with its clerestory
  // above a lower aisle, buttresses rising into pinnacles, a round apse at the east end.
  const piers = [700, 796, 892, 988, 1084, 1180]
  const bays = piers.slice(0, -1).map((x) => x + 48)
  const clerestory = bays.map((c) => gothic(c - 15, 548, 30, 92)).join(' ')
  const aisle = bays.map((c) => gothic(c - 17, 764, 34, 66)).join(' ')
  const apse = `${gothic(1214, 680, 18, 110)} ${gothic(1252, 680, 18, 110)}`
  const belfry = `${gothic(584, 404, 18, 52)} ${gothic(618, 404, 18, 52)}`
  // Mullions and transoms over the lit glass.
  const tracery = [
    ...bays.map((c) => `M${c} 530 V640 M${c - 15} 596 H${c + 15}`),
    ...bays.map((c) => `M${c} 750 V830`),
    'M1223 666 V790 M1261 666 V790',
  ].join(' ')
  const rose = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    return `M${f(620 + Math.cos(a) * 10)} ${f(530 + Math.sin(a) * 10)} L${f(620 + Math.cos(a) * 30)} ${f(530 + Math.sin(a) * 30)}`
  }).join(' ')
  const pinnacle = (x: number, y: number, w: number, h: number) => `M${x - w / 2} ${y} L${x} ${y - h} L${x + w / 2} ${y} Z`
  return (
    <>
      <Layer depth="far">
        <Moon x={1250} y={190} r={46} id={id} />
        <P d={ridge(640, 46, 15, 30)} fill="var(--sil-haze)" />
        <P d={ridge(700, 50, 11)} />
        {/* a hamlet on the far hill, one window still awake */}
        <P d={`${pine(120, 690, 70, 34)} ${pine(160, 694, 52, 28)} ${pine(1500, 668, 80, 36)} ${pine(1540, 672, 60, 30)} M300 700 V668 L322 650 L344 668 V700 Z M352 700 V676 H392 V700 Z M372 676 v-12 h6 v12 Z`} />
        <P d="M312 680 h7 v9 h-7 Z" fill="var(--lit)" className="scr-glow" opacity={0.7} />
      </Layer>
      <Layer depth="mid">
        {/* walls go down below the ground line (it dips to ~880: stopping at 870 left a strip of the far
            hills under the church) */}
        {/* the clerestory wall, set back behind the aisle */}
        <P d="M692 900 V474 H1180 V900 Z" fill="var(--sil-back)" />
        {/* nave roof */}
        <P d="M684 478 L712 384 H1156 L1188 478 Z" />
        {/* aisle: wall and lean-to roof */}
        <P data-ground d="M692 900 V724 H1180 V900 Z M688 728 L700 664 H1176 L1184 728 Z" />
        {/* buttresses: stepped piers rising into pinnacles above the aisle roof */}
        <P d={piers.map((x) => `M${x - 14} 900 V780 l4 -10 V622 h20 V770 l4 10 V900 Z ${pinnacle(x, 624, 18, 60)}`).join(' ')} />
        {/* the apse and its conical roof */}
        <P data-ground d="M1176 900 V650 H1294 V900 Z M1170 654 Q1196 600 1235 568 Q1274 600 1300 654 Z" />
        {/* tower: stages, string courses, corner buttresses, parapet and pinnacles */}
        <P data-ground d="M548 900 V364 H692 V900 Z M542 604 h156 v10 h-156 Z M542 472 h156 v10 h-156 Z M538 364 h164 v-16 h-164 Z" />
        <P d={`M520 900 V760 l10 -14 V604 h18 V900 Z ${pinnacle(546, 350, 16, 54)} ${pinnacle(694, 350, 16, 54)} M555 348 h10 v-12 h-10 Z M675 348 h10 v-12 h-10 Z`} />
        {/* one merlon in each gap between a corner pinnacle and the spire: spaced from the parapet's end, a lone one stuck out on the left only */}
        {/* the spire and its cross */}
        <P d={`M566 352 L620 104 L674 352 Z ${cross(620, 108, 58)}`} />
        {/* belfry louvres: dark slats in the openings */}
        <P d={belfry} fill="var(--sil-near)" />
        <P d={[0, 1, 2, 3, 4].map((i) => `M584 ${412 + i * 9} h18 v3 h-18 Z M618 ${412 + i * 9} h18 v3 h-18 Z`).join(' ')} fill="var(--sil-back)" />
        {/* the buttresses' and pinnacles' faces turned from the moon, in shadow (without them the pinnacles,
            as dark as the wall behind, showed only as their moonlit edge: a stroke floating on the wall) */}
        <P d={piers.map((x) => `M${x - 14} 900 V780 l4 -10 V622 h7 V900 Z M${x - 9} 624 L${x} 564 L${x} 624 Z`).join(' ')} fill="var(--sil-near)" opacity={0.55} />
        {/* moonlight on the edges facing the moon */}
        <g className="scr-rim" strokeWidth={2}>
          <path d="M620 108 L673.1 348 M1156 384 L1188 478 M712 384 H1156 M1235 568 Q1274 600 1300 654 M700 664 H1176 M538 348 H702" />
          <path d={piers.map((x) => `M${x} 564 L${x + 9} 624 V664`).join(' ')} />
        </g>
        <P d={ridge(872, 8, 12)} />
      </Layer>
      <Layer depth="lit">
        <Halo id={`${id}-halo`} x={620} y={830} r={170} o={0.75} />
        <Halo id={`${id}-halo`} x={940} y={600} r={330} o={0.25} />
        <g fill={`url(#${id}-glass)`}>
          <path d={`${clerestory} ${aisle} ${apse}`} />
          <circle cx={620} cy={530} r={30} />
          {/* the west door, open */}
          <path d={gothic(596, 796, 48, 74)} />
        </g>
        <g stroke="var(--sil-mid)" strokeWidth={3} fill="none">
          <path d={tracery} />
          <path d={rose} />
          <circle cx={620} cy={530} r={10} />
          <circle cx={620} cy={530} r={30} strokeWidth={4} />
        </g>
        {/* light spilling from the door and the aisle windows onto the ground */}
        <P d="M596 900 H644 L720 900 H520 Z" fill={`url(#${id}-ray)`} />
        <P d={bays.map((c) => `M${c - 17} 872 h34 l14 28 h-62 Z`).join(' ')} fill={`url(#${id}-ray)`} opacity={0.6} />
      </Layer>
      <Layer depth="near">
        <P d={`${stone(110, 904, 62, 126)} ${cross(220, 904, 160)} ${stone(325, 904, 44, 78)} ${stone(400, 904, 30, 52)} ${stone(1250, 904, 52, 96)} ${cross(1160, 904, 112)} ${stone(1340, 904, 36, 60)}`} />
        <BareTree x={1450} base={904} h={640} seed={13} lean={-0.08} />
        <P d={ridge(892, 8, 14)} />
        <P d={grass(ridgeAt(892, 8, 14), 16)} data-ground="each" />
      </Layer>
    </>
  )
}

const graveyard: Draw = (id) => {
  // An old churchyard: rows of stones running back up the hill, a gravel path from the gate to a small
  // mausoleum, a mourning statue, the chapel far up on the hill.
  const r = rng(21)
  const path = (y: number) => {
    // The path's half-width and centre at a height: narrow at the mausoleum, wide at the gate.
    const t = (y - 790) / 110
    return { c: 1080, w: 80 + t * 70 }
  }
  const row = (y0: number, n: number, scale: number, skipStatue: boolean) => {
    const out: ReactNode[] = []
    for (let i = 0; i < n; i++) {
      const x = -20 + (i + r()) * (1640 / n)
      const y = y0 + r() * 10
      const p = path(y)
      if (Math.abs(x - p.c) < p.w + 40 * scale) continue
      if (skipStatue && (Math.abs(x - 560) < 50 || Math.abs(x - 685) < 60 || Math.abs(x - 1330) < 55)) continue
      const h = (44 + r() * 46) * scale
      const tilt = (r() - 0.5) * 12
      const kind = r()
      const d = kind < 0.28 ? cross(x, y, h * 1.4) : kind < 0.36 ? `M${f(x - h * 0.16)} ${f(y)} L${f(x - h * 0.1)} ${f(y - h * 1.3)} L${f(x)} ${f(y - h * 1.45)} L${f(x + h * 0.1)} ${f(y - h * 1.3)} L${f(x + h * 0.16)} ${f(y)} Z` : stone(x, y, h * 0.62, h)
      out.push(<P key={i} d={d} transform={`rotate(${f(tilt)} ${f(x)} ${f(y)})`} />)
    }
    return out
  }
  const farStones = row(726, 34, 0.42, false)
  const midStones = row(792, 20, 0.9, true)
  return (
    <>
      <Layer depth="far">
        <Moon x={1250} y={168} r={50} id={id} />
        <P d={ridge(610, 40, 27, 30)} fill="var(--sil-haze)" />
        <P d={ridge(700, 42, 22)} />
        {/* the chapel up on the hill: a small nave and its bell tower, a lantern at the door */}
        <P d={`M296 704 V652 H366 V704 Z M290 656 L331 626 L372 656 Z M268 704 V622 H296 V704 Z M264 624 L282 572 L300 624 Z ${cross(282, 576, 22)}`} />
        <P d="M325 684 h10 v14 h-10 Z" fill="var(--lit)" className="scr-glow" opacity={0.8} />
        {farStones}
        <BareTree x={540} base={712} h={200} seed={23} />
        <BareTree x={1480} base={700} h={230} seed={24} />
      </Layer>
      <Layer depth="mid">
        <P d={ridge(796, 12, 25)} />
        {/* the gravel path, paler than the grass, from the gate up to the mausoleum */}
        <P d="M1010 800 H1150 L1240 904 H920 Z" fill="var(--sil-back)" opacity={0.75} />
        {midStones}
        {/* the mausoleum: steps, walls, pilasters, pediment, urns, a dark door */}
        <P data-ground d="M980 800 V788 H1180 V800 Z M992 788 V776 H1168 V788 Z M1004 776 V764 H1156 V776 Z" />
        <P d="M1014 766 V610 H1146 V766 Z M1000 612 H1160 V588 H1000 Z M994 590 L1080 532 L1166 590 Z" />
        <P d="M1072 534 a8 8 0 1 1 16 0 l4 10 h-24 Z M994 588 a6 6 0 1 1 12 0 l3 8 h-18 Z M1154 588 a6 6 0 1 1 12 0 l3 8 h-18 Z" />
        <P d="M1054 766 V698 A26 26 0 0 1 1106 698 V766 Z" fill="var(--sil-near)" />
        <P d="M1014 766 V612 h10 V766 Z M1136 766 V612 h10 V766 Z" fill="var(--sil-near)" opacity={0.5} />
        {/* a hooded mourner on a plinth, head bowed; two chest tombs */}
        <P d="M526 808 V772 H594 V808 Z M534 772 V760 H586 V772 Z M540 760 Q542 712 550 690 Q552 664 566 656 Q584 652 588 672 Q586 684 578 690 Q586 716 584 760 Z" />
        <P d="M640 812 V786 H730 V812 Z M634 788 H736 v-8 H634 Z M1290 812 V790 H1370 V812 Z M1284 792 H1376 v-8 H1284 Z" />
        <g className="scr-rim" strokeWidth={2}>
          <path d="M1080 532 L1166 590 M1146 612 V766 M1146 764 H1156 M1156 776 H1168 M1168 788 H1180 M588 672 Q586 684 578 690 Q586 716 584 760 M736 780 H634 M1376 784 H1284" />
        </g>
      </Layer>
      <Layer depth="lit">
        {/* a thread of light under the mausoleum door: something inside is awake */}
        <P d="M1056 762 h48 v3 h-48 Z M1079 676 v86 h2 v-86 Z" opacity={0.75} />
        <Halo id={`${id}-halo`} x={1080} y={764} r={70} o={0.5} />
      </Layer>
      <Layer depth="near">
        <BareTree x={200} base={904} h={740} seed={26} lean={0.1} />
        {/* kept inside the frame at both ends of the drift: at x 1520 the cross slid out, leaving its arm and the crow in the air */}
        <P d={`${stone(1330, 908, 96, 176)} ${cross(1450, 908, 210)} ${stone(60, 910, 70, 120)} ${crow(1450, 908 - 210, 1.3, true)}`} />
        <Fence y={904} h={96} gateFrom={980} gateTo={1180} />
        <P d={crow(973, 904 - 96 - 56, 1.1)} />
        {/* a lantern on a bracket, on the right gate pillar */}
        <P d="M1202 780 h26 v3 h-26 Z M1219 783 h6 v4 h-6 Z M1214 792 h16 l-3 -6 h-10 Z M1214 816 h16 v5 h-16 Z M1215 792 h2 v24 h-2 Z M1227 792 h2 v24 h-2 Z" />
        <P d={grass(904, 28)} data-ground="each" />
      </Layer>
      <Layer depth="pulse">
        <g className="scr-glow">
          <Halo id={`${id}-halo`} x={1222} y={804} r={150} />
          <P d="M1217 792 h10 v24 h-10 Z" />
        </g>
      </Layer>
    </>
  )
}

const crypt: Draw = (id) => {
  // A burial corridor in one-point perspective: vaulted bays, each one lighter as it nears the lit
  // doorway at the far end, burial niches in the side walls, a stone coffin in the foreground.
  const cx = 800
  const vy = 540
  const floor = (s: number) => vy + (920 - vy) * s
  const spring = (s: number) => floor(s) - 540 * s
  const hw = (s: number) => 520 * s // inner edge of a rib
  const ww = (s: number) => 590 * s // the wall behind the ribs
  const frames = [1, 0.6, 0.38, 0.25, 0.17]
  const back = 0.12
  const archBand = (s: number) => {
    const fl = floor(s)
    const sp = spring(s)
    return `M${f(cx - ww(s))} ${f(fl)} V${f(sp)} A${f(ww(s))} ${f(ww(s))} 0 0 1 ${f(cx + ww(s))} ${f(sp)} V${f(fl)} H${f(cx + hw(s))} V${f(sp)} A${f(hw(s))} ${f(hw(s))} 0 0 0 ${f(cx - hw(s))} ${f(sp)} V${f(fl)} Z`
  }
  // One bay (between two frames): both side walls and the vault, as one shape.
  const bay = (a: number, b: number) => {
    const L = (s: number) => cx - ww(s)
    const R = (s: number) => cx + ww(s)
    return `M${f(L(a))} ${f(floor(a))} V${f(spring(a))} A${f(ww(a))} ${f(ww(a))} 0 0 1 ${f(R(a))} ${f(spring(a))} V${f(floor(a))} L${f(R(b))} ${f(floor(b))} V${f(spring(b))} A${f(ww(b))} ${f(ww(b))} 0 0 0 ${f(L(b))} ${f(spring(b))} V${f(floor(b))} Z`
  }
  // Burial niches in the side walls of a bay: quads by interpolation along the wall (u: depth, v: height).
  const niches = (a: number, b: number, cols: number, shrouds = true) => {
    const holes: string[] = []
    const skulls: string[] = []
    const r = rng(Math.round(a * 1000))
    for (const side of [-1, 1]) {
      const at = (u: number, v: number) => {
        const s = a + (b - a) * u
        return [cx + side * ww(s), floor(s) + (spring(s) - floor(s)) * v]
      }
      for (let i = 0; i < cols; i++) {
        for (const [v1, v2] of [[0.1, 0.3], [0.4, 0.6], [0.7, 0.88]]) {
          const u1 = 0.12 + (i / cols) * 0.8
          const u2 = u1 + 0.5 / cols
          const p = [at(u1, v1), at(u2, v1), at(u2, v2), at(u1, v2)]
          holes.push(`M${p.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`)
          if (r() < 0.45 && shrouds) {
            // a shrouded shape lying in the niche
            const q = [at(u1 + 0.02, v1 + 0.02), at(u2 - 0.02, v1 + 0.02), at(u2 - 0.03, v1 + 0.08), at(u1 + 0.03, v1 + 0.09)]
            skulls.push(`M${q.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`)
          }
        }
      }
    }
    return { holes: holes.join(' '), skulls: skulls.join(' ') }
  }
  const nA = niches(1, 0.6, 2, false)
  const nB = niches(0.6, 0.38, 2)
  const nC = niches(0.38, 0.25, 1)
  const shades = ['var(--cr-1)', 'var(--cr-2)', 'var(--cr-3)', 'var(--cr-4)']
  // Steps up to the door, catching its light.
  const steps = Array.from({ length: 4 }, (_, i) => {
    const s = 0.17 - i * 0.012
    const y = floor(s) - i * 6
    return `M${f(cx - 46 + i * 2)} ${f(y)} h${f(92 - i * 4)} v2.5 h${f(-92 + i * 4)} Z`
  }).join(' ')
  const doorTop = floor(back) - 100
  const door = `M${cx - 40} ${f(floor(back))} V${f(doorTop + 40)} A40 40 0 0 1 ${cx + 40} ${f(doorTop + 40)} V${f(floor(back))} Z`
  return (
    <>
      <Layer depth="far">
        {/* the end wall (plain: no edge to show the drift) */}
        <P d={`M-80 -10 H${W + 80} V${H} H-80 Z`} fill="var(--cr-5)" />
      </Layer>
      <Layer depth="mid">
        {/* the floor, then each bay, nearest first, lighter as it nears the door */}
        <P d={`M${f(cx - ww(1.2))} ${f(floor(1.2))} H${f(cx + ww(1.2))} L${f(cx + ww(back))} ${f(floor(back))} H${f(cx - ww(back))} Z`} fill="var(--cr-0)" />
        {frames.map((a, i) => (
          <P key={a} d={bay(i === 0 ? 1.25 : a, frames[i + 1] ?? back)} fill={shades[Math.min(i, 3)]} />
        ))}
        <P d={`${nA.holes} ${nB.holes} ${nC.holes}`} fill="var(--cr-0)" opacity={0.85} />
        <P d={`${nA.skulls} ${nB.skulls} ${nC.skulls}`} fill="var(--cr-3)" opacity={0.6} />
        {/* the ribs: darker, against the light behind them */}
        {frames.slice(1).map((s, i) => <P key={s} d={archBand(s)} fill={shades[Math.max(0, i - 1)]} />)}
        <P d={frames.slice(1).map((s) => `M${f(cx - ww(s) - 4 * s)} ${f(spring(s))} h${f(ww(s) - hw(s) + 8 * s)} v${f(14 * s)} h${f(-(ww(s) - hw(s) + 8 * s))} Z M${f(cx + hw(s) - 4 * s)} ${f(spring(s))} h${f(ww(s) - hw(s) + 8 * s)} v${f(14 * s)} h${f(-(ww(s) - hw(s) + 8 * s))} Z`).join(' ')} fill="var(--cr-0)" />
        {/* the doorway at the corridor's end, drawn with it: in the back layer it slid inside the corridor's
            end, away from its steps and the light it spills */}
        <P d={door} fill={`url(#${id}-glass)`} />
        <P d={steps} fill="var(--lit)" opacity={0.35} />
      </Layer>
      <Layer depth="lit">
        <Halo id={`${id}-halo`} x={cx} y={floor(back) - 50} r={260} o={0.75} />
        {/* the door's light running along the floor */}
        <P d={`M${cx - 40} ${f(floor(back))} H${cx + 40} L${cx + 260} 920 H${cx - 260} Z`} fill={`url(#${id}-ray)`} opacity={0.8} />
      </Layer>
      <Layer depth="near">
        {/* the nearest pillars, framing the view (their arch is above the screen) */}
        <P d={`M-80 -10 H${W + 80} V${H + 20} H-80 Z M${cx - hw(1)} 930 V${spring(1)} A${hw(1)} ${hw(1)} 0 0 1 ${cx + hw(1)} ${spring(1)} V930 Z`} fillRule="evenodd" />
        {/* courses of stone on the nearest pillars */}
        <P d={Array.from({ length: 16 }, (_, j) => `M-80 ${j * 58 + 20} H${cx - hw(1) - 2} v3 H-80 Z M${cx + hw(1) + 2} ${j * 58 + 20} H${W + 80} v3 H${cx + hw(1) + 2} Z ${Array.from({ length: 6 }, (_, i) => { const x = -60 + i * 64 + (j % 2) * 32; const xr = x + cx + hw(1) + 40; return `${x < cx - hw(1) - 6 ? `M${x} ${j * 58 + 23} v55 h3 v-55 Z` : ''} ${xr < W + 60 ? `M${xr} ${j * 58 + 23} v55 h3 v-55 Z` : ''}` }).join(' ')}`).join(' ')} fill="var(--cr-2)" opacity={0.18} />
        {/* a stone coffin: its end towards us, the gabled lid running back into the dark */}
        <P d="M690 930 V766 H910 V930 Z" />
        <P d="M676 770 L800 728 L924 770 Z" />
        <P d="M676 770 L800 728 L800 690 L701 723 Z" fill="var(--cr-2)" />
        <P d="M924 770 L800 728 L800 690 L899 723 Z" fill="var(--cr-1)" />
        <P d="M794 790 h12 v84 h-12 Z M772 812 h56 v12 h-56 Z" fill="var(--cr-1)" />
        {/* two iron candle stands */}
        <P d="M376 930 l22 -20 v-186 h-12 v-10 h44 v10 h-12 v186 l22 20 Z M1180 930 l22 -20 v-186 h-12 v-10 h44 v10 h-12 v186 l22 20 Z" />
      </Layer>
      <Layer depth="pulse">
        <Halo id={`${id}-halo`} x={408} y={690} r={200} />
        <Halo id={`${id}-halo`} x={1212} y={690} r={200} />
        <P d="M402 714 v-22 h12 v22 Z M1206 714 v-22 h12 v22 Z" className="scr-wax" />
        <P d="M408 692 q-7 -10 0 -24 q7 14 0 24 Z M1212 692 q-7 -10 0 -24 q7 14 0 24 Z" />
      </Layer>
    </>
  )
}

const castle: Draw = (id) => {
  // A fortress on a crag above a valley: keep, round towers, a slender watchtower, the great hall,
  // a gatehouse reached by an arched bridge from the next outcrop. The moon is on the left.
  const roundTower = (x: number, w: number, base: number, top: number, roof: number) =>
    `M${x} ${base} V${top} H${x + w} V${base} Z M${x - 8} ${top + 4} L${x + w / 2} ${top - roof} L${x + w + 8} ${top + 4} Z M${x - 6} ${top + 6} h${w + 12} v-8 h${-w - 12} Z`
  const corbels = (x1: number, x2: number, y: number) => {
    let d = ''
    for (let x = x1; x < x2; x += 14) d += `M${x} ${y} h8 v10 h-8 Z `
    return d
  }
  const win = (x: number, y: number, w = 14, h = 26) => arched(x, y, w, h)
  return (
    <>
      <Layer depth="far">
        <Moon x={360} y={180} r={50} id={id} />
        <P d={ridge(520, 170, 37, 30)} fill="var(--sil-haze)" />
        <P d={ridge(640, 120, 31, 30)} />
        {/* bats in flight: free in the sky on purpose (data-free, see e2e/decors.spec.ts) */}
        <P data-free d={`${bat(1180, 190, 0.9)} ${bat(1240, 240, 0.7)} ${bat(1130, 260, 0.6)}`} />
      </Layer>
      <Layer depth="mid">
        {/* the crag, the outcrop on the left, and the bridge between them */}
        <P d={jagged([[560, 910], [610, 790], [660, 720], [690, 650], [720, 628], [1000, 640], [1290, 630], [1330, 660], [1380, 720], [1440, 790], [1530, 910]], 38, 14)} />
        <P d={jagged([[120, 910], [180, 800], [250, 742], [330, 716], [420, 712], [460, 760], [480, 910]], 39, 12)} />
        <P d={`M400 716 L700 650 v18 L400 734 Z ${[0, 1, 2].map((i) => { const x = 440 + i * 86; const y = 728 - i * 19; return `M${x} ${y} V910 h16 V${y} Z` }).join(' ')}`} />
        {/* (the arches' top runs up into the deck: two shapes sharing an edge leave a light hairline between them) */}
        {/* the piers go down to the valley floor: the middle one stands over the chasm (it stopped in mid-air) */}
        <P d="M410 728 L700 662 V700 Q660 690 640 720 Q620 700 586 730 Q566 712 532 750 Q512 732 478 770 Q460 750 420 790 Z" />
        {/* curtain wall with its walkway corbels and merlons */}
        <P d={`M700 640 V540 H1290 V640 Z ${merlons(700, 1290, 540, 14)} ${corbels(702, 1290, 548)}`} />
        {/* gatehouse */}
        <P d={`M720 640 V500 H808 V640 Z ${merlons(720, 808, 500, 11)}`} />
        {/* keep with its corner turrets */}
        <P d={`M860 600 V300 H1020 V600 Z ${merlons(860, 1020, 300, 14)} ${roundTower(842, 24, 330, 296, 44)} ${roundTower(1014, 24, 330, 296, 44)}`} />
        {/* slender watchtower and its pennant */}
        <P d={`${roundTower(1046, 46, 600, 220, 110)} M1068 112 v-40 h3 v40 Z M1071 74 l30 8 l-30 8 Z`} />
        {/* great hall, chimney */}
        <P d="M1100 600 V500 H1250 V600 Z M1092 504 L1175 448 L1258 504 Z M1210 476 V430 h16 v46 Z" />
        {/* round towers at the corners */}
        <P d={`${roundTower(668, 58, 660, 430, 96)} ${roundTower(1262, 58, 660, 460, 90)}`} />
        {/* faces turned from the moon */}
        <P d="M1000 600 V318 h20 V600 Z M1078 600 V226 h14 V600 Z M708 660 V436 h18 V660 Z M1302 660 V466 h18 V660 Z" fill="var(--sil-near)" opacity={0.4} />
        {/* the crag's faces: lit ledges turned to the moon, cracks in the rock */}
        <P d="M600 800 L640 760 L668 770 L630 820 Z M650 712 L686 660 L700 668 L672 724 Z M570 880 L600 830 L622 842 L596 900 Z M720 700 L760 660 L790 668 L750 716 Z M180 812 L240 752 L262 760 L210 822 Z M300 730 L360 718 L370 730 L320 748 Z" fill="var(--sil-back)" opacity={0.5} />
        <g fill="none" stroke="var(--sil-near)" strokeWidth={3} strokeLinejoin="round" opacity={0.6}>
          <path d="M820 660 L840 720 L828 780 L850 860 M1000 650 L990 700 L1012 760 M1180 650 L1200 700 L1190 760 L1220 840 M1330 690 L1310 740 L1340 800 M260 760 L280 820 L270 880" />
        </g>
        <g className="scr-rim" strokeWidth={2}>
          <path d="M660 434 L697 334 M1038 226 L1069 110 M1254 464 L1291 370 M834 300 L854 252 M1092 504 L1175 448" />
        </g>
      </Layer>
      <Layer depth="lit">
        <Halo id={`${id}-halo`} x={764} y={600} r={120} o={0.55} />
        <g fill={`url(#${id}-glass)`}>
          <path d={`${win(900, 360)} ${win(950, 420)} ${win(905, 500)} ${win(1062, 300, 12, 22)} ${win(1062, 420, 12, 22)} ${win(690, 500)} ${win(1284, 520)} ${win(1120, 530, 16, 34)} ${win(1150, 530, 16, 34)} ${win(1180, 530, 16, 34)}`} />
          {/* the gate, lit from within, its portcullis half raised */}
          <path d="M744 640 V600 A20 20 0 0 1 784 600 V640 Z" />
        </g>
        <P d="M744 640 V600 A20 20 0 0 1 784 600 V616 H744 Z M750 616 v24 h3 v-24 Z M760 616 v24 h3 v-24 Z M770 616 v24 h3 v-24 Z" fill="var(--sil-mid)" opacity={0.85} />
        <Halo id={`${id}-halo`} x={940} y={440} r={200} o={0.3} />
      </Layer>
      <Layer depth="near">
        <P d={ridge(884, 22, 32)} />
        <P d={grass(ridgeAt(884, 22, 32), 35)} data-ground="each" />
        <BareTree x={150} base={904} h={560} seed={33} lean={0.15} />
        <BareTree x={1500} base={904} h={380} seed={34} lean={-0.2} />
      </Layer>
    </>
  )
}

const manor: Draw = (id) => {
  // A Victorian mansion: mansard roof with dormers and iron cresting, a central tower with a bell-shaped
  // cap, a gabled wing with a bay window, a veranda on slim columns. One window upstairs has someone in it.
  const r = rng(41)
  const sash = (x: number, y: number, w: number, h: number) => `M${x} ${y} h${w} v${h} h${-w} Z`
  const upper = [560, 636, 712, 948, 1024, 1100].map((x) => sash(x, 600, 34, 66))
  const lower = [560, 636, 712, 948, 1024, 1100].map((x) => sash(x, 742, 34, 70))
  const tower = [arched(822, 372, 36, 60), arched(822, 476, 36, 66), arched(822, 590, 36, 66)]
  const dormers = [600, 690, 990, 1080]
  const lit = new Set([1, 4, 7, 9, 13, 16])
  const all = [...upper, ...lower, ...tower, ...dormers.map((x) => arched(x + 4, 500, 22, 34)), arched(420, 740, 22, 50), arched(452, 736, 26, 56)]
  const litD = all.filter((_, i) => lit.has(i)).join(' ')
  const darkD = all.filter((_, i) => !lit.has(i)).join(' ')
  const cresting = (x1: number, x2: number, y: number) => {
    let d = `M${x1} ${y} h${x2 - x1} v-3 h${x1 - x2} Z`
    for (let x = x1 + 4; x < x2; x += 12) d += ` M${x} ${y} v-12 l2 -4 l2 4 v12 Z`
    return d
  }
  // Pines on the far ridge, in uneven clumps.
  const pines: string[] = []
  for (let x = -30; x < W + 30; x += 18 + r() * 60) {
    if (r() < 0.25) continue
    pines.push(pine(x, 712 + r() * 14, 70 + r() * 70, 34 + r() * 16))
  }
  return (
    <>
      <Layer depth="far">
        <Moon x={1290} y={180} r={44} id={id} />
        <P d={ridge(640, 40, 46, 30)} fill="var(--sil-haze)" />
        <P d={ridge(716, 34, 42)} />
        <P d={pines.join(' ')} />
      </Layer>
      <Layer depth="mid">
        <P d={ridge(830, 10, 43)} />
        {/* the gabled wing and its bay window */}
        <P data-ground d="M370 836 V640 H530 V836 Z M358 644 L450 560 L542 644 Z M404 836 V712 L416 700 H484 L496 712 V836 Z M400 712 L420 690 H480 L500 712 Z" />
        {/* main block and mansard roof with its dormers and cresting */}
        <P data-ground d={`M520 836 V566 H1180 V836 Z M508 570 L530 478 H1170 L1192 570 Z ${cresting(530, 1170, 478)}`} />
        <P d={dormers.map((x) => `M${x} 544 V500 L${x + 15} 482 L${x + 30} 500 V544 Z`).join(' ')} />
        {/* chimneys */}
        <P d="M590 482 V404 h46 v78 Z M584 408 h58 v-10 h-58 Z M596 398 v-10 h10 v10 Z M618 398 v-14 h10 v14 Z M1076 482 V396 h46 v86 Z M1070 400 h58 v-10 h-58 Z M1082 390 v-12 h10 v12 Z M1104 390 v-10 h10 v10 Z" />
        {/* the tower, its bell-shaped cap and finial */}
        <P d={`M786 836 V350 H894 V836 Z M776 354 H904 v-12 H776 Z M780 344 Q808 320 816 270 H864 Q872 320 900 344 Z ${cresting(816, 864, 270)} M838 270 V214 l2 -8 l2 8 V270 Z`} />
        <circle cx={840} cy={240} r={5} />
        <P d="M818 330 v-26 a6 6 0 0 1 12 0 v26 Z M850 330 v-26 a6 6 0 0 1 12 0 v26 Z" fill="var(--sil-near)" opacity={0.6} />
        {/* window panes, dark */}
        <P d={darkD} fill="var(--sil-near)" opacity={0.55} />
        <g className="scr-rim" strokeWidth={2}>
          <path d="M1170 478 L1192 570 M864 270 Q872 320 900 344 M450 560 L542 644 M530 478 H1170 M1122 396 V478" />
        </g>
      </Layer>
      <Layer depth="lit">
        <Halo id={`${id}-halo`} x={840} y={780} r={170} o={0.65} />
        <P d={litD} fill={`url(#${id}-glass)`} />
        {/* the front door, open */}
        <P d="M818 816 V748 A22 22 0 0 1 862 748 V816 Z" fill={`url(#${id}-glass)`} />
        {/* sash bars over the lit panes */}
        <P d={[...upper, ...lower].filter((_, i) => lit.has(i)).map((d) => { const [x, y] = d.slice(1).split(' ').map(Number); return `M${x + 16} ${y} v${70} M${x} ${y + 30} h34` }).join(' ')} stroke="var(--sil-mid)" strokeWidth={3} fill="none" />
        {/* someone standing at the window upstairs */}
        <P d="M641 666 V650 Q641 640 650 637 Q646 632 646 627 A7 7 0 0 1 660 627 Q660 632 656 637 Q665 640 665 650 V666 Z" fill="var(--sil-mid)" opacity={0.9} />
        <P d="M800 836 H880 L940 900 H740 Z" fill={`url(#${id}-ray)`} />
      </Layer>
      <Layer depth="mid-front">
        {/* the veranda: roof, slim columns (in pairs about the door, its bay open: evenly spaced, one stood
            in the doorway), railing, steps to the door. In front of the lit windows (it drifts
            with the house, drawn after its lights) and in shadow, so it reads against the wall: drawn in the
            wall's own layer and tone it vanished, and the windows' light showed through its railing. */}
        <P d="M540 716 L556 700 H1144 L1160 716 Z M546 716 H1154 v8 H546 Z" />
        <P d={`${[556, 614, 672, 730, 788, 884, 942, 1000, 1058, 1116].map((x) => `M${x} 724 h8 v108 h-8 Z`).join(' ')} M546 796 H788 v6 H546 Z M892 796 H1154 v6 H892 Z ${Array.from({ length: 34 }, (_, i) => { const x = 552 + i * 18; return x > 780 && x < 900 ? '' : `M${x} 802 h3 v30 h-3 Z` }).join(' ')}`} />
        <P d="M800 836 V826 H880 V836 Z M808 826 V816 H872 V826 Z" />
        <g className="scr-rim" strokeWidth={2}>
          <path d="M556 700 H1144 L1160 716" />
        </g>
      </Layer>
      <Layer depth="near">
        {/* clipped hedges, the drive and the gate */}
        <P d={`${Array.from({ length: 9 }, (_, i) => `M${-40 + i * 80} 900 a${44 + (i % 3) * 8} ${34 + (i % 2) * 10} 0 0 1 ${96} 0 Z`).join(' ')} ${Array.from({ length: 8 }, (_, i) => `M${980 + i * 80} 900 a${44 + (i % 3) * 8} ${34 + (i % 2) * 10} 0 0 1 ${96} 0 Z`).join(' ')}`} />
        <BareTree x={1420} base={904} h={640} seed={44} lean={-0.12} />
        <Fence y={904} h={84} gateFrom={760} gateTo={920} />
        <P d={grass(904, 47)} data-ground="each" />
      </Layer>
      <Layer depth="pulse-mid">
        {/* the lantern by the door, on the wall: it drifts with the wall (mid), flickering */}
        <g className="scr-glow">
          <Halo id={`${id}-halo`} x={884} y={760} r={90} />
          <P d="M880 756 h8 v12 h-8 Z" />
        </g>
      </Layer>
    </>
  )
}

const library: Draw = (id) => {
  // A private library at night: two walls of books in tall cases, a traceried window with the moon in it
  // and its light falling across the floor, a desk with a shaded lamp and an open book, a wing chair and
  // a globe in the foreground.
  const r = rng(51)
  const tones: string[][] = [[], [], []]
  const gilt: string[] = []
  const shelves: string[] = []
  const fill = (x1: number, x2: number, top: number, bottom: number, step: number) => {
    for (let y = top; y + step <= bottom + 1; y += step) {
      const base = y + step - 10
      shelves.push(`M${x1 - 12} ${base} H${x2 + 12} v12 H${x1 - 12} Z`)
      let x = x1
      while (x < x2 - 10) {
        const w = 9 + r() * 15
        const h = step * (0.55 + r() * 0.33)
        const roll = r()
        if (roll < 0.05) {
          x += w * 2.5
          continue
        }
        if (roll < 0.1 && x + 70 < x2) {
          // a pile lying flat
          for (let k = 0; k < 3 + Math.floor(r() * 3); k++) tones[Math.floor(r() * 3)].push(`M${f(x + r() * 6)} ${f(base - (k + 1) * 9)} h${f(56 + r() * 10)} v8 h${f(-60)} Z`)
          x += 74
          continue
        }
        if (roll < 0.14) {
          // one leaning on its neighbour
          tones[Math.floor(r() * 3)].push(`M${f(x)} ${f(base)} l${f(h * 0.3)} ${f(-h)} l${f(w - 2)} 2 l${f(-h * 0.3)} ${f(h - 2)} Z`)
          x += w + h * 0.3
          continue
        }
        tones[Math.floor(r() * 3)].push(`M${f(x)} ${f(base)} v${f(-h)} h${f(w - 2)} v${f(h)} Z`)
        if (r() < 0.3) gilt.push(`M${f(x + 1)} ${f(base - h + 6)} h${f(w - 4)} v2 h${f(-(w - 4))} Z M${f(x + 1)} ${f(base - 10)} h${f(w - 4)} v2 h${f(-(w - 4))} Z`)
        x += w
      }
    }
  }
  fill(30, 580, 70, 870, 114)
  fill(1020, 1570, 70, 870, 114)
  fill(640, 960, 668, 870, 101)
  const win = `M690 618 V250 A110 110 0 0 1 910 250 V618 Z`
  return (
    <>
      <Layer depth="far">
        {/* the night outside the window, then the wall around it */}
        <Moon x={800} y={196} r={34} id={id} />
        <P d={`M-80 -10 H${W + 80} V${H} H-80 Z ${win}`} fillRule="evenodd" />
        {/* the window's stone mullions, transoms and the tracery in its arch */}
        <g fill="none" stroke="currentColor" strokeWidth={9}>
          <path d="M763 618 V250 M837 618 V250 M690 400 H910 M690 520 H910 M690 250 H910" />
        </g>
        <P d="M676 630 H924 v-14 H676 Z" />
      </Layer>
      <Layer depth="mid">
        {/* the cases: cornice, plinth, uprights between the bays */}
        <P d="M0 0 H600 V900 H0 Z M1000 0 H1600 V900 H1000 Z M620 650 H980 V900 H620 Z" fill="var(--sil-near)" />
        <P d={tones[0].join(' ')} className="scr-books" />
        <P d={tones[1].join(' ')} className="scr-books scr-books-dark" />
        <P d={tones[2].join(' ')} className="scr-books scr-books-pale" />
        <P d={gilt.join(' ')} fill="var(--lit)" opacity={0.35} />
        <P d={shelves.join(' ')} />
        <P d="M-20 0 H620 V46 H-20 Z M-20 46 H624 v10 H-20 Z M980 0 H1620 V46 H980 Z M976 46 H1620 v10 H976 Z M610 640 H990 v14 H610 Z M196 56 v820 h16 v-820 Z M392 56 v820 h16 v-820 Z M1188 56 v820 h16 v-820 Z M1388 56 v820 h16 v-820 Z M576 0 h28 v900 h-28 Z M996 0 h28 v900 h-28 Z" />
        <P d="M-20 870 H1620 V900 H-20 Z" />
      </Layer>
      {/* moonlight (or sunlight): on the window's panes, drifting with the wall (far), then a pool on
          the low case and the floor in front of it, drifting with them (mid), its edges on the case's. One shaft spanning both slid past the
          window's jambs. */}
      <Layer depth="lit-far">
        <g className="scr-moon">
          <P d="M690 618 V250 H910 V618 Z" fill={`url(#${id}-shaft)`} opacity={0.3} />
        </g>
      </Layer>
      <Layer depth="lit">
        <g className="scr-moon">
          <P d="M612 646 H904 L900 900 H612 Z" fill={`url(#${id}-shaft)`} opacity={0.18} />
        </g>
      </Layer>
      <Layer depth="near">
        {/* the rolling ladder on the left case: its top rests on the shelves (they end at x 592), with
            room for the near layer's drift */}
        <P d="M350 900 L440 40 h14 L364 900 Z M432 900 L520 40 h14 L446 900 Z" />
        <P d={Array.from({ length: 13 }, (_, i) => { const y = 860 - i * 64; const k = (900 - y) / 860; return `M${f(357 + 88 * k)} ${y} h${f(82)} v8 h${f(-82)} Z` }).join(' ')} />
        {/* the desk, its drawers, a pile of books, an open book, the shaded lamp */}
        <P d="M560 900 V786 H1090 V900 Z M540 790 H1110 v-18 H540 Z" />
        <P d="M600 840 h120 v6 h-120 Z M930 840 h120 v6 h-120 Z" fill="var(--sil-mid)" />
        <P d="M600 772 h110 v-18 h-110 Z M608 754 h96 v-16 h-96 Z M614 738 h84 v-15 h-84 Z" />
        <P d="M748 772 L752 760 Q790 750 826 762 L830 772 Z M826 772 L830 762 Q866 750 904 760 L908 772 Z" className="scr-books scr-books-pale" />
        <P d="M972 772 h56 v-8 h-22 v-62 h-12 v62 h-22 Z" />
        <P d="M950 704 Q950 676 1000 672 Q1050 676 1050 704 Z" />
        {/* a wing chair, its back to us */}
        <P d="M120 900 V700 Q120 640 170 630 Q230 600 290 630 Q340 640 340 700 V900 Z M96 900 V760 Q96 728 124 726 V900 Z M336 900 V726 Q364 728 364 760 V900 Z" />
        {/* a globe on its stand */}
        <circle cx={1330} cy={700} r={74} />
        <P d="M1320 900 l10 -60 l10 60 Z M1270 900 l56 -116 h8 l-48 116 Z M1390 900 l-56 -116 h-8 l48 116 Z M1324 784 h12 v-10 h-12 Z" />
        {/* its meridian ring, all the way round and held by the stand at the bottom (a half ring's ends hung in the air) */}
        <circle cx={1330} cy={700} r={90} fill="none" stroke="currentColor" strokeWidth={8} />
      </Layer>
      <Layer depth="pulse">
        <Halo id={`${id}-halo`} x={1000} y={720} r={320} />
        <P d="M954 704 h92 v5 h-92 Z" />
        <P d="M748 772 L752 760 Q790 750 826 762 L830 772 Z M826 772 L830 762 Q866 750 904 760 L908 772 Z" opacity={0.35} />
      </Layer>
    </>
  )
}

const police: Draw = (id) => {
  // A 1920s police station on a wet street: rusticated ground floor, a portico on four columns under the
  // lit sign, a clock in the attic, a flag hanging in the rain, the city's stepped towers behind.
  const r = rng(61)
  let sky = ''
  let skyLit = ''
  for (let x = -40; x < W + 40; ) {
    const w = 70 + r() * 110
    const h = 220 + r() * 260
    sky += `M${f(x)} ${H} V${f(H - h)} H${f(x + w)} V${H} Z `
    if (r() < 0.35) {
      // a water tank on legs
      const tx = x + 14 + r() * (w - 50)
      const ty = H - h
      sky += `M${f(tx)} ${f(ty)} v-16 h4 v16 Z M${f(tx + 24)} ${f(ty)} v-16 h4 v16 Z M${f(tx - 2)} ${f(ty - 16)} v-34 h32 v34 Z M${f(tx - 4)} ${f(ty - 50)} L${f(tx + 14)} ${f(ty - 64)} L${f(tx + 32)} ${f(ty - 50)} Z `
    }
    for (let k = 0; k < 5; k++) if (r() < 0.55) skyLit += `M${f(x + 12 + r() * (w - 30))} ${f(H - h + 20 + r() * (h - 120))} h6 v9 h-6 Z `
    x += w + 4
  }
  // Two stepped towers far behind.
  const stepped = (x: number, w: number, top: number) =>
    `M${x} 900 V${top + 120} H${x + w * 0.12} V${top + 60} H${x + w * 0.24} V${top} H${x + w * 0.76} V${top + 60} H${x + w * 0.88} V${top + 120} H${x + w} V900 Z M${x + w * 0.36} ${top} V${top - 50} H${x + w * 0.64} V${top} Z M${x + w * 0.46} ${top - 50} L${x + w * 0.5} ${top - 140} L${x + w * 0.54} ${top - 50} Z`
  const bays = [452, 532, 612, 948, 1028, 1108]
  const up1 = [...bays, 712, 780, 848].map((x) => `M${x} 404 h40 v70 h-40 Z`)
  const up2 = bays.map((x) => `M${x} 512 h40 v72 h-40 Z`)
  const down = bays.map((x) => arched(x, 700, 40, 96))
  const lit = new Set([0, 2, 3, 5, 7, 8, 10, 13, 15, 16, 19])
  // Stone courses on the ground floor, broken at the portico and at each arched window (lines running
  // through the dark panes read as glazing bars).
  const courses = Array.from({ length: 7 }, (_, i) => {
    const y = 672 + i * 30
    const gaps = [[672, 928], ...(y + 3 > 700 && y < 796 ? bays.map((x) => [x - 2, x + 42]) : [])].sort((a, b) => a[0] - b[0])
    let d = ''
    let x0 = 396
    for (const [g1, g2] of gaps) {
      if (g1 > x0) d += `M${x0} ${y} H${g1} v3 H${x0} Z `
      x0 = Math.max(x0, g2)
    }
    return `${d}M${x0} ${y} H1204 v3 H${x0} Z`
  }).join(' ')
  const all = [...up1, ...up2, ...down]
  return (
    <>
      <Layer depth="far">
        <P d={`${stepped(1110, 200, 160)} ${stepped(150, 150, 260)}`} fill="var(--sil-haze)" />
        <P d={sky} />
        <P d={skyLit} fill="var(--lit)" className="scr-glow" opacity={0.35} />
      </Layer>
      <Layer depth="mid">
        {/* the station, down behind the curb (it stopped 10 units above it, the city showing through the gap):
            rusticated ground floor (its stone courses stop at the portico: they showed through
            its dark recess, behind the columns), upper floors, cornice with dentils, attic and clock */}
        <P data-ground d="M396 876 V640 H1204 V876 Z M416 640 V360 H1184 V640 Z M386 364 H1214 V334 H386 Z M408 334 V304 H1192 V334 Z M690 304 V236 H910 V304 Z M680 240 H920 v-14 H680 Z" />
        <P d={Array.from({ length: 58 }, (_, i) => `M${394 + i * 14.3} 364 h7 v9 h-7 Z`).join(' ')} />
        <P d={`${courses} M436 360 h12 v280 h-12 Z M672 360 h12 v280 h-12 Z M916 360 h12 v280 h-12 Z M1152 360 h12 v280 h-12 Z`} fill="var(--sil-back)" opacity={0.6} />
        {/* the flag on its pole, hanging limp */}
        <P d="M600 304 V170 h5 V304 Z M605 176 h50 q-6 30 4 62 h-54 Z" />
        {/* the portico: steps, four columns, entablature carrying the sign */}
        <P d="M640 872 V862 H960 V872 Z M656 862 V852 H944 V862 Z M672 852 V842 H928 V852 Z" />
        <P d="M672 842 V660 H928 V842 Z" fill="var(--sil-near)" opacity={0.75} />
        <P d="M684 842 V660 h22 V842 Z M744 842 V660 h22 V842 Z M834 842 V660 h22 V842 Z M894 842 V660 h22 V842 Z M672 660 H928 V600 H672 Z M662 604 H938 v-12 H662 Z" />
        <P d="M680 842 h30 v-8 h-30 Z M740 842 h30 v-8 h-30 Z M830 842 h30 v-8 h-30 Z M890 842 h30 v-8 h-30 Z M680 666 h30 v-8 h-30 Z M740 666 h30 v-8 h-30 Z M830 666 h30 v-8 h-30 Z M890 666 h30 v-8 h-30 Z" />
        {/* the lamp posts at the foot of the steps */}
        <P d="M620 872 V760 h8 V872 Z M972 872 V760 h8 V872 Z M612 872 h24 v-10 h-24 Z M964 872 h24 v-10 h-24 Z" />
        <P d={all.filter((_, i) => !lit.has(i)).join(' ')} fill="var(--sil-near)" opacity={0.6} />
        <g className="scr-rim" strokeWidth={2}>
          <path d="M386 334 H1214 M680 226 H920 M662 592 H938" />
        </g>
      </Layer>
      <Layer depth="lit">
        <P d={all.filter((_, i) => lit.has(i)).join(' ')} fill={`url(#${id}-glass)`} />
        {/* the doors and their transom, the clock face */}
        <P d="M770 842 V720 H830 V842 Z M770 712 H830 V688 H770 Z" fill={`url(#${id}-glass)`} />
        <P d="M799 720 v122 h2 V720 Z" fill="var(--sil-mid)" />
        <circle cx={800} cy={270} r={22} opacity={0.7} />
        <P d="M799 270 V254 h2 V270 Z M800 269 h12 v2 h-12 Z" fill="var(--sil-mid)" />
        <text x="800" y="640" textAnchor="middle" fontSize="34" letterSpacing="12" fontFamily="'Josefin Sans', 'IBM Plex Sans Condensed', sans-serif" fontWeight="700">POLICE</text>
        {/* the lamps and their light on the wet street */}
        {[624, 976].map((x) => (
          <g key={x}>
            <Halo id={`${id}-halo`} x={x} y={748} r={100} />
            <circle cx={x} cy={748} r={14} />
            <ellipse cx={x} cy={888} rx={14} ry={22} fill={`url(#${id}-halo)`} />
          </g>
        ))}
        <P d="M770 872 h60 l20 28 h-100 Z" fill={`url(#${id}-ray)`} />
      </Layer>
      <Layer depth="near">
        {/* the curb and the street, a street lamp, a motor car at the curb */}
        <P d="M-40 900 V872 H1640 V900 Z" />
        <P d="M1344 900 V560 h16 V900 Z M1330 900 l14 -30 h16 l14 30 Z M1330 540 h44 l-8 -14 h-28 Z M1350 526 v-12 h4 v12 Z" />
        <P d={motorCar(60, 896)} />
        {/* its windows catch the street light; chrome on the roof, the bonnet and the lamp */}
        <P d="M162 728 h70 v48 h-70 Z M244 728 h70 v48 h-70 Z" fill="var(--sil-back)" opacity={0.7} />
        <circle cx={150} cy={870} r={32} />
        <circle cx={422} cy={870} r={32} />
        <P d="M150 870 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 M422 870 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0" fill="var(--sil-back)" />
        <circle cx={480} cy={800} r={11} fill="var(--sil-back)" />
        <g className="scr-rim scr-rim-lamp" strokeWidth={2.5}>
          <path d="M166 716 H312 Q326 716 326 728 M326 792 L460 798 Q474 800 474 812 M360 810 Q418 812 440 854 M90 812 Q142 814 152 850" />
        </g>
      </Layer>
      <Layer depth="lit-near">
        {/* the street lamp's glass on its post, and its light on the wet street */}
        <Halo id={`${id}-halo`} x={1352} y={548} r={220} />
        <P d="M1336 540 h32 l-6 22 h-20 Z" />
        <ellipse cx={1352} cy={892} rx={26} ry={60} fill={`url(#${id}-halo)`} />
      </Layer>
    </>
  )
}

const forest: Draw = (id) => {
  // Deep woods at night: rows of ragged firs fading into the mist, a path running into a
  // clearing where the moonlight falls and something small glows; great trunks with roots in front.
  const r = rng(71)
  const haze: string[] = []
  for (let x = -30; x < W + 30; x += 14 + r() * 22) haze.push(ragPine(x, 690 + r() * 20, 90 + r() * 80, 40 + r() * 20, r))
  // The far row: ragged firs only. (Bare straight trunks running off the top of the frame into the
  // sky read as stray lines, not trees.) The second generator keeps the rest of the wood as it was.
  const tall = rng(172)
  const far: string[] = []
  for (let x = -20; x < W + 20; x += 34 + r() * 50) {
    if (x > 860 && x < 1000) continue
    if (r() < 0.45) far.push(ragPine(x, 760 + r() * 20, 220 + r() * 130, 80 + r() * 40, r))
    else {
      r() // the trunk's width, kept so the trees after it stay put
      far.push(ragPine(x, 770 + tall() * 20, 300 + tall() * 160, 90 + tall() * 40, tall))
    }
  }
  const mid: string[] = []
  for (let x = -40; x < W + 40; x += 90 + r() * 90) {
    if (x > 760 && x < 1080) continue
    mid.push(ragPine(x, 850 + r() * 20, 380 + r() * 220, 150 + r() * 70, r))
  }
  // Ferns: arching fronds along the ground in front.
  const fern = (x: number, y: number, s: number, dir: number) => {
    let d = ''
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + dir * (0.25 + k * 0.28)
      const len = s * (1 - k * 0.12)
      const ex = x + Math.cos(a) * len
      const ey = y + Math.sin(a) * len * 0.8
      d += `M${f(x)} ${y} Q${f(x + Math.cos(a) * len * 0.5 - dir * 6)} ${f(y + Math.sin(a) * len * 0.9)} ${f(ex)} ${f(ey)} Q${f(x + Math.cos(a) * len * 0.5 + dir * 4)} ${f(y + Math.sin(a) * len * 0.6)} ${f(x + 3)} ${y} Z `
    }
    return d
  }
  return (
    <>
      <Layer depth="far">
        <Moon x={930} y={150} r={36} id={id} />
        <P d={haze.join(' ')} fill="var(--sil-haze)" />
        <P d={ridge(760, 14, 72)} />
        <P d={far.join(' ')} />
      </Layer>
      <Layer depth="lit">
        {/* the moonlight (or the sun) falling into the clearing */}
        <g className="scr-moon">
          <P d="M830 -10 H1020 L1110 860 H800 Z" fill={`url(#${id}-shaft)`} opacity={0.26} filter={`url(#${id}-soft)`} />
          <P d="M870 -10 H985 L1050 860 H860 Z" fill={`url(#${id}-shaft)`} opacity={0.34} filter={`url(#${id}-soft)`} />
          <ellipse cx={950} cy={850} rx={170} ry={26} fill="var(--moon)" opacity={0.08} />
        </g>
        <g className="scr-sun">
          <P d="M840 -10 H1010 L1090 860 H820 Z" fill="var(--sun)" opacity={0.08} />
        </g>
      </Layer>
      <Layer depth="mid">
        <P d={ridge(846, 14, 73)} />
        {/* the path, paler, winding into the clearing */}
        <P d="M640 904 Q700 870 800 862 Q900 856 930 846 Q960 840 990 846 Q940 860 880 876 Q800 896 820 904 Z" fill="var(--sil-back)" opacity={0.8} />
        <P d={mid.join(' ')} />
      </Layer>
      <Layer depth="pulse">
        {/* something small glowing deep in the clearing: it floats, on purpose */}
        <g className="scr-glow" data-free>
          <Halo id={`${id}-halo`} x={968} y={800} r={60} o={0.8} />
          <circle cx={968} cy={800} r={3.5} />
        </g>
      </Layer>
      <Layer depth="near">
        <P d={ridge(884, 18, 74)} />
        {/* two great trunks framing the view, their roots, a low branch */}
        <P d="M30 904 Q60 880 70 840 C88 560 70 300 96 -10 H216 C200 300 210 600 226 840 Q238 884 290 904 Z" />
        <P d="M1394 904 Q1430 880 1440 836 C1462 600 1450 300 1474 -10 H1584 C1574 300 1590 620 1606 840 Q1620 884 1650 904 Z" />
        <BareTree x={1462} base={330} h={330} seed={75} lean={-1.2} />
        <P d="M110 -10 v900 M150 -10 v900 M190 -10 v900 M1500 -10 v900 M1540 -10 v900" stroke="#000" strokeOpacity={0.18} strokeWidth={3} fill="none" />
        {/* a fallen log, ferns */}
        <P d="M300 904 L330 858 Q340 846 360 848 L620 872 Q640 876 638 892 L636 904 Z M354 850 a14 22 0 1 0 1 0 Z" />
        <P d={`${fern(280, 900, 120, -1)} ${fern(280, 900, 110, 1)} ${fern(1350, 902, 130, -1)} ${fern(1350, 902, 110, 1)} ${fern(700, 904, 70, 1)}`} />
        <P d={grass(ridgeAt(884, 18, 74), 75)} data-ground="each" />
      </Layer>
    </>
  )
}

const harbour: Draw = (id) => {
  // A fishing port at night: warehouses with loading doors and a roof vent, a long pier with a derrick,
  // a schooner and a steam tug moored at it, the lighthouse on the headland sweeping its beam,
  // the moon's path on the water.
  const r = rng(81)
  let ripples = ''
  for (let i = 0; i < 90; i++) {
    const y = 694 + r() ** 1.5 * 200
    const len = 10 + r() * 60 * ((y - 640) / 260)
    ripples += `M${f(r() * W)} ${f(y)} h${f(len)} v1.4 h${f(-len)} Z `
  }
  // Broken streaks under a light: a reflection on moving water.
  const streak = (x: number, y0: number, y1: number, w: number, seed: number) => {
    const q = rng(seed)
    let d = ''
    for (let y = y0; y < y1; y += 7 + q() * 6) {
      const k = w * (0.4 + q() * 0.8) * (0.6 + ((y - y0) / (y1 - y0)) * 0.8)
      d += `M${f(x - k / 2 + (q() - 0.5) * w * 0.6)} ${f(y)} h${f(k)} v2.2 h${f(-k)} Z `
    }
    return d
  }
  const rig = 'M680 760 V420 M800 760 V456 M680 424 L560 760 M680 424 L800 460 M800 460 L930 744 M680 430 L640 760 M800 466 L830 760 M560 740 L910 742'
  return (
    <>
      <Layer depth="far">
        <Moon x={720} y={170} r={40} id={id} />
        <P d={ridge(676, 12, 82)} fill="var(--sil-haze)" />
        {/* the headland, the lighthouse and its keeper's cottage */}
        <P d={jagged([[1100, 710], [1170, 660], [1260, 622], [1380, 606], [1500, 612], [1640, 626], [1640, 710]], 83, 8)} />
        <g transform="translate(-70 0)">
          <P d="M1357 640 L1366 436 H1398 L1407 640 Z M1348 438 h68 v-10 h-68 Z M1366 428 v-34 h32 v34 Z M1360 396 Q1382 362 1404 396 Z M1380 384 v-30 h4 v30 Z" />
          <P d="M1352 428 v-12 M1362 428 v-12 M1402 428 v-12 M1412 428 v-12 M1350 418 H1414" stroke="currentColor" strokeWidth={2} fill="none" />
          {/* the dome's moonlit edge follows the dome (it started 15 units above its top) */}
          <path d="M1398 436 L1406 618 M1382 379 Q1393 379 1404 396" className="scr-rim" strokeWidth={2} />
          <P d="M1430 636 V578 H1500 V636 Z M1424 580 L1465 552 L1506 580 Z M1484 566 v-18 h8 v18 Z" />
          <P d="M1446 588 h10 v12 h-10 Z" fill="var(--lit)" className="scr-glow" opacity={0.75} />
        </g>
        {/* the water */}
        <rect x="-40" y="690" width={W + 80} height="260" fill="var(--sil-water)" />
      </Layer>
      <Layer depth="water">
        <P d={ripples} opacity={0.2} />
        {/* the moon's path, the lighthouse and the windows on the water */}
        <g className="scr-moon">
          <P d={streak(720, 700, 900, 60, 84)} opacity={0.32} />
        </g>
        <g className="scr-sun">
          <P d={streak(720, 700, 900, 90, 84)} opacity={0.35} />
        </g>
        <g className="scr-glow">
          {/* the lighthouse's light on the water (the sheds and the lamp stand on the quay: no reflection under them) */}
          <P d={streak(1312, 700, 800, 18, 85)} opacity={0.45} />
        </g>
      </Layer>
      <Layer depth="pulse">
        <P d="M1312 410 L670 335 L670 475 Z" fill={`url(#${id}-beam)`} transform="scale(-1 1) translate(-2624 0)" />
        <P d="M1312 410 L670 335 L670 475 Z" fill={`url(#${id}-beam)`} />
        <Halo id={`${id}-halo`} x={1312} y={410} r={120} />
        <circle cx={1312} cy={410} r={9} />
      </Layer>
      <Layer depth="mid">
        {/* the stone quay the warehouses stand on, down into the water (they stood on the sea) */}
        <P d="M-40 900 V786 H534 V900 Z" />
        {/* warehouses: a tall one with loading doors, a broad one, a low shed */}
        <P data-ground d="M-40 790 V420 L50 360 L140 420 V790 Z M150 790 V430 L280 350 L410 430 V790 Z M340 400 V350 h20 v50 Z M400 790 V560 L470 520 L540 560 V790 Z" />
        {/* a vent housing on the ridge, its foot inside the roof */}
        <P d="M38 378 V350 L50 341 L62 350 V378 Z" />
        <P d="M22 460 h56 v70 h-56 Z M22 570 h56 v70 h-56 Z M22 680 h56 v90 h-56 Z M430 680 h80 v110 h-80 Z" fill="var(--sil-near)" opacity={0.6} />
        {/* the pier, its piles and bollards, the derrick at its end */}
        <P d="M520 772 H1150 v14 H520 Z" />
        <P d={Array.from({ length: 12 }, (_, i) => `M${532 + i * 52} 800 V786 h10 V800 Z`).join(' ')} />
        <P d={Array.from({ length: 12 }, (_, i) => `M${532 + i * 52} 860 V804 h10 V860 Z`).join(' ')} fill="var(--sil-near)" opacity={0.3} />
        <P d="M600 772 v-10 h12 v10 Z M760 772 v-10 h12 v10 Z M940 772 v-10 h12 v10 Z M1090 772 v-10 h12 v10 Z" />
        <P d="M1110 772 V560 h8 V772 Z M1114 566 L1010 640 l-4 -6 L1110 558 Z M1010 640 v40" />
        <P d="M1008 640 v44 h2 v-44 Z M1002 684 h14 v8 h-14 Z" />
        {/* the schooner: hull, masts, rigging, furled sails on their booms */}
        <P d="M560 744 Q572 776 600 782 H896 Q920 770 930 742 Z M680 760 V420 h5 V760 Z M800 760 V456 h5 V760 Z M600 742 L556 728 l2 -4 L604 738 Z" />
        <P d="M684 690 L770 700 v8 L684 702 Z M804 700 L900 708 v8 L804 712 Z M682 520 l78 6 v6 l-78 -6 Z" />
        <P d={rig} stroke="currentColor" strokeWidth={1.6} fill="none" />
        {/* the steam tug: hull, wheelhouse, funnel, a mast */}
        <P d="M950 770 Q960 790 990 792 H1140 Q1158 784 1166 760 H950 Z M1000 760 V722 H1070 V760 Z M1084 760 V700 h22 V760 Z M1040 722 V650 h4 V722 Z" />
        <P d="M1084 712 h22 v6 h-22 Z" fill="var(--sil-back)" />
        {/* boats mirrored in the water, broken by the ripples */}
        <P d="M560 792 Q572 810 600 812 H896 Q920 806 930 792 Z M950 796 Q960 806 990 808 H1140 Q1158 804 1166 796 Z M680 812 V880 h4 V812 Z M800 812 V860 h4 V812 Z" fill="var(--sil-near)" opacity={0.35} />
        <g className="scr-rim" strokeWidth={2}>
          <path d="M50 360 L140 420 M280 350 L410 430 M470 520 L540 560" />
        </g>
      </Layer>
      <Layer depth="lit">
        <P d="M200 600 h26 v40 h-26 Z M300 520 h30 v44 h-30 Z M240 680 h30 v44 h-30 Z M30 470 h20 v30 h-20 Z M1012 730 h14 v14 h-14 Z M1036 730 h14 v14 h-14 Z" fill={`url(#${id}-glass)`} />
      </Layer>
      <Layer depth="near">
        {/* the stone quay in front, a bollard with its rope, the lamp post, crates and barrels */}
        <P d="M-40 900 V846 H560 L600 900 Z" />
        <P d="M-40 846 H560 v4 H-40 Z" fill="var(--sil-back)" opacity={0.5} />
        <P d="M80 846 v-30 q20 -12 40 0 v30 Z M74 818 h52 v-8 h-52 Z" />
        <P d="M120 836 q40 10 60 -2 q20 -10 40 4" stroke="currentColor" strokeWidth={5} fill="none" />
        <P d="M300 846 V776 H380 V846 Z M318 776 V722 H380 V776 Z M300 846 h80 M440 846 v-50 q20 -8 40 0 v50 Z M488 846 v-40 q16 -6 32 0 v40 Z" />
        <P d="M300 800 h80 v3 h-80 Z M318 748 h62 v3 h-62 Z" fill="var(--sil-back)" opacity={0.5} />
        <P d="M256 846 V566 h12 V846 Z M248 548 h28 l-6 -12 h-16 Z M242 846 l14 -24 h12 l14 24 Z" />
      </Layer>
      <Layer depth="lit-near">
        {/* the lamp's glass, on its post (on the quay, between the bollard's rope and the crates; it stood in the sea) */}
        <Halo id={`${id}-halo`} x={262} y={556} r={200} />
        <P d="M248 548 h28 l-6 20 h-16 Z" />
      </Layer>
    </>
  )
}

const street: Draw = (id) => {
  // An old-town street in one-point perspective at night: facades on both sides running to the end of
  // the street, shop windows, hanging signs, gas lamps along the wet cobbles, a man in a hat waiting
  // under a lamp, the moon and a far spire in the strip of sky between the roofs.
  // World units: the eye is 380 above the ground; s is the scale at a depth (1 = the nearest).
  const VX = 820
  const VY = 520
  const X = (side: number, s: number, off = 860) => VX + side * off * s
  const Y = (s: number, z: number) => VY + (380 - z) * s
  const quad = (side: number, s1: number, s2: number, z1: number, z2: number, off = 860) =>
    `M${f(X(side, s1, off))} ${f(Y(s1, z1))} L${f(X(side, s2, off))} ${f(Y(s2, z1))} L${f(X(side, s2, off))} ${f(Y(s2, z2))} L${f(X(side, s1, off))} ${f(Y(s1, z2))} Z`
  const r = rng(91)
  const left: Array<[number, number, number]> = [[1.1, 0.62, 2300], [0.62, 0.44, 1900], [0.44, 0.33, 2500], [0.33, 0.25, 1700], [0.25, 0.19, 2200], [0.19, 0.14, 1600]]
  const right: Array<[number, number, number]> = [[1.1, 0.7, 2000], [0.7, 0.5, 2600], [0.5, 0.36, 1800], [0.36, 0.27, 2300], [0.27, 0.2, 1700], [0.2, 0.14, 2100]]
  const sides: ReactNode[] = []
  const litWin: string[] = []
  const darkWin: string[] = []
  const shops: string[] = []
  const eaves: string[] = []
  const glints: string[] = []
  for (const [side, list] of [[-1, left], [1, right]] as const) {
    // Farthest first: a nearer building covers the one behind it.
    for (const [sa, sb, h] of [...list].reverse()) {
      // the end wall facing us, seen above a lower neighbour; a chimney stack on it
      const x0 = X(side, sa)
      const depth = 1300 * sa
      sides.push(<P key={`${side}${sa}`} d={`M${f(x0)} ${f(Y(sa, 0))} V${f(Y(sa, h))} H${f(x0 + side * depth)} V${f(Y(sa, 0))} Z M${f(x0 + side * depth * 0.3)} ${f(Y(sa, h))} v${f(-160 * sa)} h${f(side * 90 * sa)} v${f(160 * sa)} Z`} fill="var(--sil-back)" />)
      sides.push(<P key={`f${side}${sa}`} d={quad(side, sa, sb, 0, h)} />)
      eaves.push(`M${f(X(side, sa))} ${f(Y(sa, h))} L${f(X(side, sb))} ${f(Y(sb, h))}`)
      // windows: a shop front below, rows of sash windows above
      const cols = Math.max(2, Math.round((sa - sb) * 16))
      for (let c = 0; c < cols; c++) {
        const s1 = sa - ((sa - sb) * (c + 0.27)) / cols
        const s2 = sa - ((sa - sb) * (c + 0.73)) / cols
        for (const [z1, z2] of [[980, 1300], [1620, 1940], [2240, 2460]]) {
          if (z2 > h - 140) continue
          ;(r() < 0.3 ? litWin : darkWin).push(quad(side, s1, s2, z1, z2))
        }
      }
      // the shop front: always lit behind the man waiting on the right
      const s1 = sa - (sa - sb) * 0.12
      const s2 = sb + (sa - sb) * 0.12
      if (r() < 0.5 || (side === 1 && sa === 0.5)) {
        shops.push(quad(side, s1, s2, 140, 500))
        // mirrored on the wet pavement
        glints.push(quad(side, s1, s2, -60, -340))
      } else darkWin.push(quad(side, s1, s2, 140, 500))
    }
  }
  // Gas lamps on both curbs.
  const lamps: Array<[number, number]> = [[-1, 0.55], [-1, 0.32], [-1, 0.21], [1, 0.52], [1, 0.26], [1, 0.17]]
  const lampPost = (side: number, s: number) => {
    const x = X(side, s, 700)
    const k = s
    return `M${f(x - 5 * k)} ${f(Y(s, 0))} V${f(Y(s, 760))} h${f(10 * k)} V${f(Y(s, 0))} Z M${f(x - 22 * k)} ${f(Y(s, 760))} h${f(44 * k)} l${f(-8 * k)} ${f(-26 * k)} h${f(-28 * k)} Z M${f(x - 14 * k)} ${f(Y(s, 0))} l${f(6 * k)} ${f(-40 * k)} h${f(16 * k)} l${f(6 * k)} ${f(40 * k)} Z`
  }
  // Cobbles: lines across the street, closer together towards the end.
  let cobbles = ''
  for (let s = 1.2; s > 0.15; s *= 0.93) cobbles += `M${f(X(-1, s, 690))} ${f(Y(s, 0))} H${f(X(1, s, 690))} v${f(Math.max(0.8, 3 * s))} H${f(X(-1, s, 690))} Z `
  // A man in a hat and a long coat, waiting under the lamp on the right.
  const man = (x: number, y: number, k: number) =>
    `M${f(x - 30 * k)} ${y} L${f(x - 26 * k)} ${f(y - 230 * k)} Q${f(x - 30 * k)} ${f(y - 300 * k)} ${f(x - 12 * k)} ${f(y - 310 * k)} Q${f(x - 20 * k)} ${f(y - 330 * k)} ${f(x - 16 * k)} ${f(y - 350 * k)} L${f(x - 36 * k)} ${f(y - 352 * k)} L${f(x - 34 * k)} ${f(y - 362 * k)} L${f(x - 16 * k)} ${f(y - 364 * k)} Q${f(x)} ${f(y - 400 * k)} ${f(x + 16 * k)} ${f(y - 364 * k)} L${f(x + 34 * k)} ${f(y - 362 * k)} L${f(x + 36 * k)} ${f(y - 352 * k)} L${f(x + 16 * k)} ${f(y - 350 * k)} Q${f(x + 20 * k)} ${f(y - 330 * k)} ${f(x + 12 * k)} ${f(y - 310 * k)} Q${f(x + 32 * k)} ${f(y - 300 * k)} ${f(x + 28 * k)} ${f(y - 230 * k)} L${f(x + 30 * k)} ${y} Z`
  return (
    <>
      <Layer depth="far">
        <Moon x={830} y={190} r={30} id={id} />
        {/* the end of the street: far roofs and a spire */}
        <P d={`M560 900 V470 L600 450 L640 470 V430 H720 V456 L770 420 L800 440 V400 H840 V340 L852 300 L864 340 V400 H880 V450 L940 420 L980 450 V410 H1060 V900 Z ${cross(852, 304, 30)}`} />
      </Layer>
      <Layer depth="mid">
        {/* the street: cobbles, pavements, then the buildings */}
        <P d={`M${f(X(-1, 1.3))} ${f(Y(1.3, 0))} H${f(X(1, 1.3))} L${f(X(1, 0.13))} ${f(Y(0.13, 0))} H${f(X(-1, 0.13))} Z`} />
        <P d={`${quad(-1, 1.3, 0.13, 0, 0)} M${f(X(-1, 1.3))} ${f(Y(1.3, 0))} L${f(X(-1, 0.13))} ${f(Y(0.13, 0))} L${f(X(-1, 0.13, 690))} ${f(Y(0.13, 0))} L${f(X(-1, 1.3, 690))} ${f(Y(1.3, 0))} Z M${f(X(1, 1.3))} ${f(Y(1.3, 0))} L${f(X(1, 0.13))} ${f(Y(0.13, 0))} L${f(X(1, 0.13, 690))} ${f(Y(0.13, 0))} L${f(X(1, 1.3, 690))} ${f(Y(1.3, 0))} Z`} fill="var(--sil-back)" opacity={0.6} />
        <P d={`M${f(X(-1, 0.13, 690))} ${f(Y(0.13, 0))} H${f(X(1, 0.13, 690))} L${f(X(1, 1, 500))} ${f(Y(1, 0))} H${f(X(-1, 1, 500))} Z`} fill={`url(#${id}-sheen)`} />
        <P d={cobbles} fill="var(--sil-near)" opacity={0.5} />
        {/* tram rails running down the middle of the street */}
        <P d={[-118, -96, 96, 118].map((g) => `M${f(VX + g * 1.3)} ${f(Y(1.3, 0))} L${f(VX + g * 0.13)} ${f(Y(0.13, 0))}`).join(' ')} stroke="var(--sil-back)" strokeWidth={3} fill="none" opacity={0.8} />
        {sides}
        <P d={darkWin.join(' ')} fill="var(--sil-near)" opacity={0.55} />
        {/* hanging signs on brackets */}
        <P d={`M${f(X(-1, 0.52))} ${f(Y(0.52, 820))} h${f(170 * 0.52)} v${f(8 * 0.52)} h${f(-170 * 0.52)} Z M${f(X(-1, 0.52) + 60 * 0.52)} ${f(Y(0.52, 800))} h${f(100 * 0.52)} v${f(150 * 0.52)} h${f(-100 * 0.52)} Z M${f(X(1, 0.6))} ${f(Y(0.6, 860))} h${f(-150 * 0.6)} v${f(8 * 0.6)} h${f(150 * 0.6)} Z M${f(X(1, 0.6) - 130 * 0.6)} ${f(Y(0.6, 840))} h${f(90 * 0.6)} v${f(120 * 0.6)} h${f(-90 * 0.6)} Z`} />
        <P d={lamps.map(([side, s]) => lampPost(side, s)).join(' ')} />
        <P d={man(X(1, 0.42, 780), Y(0.42, 0), 0.42)} fill="var(--sil-near)" />
        <g className="scr-rim" strokeWidth={2}>
          <path d={eaves.join(' ')} />
        </g>
      </Layer>
      <Layer depth="lit">
        <P d={litWin.join(' ')} fill={`url(#${id}-glass)`} />
        <P d={shops.join(' ')} fill={`url(#${id}-glass)`} opacity={0.6} />
        {glints.map((d) => <P key={d} d={d} fill={`url(#${id}-ray)`} opacity={0.55} />)}
        {lamps.map(([side, s]) => {
          const x = X(side, s, 700)
          return (
            <g key={`${side}${s}`}>
              <Halo id={`${id}-halo`} x={x} y={Y(s, 750)} r={300 * s} />
              <P d={`M${f(x - 18 * s)} ${f(Y(s, 758))} h${f(36 * s)} l${f(-6 * s)} ${f(-22 * s)} h${f(-24 * s)} Z`} />
              {/* its broken reflection running towards us on the wet cobbles */}
              <ellipse cx={x + side * -40 * s} cy={Y(s, 0) + 50 * s} rx={22 * s} ry={70 * s} fill={`url(#${id}-halo)`} />
            </g>
          )
        })}
      </Layer>
      <Layer depth="near">
        {/* the nearest lamp post, on the left kerb */}
        <P d={`M112 910 V150 h16 V910 Z M96 150 h48 l-10 -34 h-28 Z M116 116 v-14 h8 v14 Z M100 910 l12 -60 h16 l12 60 Z`} />
      </Layer>
      <Layer depth="pulse">
        <g className="scr-glow">
          <Halo id={`${id}-halo`} x={120} y={160} r={300} />
          <P d="M98 150 h44 l-8 -30 h-28 Z" />
          <ellipse cx={180} cy={880} rx={40} ry={90} fill={`url(#${id}-halo)`} />
        </g>
      </Layer>
    </>
  )
}

const DRAW: Record<PlaceId, Draw> = {
  church, graveyard, crypt, castle, manor, library, police, forest, harbour, street,
  asylum, station, swamp, dig, mountain, museum, cavern, farm, ship, fair, mine, moor,
}

/** A place, drawn over the generated sky. */
export function Place({ place }: { place: PlaceId }) {
  const id = `pl${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <div className="scr-fill scr-place" data-place={place}>
      <Defs id={id} />
      {DRAW[place](id)}
    </div>
  )
}
