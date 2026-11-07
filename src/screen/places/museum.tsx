// Drawn décor: museum. A great hall of a natural history museum at night: two tall arched windows with
// the moon in one, display cases along the back wall, a mammoth's skeleton on its plinth backlit by
// the archway into the next room, where a lamp is still burning; in front, a table case, a rope barrier,
// a mummy's coffin standing in its glass case and a watchman's lantern left on the floor. Fills the
// frame like the library. See the decor-artist skill.
import { type Draw, Halo, Layer, Moon, P, arched, f } from '../placeKit'

/** A bone (or a rod): a thick segment from (x1, y1) to (x2, y2), w wide, as a filled shape. */
const bone = (x1: number, y1: number, x2: number, y2: number, w: number) => {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const dx = (Math.sin(a) * w) / 2
  const dy = (-Math.cos(a) * w) / 2
  return `M${f(x1 + dx)} ${f(y1 + dy)} L${f(x2 + dx)} ${f(y2 + dy)} L${f(x2 - dx)} ${f(y2 - dy)} L${f(x1 - dx)} ${f(y1 - dy)} Z`
}

const FLOOR = 720
const WIN_L = arched(110, 200, 160, 400)
const WIN_R = arched(1090, 200, 160, 400)
const VPX = 800
const VPY = 380

