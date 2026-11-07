// Drawn décor: station. A 1920s platform at night, seen along its length: the canopy on iron columns
// overhead with its fretted valance, gas lamps and a hanging clock, the station wall with its doors
// and the lit waiting room, a train standing at the far track with its engine steaming at the head,
// the empty near track running away under a signal gantry. One-point perspective, like the street.
// See the decor-artist skill.
import type { ReactNode } from 'react'
import { type Draw, Halo, Layer, Moon, P, f, rng } from '../placeKit'

// World units (about a centimetre): x across (the platform edge at 150, the train's side at 610), z up
// from the platform (the rails at -100, the canopy at 420), d the depth (the scale at a depth is 1/d).
// The eye is 160 above the platform: the platform's edge face and its far end face look away from it
// (they are not drawn; the near track's first rail is set back enough to show past the edge).
const VX = 760
const VY = 500
const E = 160
const pt = (x: number, d: number, z: number) => `${f(VX + x / d)} ${f(VY + (E - z) / d)}`
const sx = (x: number, d: number) => VX + x / d
const sy = (z: number, d: number) => VY + (E - z) / d
/** A quad on a plane along the track (x fixed): a wall, the train's side. */
const side = (x: number, d1: number, d2: number, z1: number, z2: number) => `M${pt(x, d1, z1)} L${pt(x, d2, z1)} L${pt(x, d2, z2)} L${pt(x, d1, z2)} Z`
/** A quad on a level plane (z fixed): the platform, the canopy's underside, a rail. */
const flat = (z: number, d1: number, d2: number, x1: number, x2: number) => `M${pt(x1, d1, z)} L${pt(x2, d1, z)} L${pt(x2, d2, z)} L${pt(x1, d2, z)} Z`
/** A quad facing us (d fixed): a column, a beam. */
const front = (d: number, x1: number, x2: number, z1: number, z2: number) => `M${pt(x1, d, z1)} L${pt(x2, d, z1)} L${pt(x2, d, z2)} L${pt(x1, d, z2)} Z`
/** An arched opening in a plane along the track. */
const archSide = (x: number, d1: number, d2: number, z1: number, z2: number, rise: number) =>
  `M${pt(x, d1, z1)} L${pt(x, d1, z2 - rise)} C${pt(x, d1, z2 + rise * 0.3)} ${pt(x, d2, z2 + rise * 0.3)} ${pt(x, d2, z2 - rise)} L${pt(x, d2, z1)} Z`

const NEAR = 0.36
const CANOPY_END = 2
const PLATFORM_END = 3