export const museum: Draw = (id) => {
  // The floor: a chequer of stone flags in perspective, rows closer together towards the back wall.
  const rows = [1, 0.92, 0.85, 0.79, 0.735, 0.69, 0.65, 0.61]
  const fy = (t: number) => VPY + (FLOOR - VPY) / t
  const fx = (k: number, t: number) => VPX + (80 * k) / t
  let flags = ''
  let joints = ''
  for (let i = 0; i + 1 < rows.length; i++) {
    for (let k = -16; k < 16; k++) {
      if ((i + k) % 2 === 0) continue
      const [t1, t2] = [rows[i], rows[i + 1]]
      flags += `M${f(fx(k, t1))} ${f(fy(t1))} L${f(fx(k + 1, t1))} ${f(fy(t1))} L${f(fx(k + 1, t2))} ${f(fy(t2))} L${f(fx(k, t2))} ${f(fy(t2))} Z `
    }
  }
  for (const t of rows) joints += `M-40 ${f(fy(t))} H1640 `
  // Display cases against the back wall: a frame, panes, shelves, the things on them.
  const caseAt = (x: number) => ({
    frame: `M${x} 738 V408 H${x + 190} V738 Z M${x - 8} 410 h206 v-14 h-206 Z M${x + 87} 396 l8 -14 l8 14 Z`,
    glass: `M${x + 12} 664 V420 H${x + 89} V664 Z M${x + 101} 664 V420 H${x + 178} V664 Z`,
    shelves: `M${x + 12} 536 h166 v5 h-166 Z M${x + 12} 600 h166 v5 h-166 Z`,
    glints: `M${x + 20} 500 L${x + 60} 430 M${x + 26} 530 L${x + 80} 436 M${x + 120} 650 L${x + 160} 580`,
    things: `M${x + 30} 536 q-8 -18 2 -30 h-4 v-6 h18 v6 h-4 q10 12 2 30 Z M${x + 70} 536 v-22 a10 10 0 0 1 20 0 v22 Z M${x + 128} 536 l6 -40 h4 l6 40 Z M${x + 156} 536 v-14 h20 v14 Z M${x + 26} 600 v-18 h40 v18 Z M${x + 120} 600 q0 -26 20 -26 q20 0 20 26 Z M${x + 40} 664 l16 -34 l16 34 Z M${x + 130} 664 v-28 h34 v28 Z`,
  })
  const cases = [caseAt(310)]
  // The mammoth (facing left): legs, pelvis, shoulder blade, the spine, the skull and its tusks, ribs, the
  // iron rods that hold it up from the plinth.
  const top = 746
  const legs = [
    bone(668, top, 680, 650, 16), bone(680, 652, 662, 560, 20), bone(700, top, 706, 652, 15), bone(706, 654, 700, 566, 19),
    bone(912, top, 902, 664, 15), bone(902, 666, 928, 588, 22), bone(944, top, 932, 664, 14), bone(932, 666, 950, 592, 20),
  ].join(' ')
  const spine = `M948 600 Q830 532 700 512 Q660 508 640 534 L646 544 Q666 522 700 526 Q826 548 944 612 Z`
  const scapula = `M650 540 Q690 520 712 548 L700 610 Q676 612 664 590 Z`
  const pelvis = `M902 580 Q936 560 970 590 Q966 626 938 630 Q910 620 902 580 Z`
  // the skull: a high dome set back, the brow falling steeply to the tusks' sockets, the jaw under it
  const skull = `M566 622 L558 582 Q562 522 590 482 Q606 448 636 444 Q666 448 668 490 Q670 530 654 554 L644 566 Q652 600 640 618 Q628 630 604 628 Z M614 536 a8 8 0 1 0 0.1 0 Z`
  // the tusks: down, forward, then up and curling in, thick at the root
  const tusks = `M574 600 C556 668 500 700 458 668 C432 648 434 606 456 584 C462 578 470 576 474 580 C458 602 458 638 480 652 C510 670 548 646 562 592 Z M606 612 C594 680 544 714 504 692 C484 680 478 656 486 638 C494 632 500 636 500 642 C500 664 520 676 544 668 C570 658 584 632 592 606 Z`
  const tail = bone(966, 602, 986, 660, 6)
  const ribs = Array.from({ length: 9 }, (_, i) => {
    const x = 712 + i * 24
    const y = 520 + i * 7.5
    const drop = 120 - i * 7
    return `M${x} ${f(y)} q${f(-26 + i)} ${f(drop * 0.55)} ${f(-6 + i * 1.5)} ${f(drop)}`
  }).join(' ')
  const rods = `${bone(760, top, 760, 540, 4)} ${bone(870, top, 870, 568, 4)} ${bone(620, top, 620, 590, 4)}`
  // The sarcophagus standing in its case: a headdress, shoulders, tapering to the feet.
  const coffin = `M1425 300 Q1376 302 1370 360 L1362 438 Q1340 450 1342 486 Q1346 640 1376 824 H1474 Q1504 640 1508 486 Q1510 450 1488 438 L1480 360 Q1474 302 1425 300 Z`
  return (
    <>
      <Layer depth="far">
        <Moon x={196} y={318} r={28} id={id} />
        {/* the next room, seen through the archway: its walls receding, its floor, a doorway, a case, a bust */}
        <P d="M548 220 H1052 V722 H548 Z" fill="var(--sil-back)" />
        <P d="M560 722 L660 650 H940 L1040 722 Z" fill="var(--sil-mid)" />
        <P d="M548 220 L660 340 V650 L548 722 Z M1052 220 L940 340 V650 L1052 722 Z" fill="var(--sil-mid)" opacity={0.55} />
        <P d={arched(770, 470, 60, 180)} fill="var(--sil-mid)" />
        <P d="M690 650 V560 H738 V650 Z M686 562 h56 v-8 h-56 Z M698 554 v-12 h8 v12 Z M722 554 v-20 a6 6 0 0 1 12 0 v20 Z M866 650 V590 h32 v60 Z M860 592 h44 v-8 h-44 Z M870 584 q0 -30 12 -34 q12 4 12 34 Z" fill="var(--sil-mid)" />
        {/* the hall's back wall: two tall windows and the archway cut out of it */}
        <P d={`M-80 -10 H1680 V722 H-80 Z ${WIN_L} ${WIN_R} ${arched(560, 230, 480, 492)}`} fillRule="evenodd" fill="var(--sil-back)" />
        {/* cornice, pilasters, skirting (broken at the archway), the archway's moulding and keystone */}
        <P d="M-80 120 H1680 v22 H-80 Z M-80 142 H1680 v6 H-80 Z M-80 700 H542 v22 H-80 Z M1058 700 H1680 v22 H1058 Z" fill="var(--sil-mid)" opacity={0.7} />
        <P d="M40 148 h30 v552 h-30 Z M516 148 h26 v552 h-26 Z M1556 148 h30 v552 h-30 Z" fill="var(--sil-mid)" opacity={0.35} />
        <P d="M542 722 V470 A258 258 0 0 1 1058 470 V722 H1040 V470 A240 240 0 0 0 560 470 V722 Z M786 210 h28 l-4 32 h-20 Z" fill="var(--sil-mid)" opacity={0.8} />
        {/* the windows' mullions and transoms, and their sills */}
        <g fill="none" stroke="var(--sil-back)" strokeWidth={8}>
          <path d="M163 600 V280 M217 600 V280 M110 280 H270 M110 440 H270 M1143 600 V280 M1197 600 V280 M1090 280 H1250 M1090 440 H1250" />
        </g>
        <P d="M98 612 H282 v-14 H98 Z M1078 612 H1262 v-14 H1078 Z" fill="var(--sil-mid)" />
      </Layer>
      <Layer depth="lit-far">
        {/* the lamp in the next room, on its back wall, and the light it throws */}
        <Halo id={`${id}-halo`} x={800} y={420} r={300} />
        <P d="M796 446 h8 v-14 h-8 Z M788 432 h24 l-4 -16 h-16 Z" />
        {/* moonlight (or daylight) on the windows' panes */}
        <g className="scr-moon">
          <P d={`${WIN_L} ${WIN_R}`} fill={`url(#${id}-shaft)`} opacity={0.3} />
        </g>
      </Layer>
      <Layer depth="mid">
        {/* the floor and its flags */}
        <P d={`M-40 ${FLOOR - 2} H1640 V910 H-40 Z`} fill="var(--sil-near)" />
        <P d={flags} fill="var(--sil-back)" fillOpacity={0.28} stroke="none" />
        <P d={joints} stroke="var(--sil-mid)" strokeWidth={1.2} fill="none" opacity={0.6} />
        {/* the display cases against the back wall */}
        {cases.map((c, i) => (
          <g key={i}>
            <P data-ground d={c.frame} fill="var(--sil-near)" />
            <P d={c.glass} fill="var(--sil-back)" opacity={0.22} />
            <P d={c.shelves} fill="var(--sil-near)" />
            <P d={c.things} fill="var(--sil-near)" opacity={0.85} />
            <P d={c.glints} stroke="var(--sil-haze)" strokeWidth={3} fill="none" opacity={0.16} />
          </g>
        ))}
      </Layer>
      <Layer depth="lit">
        {/* the moon's light (or the sun's) on the floor under each window, and the archway's on the flags */}
        <g className="scr-moon">
          <P d="M150 780 H296 L440 904 H300 Z M1130 780 H1276 L1420 904 H1280 Z" fill={`url(#${id}-shaft)`} opacity={0.35} />
        </g>
        <P d="M610 724 H990 L1150 904 H450 Z" fill={`url(#${id}-ray)`} opacity={0.75} />
      </Layer>
      <Layer depth="mid-front">
        {/* the mammoth on its plinth, in front of the archway's light (the plinth's ends clear of the archway's
            jambs: lined up with them, they slid apart as the layers drift) */}
        <P data-ground d="M620 806 V756 H1000 V806 Z" />
        <P d="M608 758 H1012 v-12 H608 Z" fill="var(--sil-mid)" />
        <g transform="translate(40 0)">
          <P d={rods} />
          <P d={`${legs} ${tail}`} fill="var(--sil-mid)" />
          <P d={`${scapula} ${pelvis}`} fill="var(--sil-mid)" />
          <P d={spine} fill="var(--sil-mid)" />
          <g fill="none" stroke="var(--sil-mid)" strokeWidth={6} strokeLinecap="round">
            <path d={ribs} />
          </g>
          <P d={skull} fillRule="evenodd" fill="var(--sil-mid)" />
          <P d={tusks} fill="var(--sil-haze)" opacity={0.45} />
          <g className="scr-rim scr-rim-lamp" strokeWidth={2}>
            <path d="M700 512 Q830 532 948 600 M558 582 Q562 522 590 482 Q606 448 636 444 Q666 448 668 490 Q670 530 654 554 M474 580 C458 602 458 638 480 652 M456 584 C434 606 432 648 458 668 C500 700 556 668 574 600 M902 580 Q936 560 970 590" />
          </g>
        </g>
        <g className="scr-rim scr-rim-lamp" strokeWidth={2}>
          <path d="M608 746 H1012" />
        </g>
      </Layer>
      <Layer depth="near">
        {/* a table case on the left: legs and their stretcher, the box, its sloping glass top */}
        <P data-ground d="M74 904 V760 h14 V904 Z M392 904 V760 h14 V904 Z M110 860 V760 h10 V860 Z M362 860 V760 h10 V860 Z M80 850 H400 v8 H80 Z" />
        <P d="M58 770 V704 H422 V770 Z M58 706 L82 668 H398 L422 706 Z" />
        <P d="M66 702 L86 674 H394 L414 702 Z" fill="var(--sil-back)" opacity={0.3} />
        <P d="M150 694 l40 -12 l4 4 l-40 12 Z M240 690 a8 5 0 1 0 0.1 0 Z M268 692 a8 5 0 1 0 0.1 0 Z M320 694 h50 v-10 h-50 Z" fill="var(--sil-near)" opacity={0.7} />
        <g className="scr-rim scr-rim-lamp" strokeWidth={2}>
          <path d="M58 706 H422 L398 668 M422 706 V770 M406 770 V904 M452 840 L460 830 H488 L496 840 M466 832 a8 8 0 0 1 16 0" />
        </g>
        {/* the watchman's lantern on the floor: base, cage, cap and handle */}
        <P data-ground d="M454 904 v-10 h40 v10 Z M458 896 v-50 h4 v50 Z M486 896 v-50 h4 v50 Z M452 848 h44 v-8 l-8 -10 h-28 l-8 10 Z" />
        <P d="M466 832 a8 8 0 0 1 16 0 h-3 a5 5 0 0 0 -10 0 Z" />
        {/* the rope barrier: brass posts and the rope swagging between them */}
        <P data-ground d={[620, 980].map((x) => `M${x - 18} 904 q18 -16 36 0 Z M${x - 3} 896 V800 h6 V896 Z M${x} 794 a8 8 0 1 0 0.1 0 Z`).join(' ')} />
        <g fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round">
          <path d="M620 806 Q800 870 980 806" />
        </g>
        {/* the coffin standing in its tall glass case on the right */}
        <P d={coffin} />
        <P d="M1400 336 Q1425 322 1450 336 Q1454 380 1425 392 Q1396 380 1400 336 Z" fill="var(--sil-back)" opacity={0.45} />
        <P d="M1362 438 Q1425 470 1488 438 M1356 520 Q1425 548 1494 520 M1366 640 Q1425 664 1484 640 M1378 740 Q1425 756 1472 740" stroke="var(--sil-back)" strokeWidth={3} fill="none" opacity={0.4} />
        <P data-ground d="M1300 904 V820 H1550 V904 Z M1306 822 V270 h14 V822 Z M1530 822 V270 h14 V822 Z M1292 274 H1558 v-22 H1292 Z M1308 252 L1425 222 L1542 252 Z" />
        <P d="M1320 820 V274 H1530 V820 Z" fill="var(--sil-back)" opacity={0.12} />
        {/* glints on the glass */}
        <P d="M1324 520 L1338 492 M1324 566 L1340 534 M1500 760 L1522 716 M1494 800 L1524 740 M100 700 L130 676 M300 700 L330 676" stroke="var(--sil-haze)" strokeWidth={3} fill="none" opacity={0.18} />
        <g className="scr-rim scr-rim-lamp" strokeWidth={2}>
          <path d="M1376 824 Q1346 640 1342 486 Q1340 450 1362 438 L1370 360 Q1376 302 1425 300" />
        </g>
      </Layer>
      <Layer depth="pulse">
        {/* the lantern's glass and flame, on its base */}
        <Halo id={`${id}-halo`} x={474} y={870} r={240} />
        <P d="M462 894 v-46 h24 v46 Z" opacity={0.75} />
        <P d="M474 882 q-6 -9 0 -20 q6 11 0 20 Z" />
      </Layer>
    </>
  )
}