export const station: Draw = (id) => {
  const r = rng(121)
  // The train: two carriages, the tender, the engine (cab, boiler, dome, chimney), its head at d 2.64.
  const cars: Array<[number, number]> = [[NEAR, 1.3], [1.33, 1.85]]
  const body: string[] = []
  const dark: string[] = []
  const litWin: string[] = []
  const trim: string[] = []
  // underframes and gangways: farther in than the bodies, drawn before them (drawn after, they covered the
  // nearer carriage's end and the cab)
  const under: string[] = []
  for (const [d1, d2] of cars) {
    body.push(side(610, d1, d2, -50, 270))
    // the eave of the roof, the underframe, the bogies
    dark.push(side(604, d1, d2, 266, 290))
    under.push(side(640, d1, d2, -96, -40))
    trim.push(side(608, d1, d2, 96, 104))
    // compartments: a door with its droplight, then a window
    for (let c = d1 + 0.03; c + 0.08 < d2; c += 0.09) {
      dark.push(side(608, c, c + 0.024, -40, 236))
      ;(r() < 0.72 ? litWin : dark).push(side(607, c + 0.004, c + 0.02, 124, 214))
      ;(r() < 0.72 ? litWin : dark).push(side(607, c + 0.036, c + 0.078, 112, 214))
    }
  }
  // the gangway between the carriages
  under.push(side(630, 1.3, 1.33, -40, 262))
  // tender: the body, the coal heaped on it
  body.push(side(615, 1.88, 2.1, -50, 190))
  body.push(`M${pt(615, 1.88, 188)} L${pt(615, 1.91, 214)} L${pt(615, 1.97, 224)} L${pt(615, 2.05, 212)} L${pt(615, 2.1, 188)} Z`)
  under.push(side(640, 1.88, 2.1, -96, -40))
  // engine: cab, its roof, the boiler, the running board, the dome and the chimney
  body.push(side(615, 2.1, 2.24, -40, 262), side(608, 2.09, 2.25, 260, 280))
  body.push(side(650, 2.22, 2.62, 40, 236), side(625, 2.22, 2.64, 26, 46))
  body.push(`M${pt(650, 2.36, 230)} C${pt(650, 2.37, 292)} ${pt(650, 2.43, 292)} ${pt(650, 2.44, 230)} Z`)
  body.push(`M${pt(650, 2.53, 230)} L${pt(650, 2.54, 322)} L${pt(650, 2.59, 322)} L${pt(650, 2.6, 230)} Z M${pt(650, 2.532, 318)} L${pt(650, 2.598, 318)} L${pt(650, 2.598, 336)} L${pt(650, 2.532, 336)} Z`)
  under.push(side(660, 2.08, 2.64, -96, 28))
  dark.push(side(616, 2.12, 2.21, 150, 232))
  const cabGlow = side(614, 2.125, 2.205, 154, 228)
  // Sleepers, evenly spaced along each track (the far track's only beyond the engine).
  let sleepers = ''
  for (let d = 0.4; d < 4.2; d += 0.03) sleepers += flat(-100, d, d + 0.011, 236, 432) + ' '
  for (let d = 2.66; d < 4.2; d += 0.03) sleepers += flat(-100, d, d + 0.011, 652, 848) + ' '
  const rails = [262, 406, 678, 822].map((x) => flat(-100, NEAR, 40, x - 4, x + 4)).join(' ')
  // The canopy: columns down the middle of the platform, the girders they carry, its fretted valance.
  const cols = [0.6, 0.85, 1.1, 1.35, 1.6, 1.85]
  const lamps = [0.72, 0.97, 1.22, 1.47, 1.72]
  const column = (d: number) =>
    `${front(d, -261, -239, 0, 400)} ${front(d, -274, -226, 0, 44)} ${front(d, -272, -228, 376, 392)} M${pt(-261, d, 318)} Q${pt(-261, d, 402)} ${pt(-336, d, 402)} L${pt(-261, d, 404)} Z M${pt(-239, d, 318)} Q${pt(-239, d, 402)} ${pt(-164, d, 402)} L${pt(-239, d, 404)} Z`
  let teeth = ''
  for (let d = NEAR; d < CANOPY_END - 0.01; d += 0.04) teeth += `M${pt(200, d, 374)} L${pt(200, d + 0.02, 348)} L${pt(200, d + 0.04, 374)} Z `
  for (let x = -650; x < 200; x += 34) teeth += `M${pt(x, CANOPY_END, 374)} L${pt(x + 17, CANOPY_END, 348)} L${pt(x + 34, CANOPY_END, 374)} Z `
  // The station wall: doors, windows (the waiting room's lit), framed bills between them, a bench.
  const doors = [0.74, 1.14, 1.54]
  const wins = [0.94, 1.34, 1.74]
  const wallDark = [...doors.filter((d) => d !== 1.14).map((d) => archSide(-650, d, d + 0.075, 0, 270, 30)), ...wins.filter((d) => d !== 1.34).map((d) => archSide(-650, d, d + 0.065, 90, 290, 30))]
  const wallLit = [archSide(-650, 1.14, 1.215, 0, 270, 30), archSide(-650, 1.34, 1.405, 90, 290, 30)]
  const bills = [0.86, 1.06, 1.26, 1.46, 1.66].map((d) => side(-650, d, d + 0.045, 110, 210)).join(' ')
  // A bench against the wall: legs, the seat and its front rail, the back on its posts.
  const bench = [0.93, 1.07]
    .flatMap((d) => [side(-614, d, d + 0.008, 0, 46), side(-646, d, d + 0.008, 0, 108)])
    .concat([flat(46, 0.925, 1.085, -648, -612), side(-612, 0.925, 1.085, 34, 46), side(-647, 0.925, 1.085, 66, 104)])
    .join(' ')
  // A man in a hat and a long coat waiting on the platform, his case at his feet.
  const man = (x: number, y: number, k: number) =>
    `M${f(x - 30 * k)} ${y} L${f(x - 26 * k)} ${f(y - 230 * k)} Q${f(x - 30 * k)} ${f(y - 300 * k)} ${f(x - 12 * k)} ${f(y - 310 * k)} Q${f(x - 20 * k)} ${f(y - 330 * k)} ${f(x - 16 * k)} ${f(y - 350 * k)} L${f(x - 36 * k)} ${f(y - 352 * k)} L${f(x - 34 * k)} ${f(y - 362 * k)} L${f(x - 16 * k)} ${f(y - 364 * k)} Q${f(x)} ${f(y - 400 * k)} ${f(x + 16 * k)} ${f(y - 364 * k)} L${f(x + 34 * k)} ${f(y - 362 * k)} L${f(x + 36 * k)} ${f(y - 352 * k)} L${f(x + 16 * k)} ${f(y - 350 * k)} Q${f(x + 20 * k)} ${f(y - 330 * k)} ${f(x + 12 * k)} ${f(y - 310 * k)} Q${f(x + 32 * k)} ${f(y - 300 * k)} ${f(x + 28 * k)} ${f(y - 230 * k)} L${f(x + 30 * k)} ${y} Z`
  const manD = 1.3
  const waiting = `${man(sx(-20, manD), sy(0, manD), 0.44 / manD)} ${front(manD, 22, 82, 0, 42)} ${front(manD, 44, 60, 42, 50)}`
  // Telegraph poles beyond the train, their wires running away with them.
  const poles = [1.9, 2.5, 3.1, 3.7, 4.3, 4.9]
  const poleD = poles.map((d) => `${front(d, 1093, 1107, -100, 860)} ${front(d, 1050, 1150, 812, 824)} ${front(d, 1060, 1140, 770, 780)}`).join(' ')
  const wires = [1052, 1148, 1062, 1138].map((x, i) => `M${pt(x, 1.2, i < 2 ? 824 : 780)} L${pt(x, poles[poles.length - 1], i < 2 ? 824 : 780)}`).join(' ')
  // Steam from the chimney, rising and blown back over the train: soft billows, larger as they climb.
  const cx = sx(650, 2.565)
  const cy = sy(330, 2.565)
  const puffs: ReactNode[] = []
  for (let i = 0; i < 16; i++) {
    const t = i / 15
    const bx = cx + 150 * t ** 1.6
    const by = cy - 190 * t
    const rad = 7 + 46 * t
    for (let k = 0; k < (i < 3 ? 1 : 3); k++) {
      const jx = k === 0 ? 0 : (r() - 0.5) * rad * 1.1
      const jy = k === 0 ? 0 : (r() - 0.5) * rad * 0.8
      puffs.push(<circle key={`${i}-${k}`} cx={f(bx + jx)} cy={f(by + jy)} r={f(rad * (0.7 + r() * 0.4))} fill={`url(#${id}-puff)`} />)
    }
  }
  return (
    <>
      <Layer depth="far">
        <Moon x={1470} y={160} r={34} id={id} />
        {/* low hills and the town on the horizon, seen past the end of the canopy */}
        <P d="M-40 520 L-40 492 Q200 470 420 486 Q640 474 900 484 Q1200 472 1640 490 V520 Z" fill="var(--sil-haze)" />
        <P d="M300 520 V478 L318 466 L336 478 V470 H380 V482 H410 V440 H450 V486 H520 V474 L540 462 L560 474 V490 H600 V520 Z M414 443 L430 398 L446 443 Z M1000 520 V470 H1040 V480 H1080 V440 H1096 V480 H1130 V520 Z" />
      </Layer>
      <Layer depth="mid">
        {/* the ground, the tracks and their sleepers, the platform with its pale edge and dark face */}
        <P d={`M-40 ${VY} H1640 V910 H-40 Z`} />
        <P d={`M-40 ${VY} H1640 V640 H-40 Z`} fill={`url(#${id}-sheen)`} opacity={0.45} />
        <P d={sleepers} fill="var(--sil-near)" />
        <P d={rails} fill="var(--sil-back)" />
        <P d={`${flat(0, NEAR, PLATFORM_END, -650, 150)} M${pt(-650, NEAR, 0)} L${pt(-650, PLATFORM_END, 0)} L${pt(-900, PLATFORM_END, 0)} L${pt(-900, NEAR, 0)} Z`} fill="var(--sil-back)" />
        <P d={flat(0, NEAR, PLATFORM_END, 112, 150)} fill="var(--sil-haze)" />
                <P d={`M${pt(-650, NEAR, 0)} L${pt(150, NEAR, 0)} L${pt(150, 1.2, 0)} L${pt(-650, 1.2, 0)} Z`} fill={`url(#${id}-sheen)`} opacity={0.35} />
        {/* the signal gantry over the tracks, far down the line */}
        <P d={`${front(6.5, -130, -112, -100, 640)} ${front(6.5, 990, 1008, -100, 640)} ${front(6.5, -136, 1014, 606, 640)} ${[180, 470, 760].map((x) => `${front(6.5, x - 4, x + 4, 640, 780)} ${front(6.5, x + 4, x + 70, 740, 756)}`).join(' ')}`} />
        <g fill="none" stroke="currentColor" strokeWidth={1}>
          <path d={Array.from({ length: 12 }, (_, i) => `M${pt(-130 + i * 95, 6.5, 606)} L${pt(-82 + i * 95, 6.5, 640)} L${pt(-35 + i * 95, 6.5, 606)}`).join(' ')} />
        </g>
        {/* telegraph poles beyond the train, and the train in front of them */}
        <P d={poleD} />
        <g fill="none" stroke="currentColor" strokeWidth={1.2}>
          <path d={wires} />
        </g>
        <P d={under.join(' ')} fill="var(--sil-near)" />
        <P d={body.join(' ')} />
        <P d={trim.join(' ')} fill="var(--sil-back)" opacity={0.5} />
        <P d={dark.join(' ')} fill="var(--sil-near)" />
        <defs>
          <radialGradient id={`${id}-puff`}>
            <stop offset="0" stopColor="var(--moon)" stopOpacity="0.22" />
            <stop offset="0.55" stopColor="var(--moon)" stopOpacity="0.11" />
            <stop offset="1" stopColor="var(--moon)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {puffs}
        {/* the station wall, its doors and windows, bills on it, a bench */}
        <P d={side(-650, NEAR, CANOPY_END, 0, 420)} />
        <P d={side(-650, NEAR, CANOPY_END, 0, 24)} fill="var(--sil-near)" opacity={0.5} />
        <P d={wallDark.join(' ')} fill="var(--sil-near)" opacity={0.8} />
        <P d={bills} fill="var(--sil-back)" opacity={0.7} />
        <P d={bench} fill="var(--sil-near)" />
        <P d={waiting} fill="var(--sil-near)" />
        {/* the canopy: its underside and purlins, the valance and its end */}
        <P d={flat(420, NEAR, CANOPY_END, -650, 204)} fill="var(--sil-near)" />
        <P d={[-470, -250, -30, 140].map((x) => flat(418, NEAR, CANOPY_END, x - 6, x + 6)).join(' ')} fill="var(--sil-mid)" />
        <P d={`${side(200, NEAR, CANOPY_END, 372, 422)} ${front(CANOPY_END, -656, 204, 372, 422)}`} />
        <P d={teeth} />
        {/* each girder resting on its column and brackets, farthest first (a far girder drawn after the near
            columns crossed in front of them; a column drawn over its own girder stood in front of it) */}
        {[...cols].reverse().map((d) => (
          <g key={d}>
            <P d={column(d)} fill="var(--sil-near)" />
            <P d={front(d, -650, 200, 398, 422)} fill="var(--sil-mid)" />
          </g>
        ))}
        {/* the clock and the lamps hanging from the girders */}
        <P d={`${front(0.85, -64, -56, 352, 400)} ${lamps.map((d) => `${front(d, 57, 63, 344, 420)} ${front(d, 46, 74, 334, 346)}`).join(' ')}`} fill="var(--sil-near)" />
        <circle cx={sx(-60, 0.85)} cy={sy(306, 0.85)} r={52} fill="var(--sil-near)" />
        <g className="scr-rim" strokeWidth={2}>
          <path d={`M${pt(604, NEAR, 290)} L${pt(604, 1.85, 290)}`} />
        </g>
        {/* the lamps' hoods catch their own light */}
        <g className="scr-rim scr-rim-lamp" strokeWidth={1.5}>
          <path d={lamps.map((d) => `M${pt(46, d, 334)} L${pt(46, d, 346)} L${pt(74, d, 346)} L${pt(74, d, 334)}`).join(' ')} />
        </g>
      </Layer>
      <Layer depth="lit">
        <P d={litWin.join(' ')} fill={`url(#${id}-glass)`} />
        <P d={cabGlow} fill={`url(#${id}-glass)`} />
        <P d={wallLit.join(' ')} fill={`url(#${id}-glass)`} />
        {/* the clock face, lit from inside, and its hands */}
        <circle cx={sx(-60, 0.85)} cy={sy(306, 0.85)} r={44} opacity={0.7} />
        <P d={`M${f(sx(-60, 0.85) - 1.5)} ${f(sy(306, 0.85))} v-34 h3 v34 Z M${f(sx(-60, 0.85))} ${f(sy(306, 0.85) - 1.5)} h-24 v3 h24 Z`} fill="var(--sil-mid)" />
        {/* the lamps: glass under each cap, its light, its reflection on the wet platform */}
        {lamps.map((d) => (
          <g key={d}>
            <Halo id={`${id}-halo`} x={sx(60, d)} y={sy(316, d)} r={190 / d} />
            <P d={`M${pt(48, d, 334)} L${pt(72, d, 334)} L${pt(66, d, 300)} L${pt(54, d, 300)} Z`} />
            <ellipse cx={sx(60, d)} cy={sy(0, d) + 26 / d} rx={14 / d} ry={46 / d} fill={`url(#${id}-halo)`} />
          </g>
        ))}
        {/* the signal lamps on the gantry */}
        {[180, 470, 760].map((x) => (
          <g key={x}>
            <Halo id={`${id}-halo`} x={sx(x + 60, 6.5)} y={sy(748, 6.5)} r={26} />
            <circle cx={sx(x + 60, 6.5)} cy={sy(748, 6.5)} r={2.6} />
          </g>
        ))}
        <Halo id={`${id}-halo`} x={sx(-650, 1.2)} y={sy(160, 1.2)} r={180} o={0.5} />
      </Layer>
      <Layer depth="near">
        {/* a luggage barrow in the foreground, piled with trunks and cases: small and to the left, clear of the
            frame's edge at both drift ends and of the nearest column's foot (overlapping it, the column rose out of the luggage) */}
        <g transform="translate(-3 306) scale(0.66)">
          <P d="M96 860 h280 v-16 h-280 Z M120 860 v20 h10 v-20 Z M342 860 v20 h10 v-20 Z M376 852 l40 -120 h10 l-40 124 Z" />
          <circle cx={140} cy={874} r={26} />
          <circle cx={340} cy={874} r={26} />
          <P d="M110 844 V744 H262 V844 Z M268 844 V770 H368 V844 Z M126 744 V690 H244 V744 Z M282 770 V744 Q318 724 354 744 V770 Z" />
          <P d="M110 764 H262 v6 H110 Z M110 820 H262 v6 H110 Z M180 744 v100 h6 v-100 Z M268 806 H368 v5 H268 Z M174 690 v-10 h22 v10 Z" fill="var(--sil-mid)" />
        </g>
      </Layer>
    </>
  )
}
