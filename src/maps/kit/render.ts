// Draws a MapDoc as one SVG file: aged paper, ink walls, washes for water and grass, the stamps, the
// labels, a title, a compass rose and a scale bar. Pure string building (it runs in the browser, in
// Node for the prerender and the tests, and in the Edge Functions). The output passes sanitizeSvg
// (supabase/functions/_shared/svg-safe.ts): a test checks it for every stamp and generated map.
import { CELL_METRES, footprint, groundAt, isSecretCell, playersMap, WALLISH, type MapDoc } from './model.ts'
import { STAMPS } from './stamps.ts'

export type Audience = 'keeper' | 'players'

export interface RenderOptions {
  audience?: Audience
  lang?: 'fr' | 'en'
}

/** Units per cell (stamps are drawn at 100 per cell and scaled down). */
export const CELL = 40

const PAPER = '#efe2c2'
const EDGE = '#cdb27c'
const INK = '#3a2a1a'
const RED = '#9a3020'
const FLOOR = '#f7eed7'
const WATER = '#aabfba'
const WATER_INK = '#3f5a5c'
const GRASS = '#c9c88f'
const ROAD = '#e1d3ad'
const DIRT = '#dcc69a'
const PAVING = '#e6dcc0'

const f = (v: number) => String(Math.round(v * 10) / 10)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Deterministic noise in [0, 1) for integer coordinates. */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const TEXT = {
  fr: { keeper: 'Version du gardien : ce qui est en rouge est secret', cell: (m: string) => `1 case = ${m} m`, n: 'N' },
  en: { keeper: 'Keeper’s copy: what is in red is secret', cell: (m: string) => `1 square = ${m} m`, n: 'N' },
}

const metres = (m: number, lang: 'fr' | 'en') => (lang === 'fr' ? String(m).replace('.', ',') : String(m))

/** Runs of cells matching `test`, as one path of rectangles. */
function runs(doc: MapDoc, ox: number, oy: number, test: (c: string, x: number, y: number) => boolean): string {
  let d = ''
  for (let y = 0; y < doc.rows; y++) {
    let start = -1
    for (let x = 0; x <= doc.cols; x++) {
      const on = x < doc.cols && test(groundAt(doc, x, y), x, y)
      if (on && start < 0) start = x
      if (!on && start >= 0) {
        d += `M${f(ox + start * CELL)} ${f(oy + y * CELL)}h${f((x - start) * CELL)}v${CELL}h${f(-(x - start) * CELL)}z`
        start = -1
      }
    }
  }
  return d
}

/** Cell edges between a cell that passes `inside` and one that doesn't, as segments. */
function edges(doc: MapDoc, inside: (x: number, y: number) => boolean, vertex: (x: number, y: number) => [number, number]): string {
  let d = ''
  const seg = (x1: number, y1: number, x2: number, y2: number) => {
    const [a, b] = vertex(x1, y1)
    const [c, e] = vertex(x2, y2)
    d += `M${f(a)} ${f(b)}L${f(c)} ${f(e)}`
  }
  for (let y = 0; y < doc.rows; y++) {
    for (let x = 0; x < doc.cols; x++) {
      if (!inside(x, y)) continue
      if (!inside(x, y - 1)) seg(x, y, x + 1, y)
      if (!inside(x, y + 1)) seg(x, y + 1, x + 1, y + 1)
      if (!inside(x - 1, y)) seg(x, y, x, y + 1)
      if (!inside(x + 1, y)) seg(x + 1, y, x + 1, y + 1)
    }
  }
  return d
}

/** Where the grid sits in the drawing: the editor lays its pointer layer over it. */
export function mapLayout(doc: Pick<MapDoc, 'cols' | 'rows' | 'title'>) {
  const side = 44
  const top = doc.title ? 96 : 44
  const bottom = 76
  return { side, top, bottom, ox: side, oy: top, width: doc.cols * CELL + side * 2, height: doc.rows * CELL + top + bottom }
}

export function renderMap(input: MapDoc, opts: RenderOptions = {}): string {
  const audience = opts.audience ?? 'keeper'
  const lang = opts.lang ?? 'fr'
  const doc = audience === 'players' ? playersMap(input) : input
  const words = TEXT[lang]
  const seed = [...doc.title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, doc.cols * 97 + doc.rows)

  const { side, top, bottom, ox, oy, width: W, height: H } = mapLayout(doc)
  const gw = doc.cols * CELL
  const gh = doc.rows * CELL
  const at = (x: number, y: number) => groundAt(doc, x, y)
  const under = doc.kind === 'underground'

  // What is open ground: floor, doors and terrain; underground, nothing and rock are both rock.
  const isOpen = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= doc.cols || y >= doc.rows) return false
    const c = at(x, y)
    if (under) return c !== '#' && c !== ' ' && c !== 'w'
    return c !== ' ' && c !== '#'
  }
  // Hand-drawn wobble of cell corners underground (shared by neighbours, so outlines stay joined).
  const wobble = (x: number, y: number): [number, number] => [ox + x * CELL + (hash(x, y, seed) - 0.5) * 12, oy + y * CELL + (hash(y, x, seed + 7) - 0.5) * 12]
  const jitter = (x: number, y: number): [number, number] =>
    under ? [ox + x * CELL + (hash(x, y, seed) - 0.5) * 12, oy + y * CELL + (hash(y, x, seed + 7) - 0.5) * 12] : [ox + x * CELL, oy + y * CELL]

  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`)
  if (doc.title) out.push(`<title>${esc(doc.title)}</title>`)

  // ---------------------------------------------------------------- defs
  const used = [...new Set(doc.items.map((i) => i.t))].filter((t) => STAMPS[t])
  out.push('<defs>')
  out.push(
    `<radialGradient id="vignette" cx="50%" cy="50%" r="72%"><stop offset="55%" stop-color="${EDGE}" stop-opacity="0"/><stop offset="100%" stop-color="${EDGE}" stop-opacity=".75"/></radialGradient>`,
    `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${Math.abs(seed % 97)}" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .3  0 0 0 0 .2  0 0 0 0 .1  0 0 0 -1.6 .9"/></filter>`,
    `<pattern id="p-grid" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><path d="M0 0H${CELL}M0 0V${CELL}" fill="none" stroke="${INK}" stroke-width=".6" opacity=".22"/></pattern>`,
    `<pattern id="p-water" width="${CELL}" height="${CELL / 2}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><path d="M4 10q6 -5 12 0t12 0" fill="none" stroke="${WATER_INK}" stroke-width="1" opacity=".55"/></pattern>`,
    `<pattern id="p-grass" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><path d="M8 14l2 -5l2 5M26 30l2 -5l2 5M30 10l1.5 -4l1.5 4M12 34l1.5 -4l1.5 4" fill="none" stroke="${INK}" stroke-width=".9" opacity=".55"/></pattern>`,
    `<pattern id="p-cobble" width="${CELL / 4}" height="${CELL / 4}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><rect x="1" y="1" width="${CELL / 4 - 2}" height="${CELL / 4 - 2}" rx="2" fill="none" stroke="${INK}" stroke-width=".5" opacity=".45"/></pattern>`,
    `<pattern id="p-paving" width="${CELL / 2}" height="${CELL / 2}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><path d="M0 0H${CELL / 2}M0 0V${CELL / 2}" fill="none" stroke="${INK}" stroke-width=".6" opacity=".35"/></pattern>`,
    `<pattern id="p-dirt" width="${CELL / 2}" height="${CELL / 2}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><circle cx="4" cy="6" r=".9" fill="${INK}" opacity=".45"/><circle cx="14" cy="15" r=".7" fill="${INK}" opacity=".45"/></pattern>`,
  )
  for (const id of used) {
    const st = STAMPS[id]
    out.push(`<symbol id="st-${id}" viewBox="0 0 ${st.size[0] * 100} ${st.size[1] * 100}" overflow="visible">${st.body}</symbol>`)
  }
  out.push('</defs>')

  // ---------------------------------------------------------------- paper
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${PAPER}"/>`)
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${PAPER}" filter="url(#grain)" opacity=".55"/>`)

  // ---------------------------------------------------------------- ground
  const fill = (d: string, attrs: string) => d && out.push(`<path d="${d}" ${attrs}/>`)
  // Cells as polygons through their (wobbly, underground) corners: neighbours share corners exactly.
  const cells = (test: (x: number, y: number) => boolean, corner = jitter) => {
    let d = ''
    for (let y = 0; y < doc.rows; y++) {
      for (let x = 0; x < doc.cols; x++) {
        if (!test(x, y)) continue
        const p = [corner(x, y), corner(x + 1, y), corner(x + 1, y + 1), corner(x, y + 1)]
        d += `M${p.map(([a, b]) => `${f(a)} ${f(b)}`).join('L')}Z`
      }
    }
    return d
  }
  // A wall stands on the middle of its cell: its quarters facing a floor are floor, the others stay
  // outside (no pale band along the outer walls).
  const wallFloor = () => {
    let d = ''
    const floor = (x: number, y: number) => at(x, y) === '.'
    for (let y = 0; y < doc.rows; y++) {
      for (let x = 0; x < doc.cols; x++) {
        if (!WALLISH.has(at(x, y))) continue
        for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const dx = qx ? 1 : -1
          const dy = qy ? 1 : -1
          if (floor(x + dx, y) || floor(x, y + dy) || floor(x + dx, y + dy)) d += `M${f(ox + (x + qx / 2) * CELL)} ${f(oy + (y + qy / 2) * CELL)}h${CELL / 2}v${CELL / 2}h${-CELL / 2}z`
        }
      }
    }
    return d
  }
  // Rock is the paper underground; open cells are cut out of it with a wobbly outline.
  const open = under ? cells(isOpen) : ''
  if (under) {
    fill(open, `fill="${FLOOR}" stroke="${FLOOR}" stroke-width="1.2" stroke-linejoin="round"`)
  } else {
    fill(runs(doc, ox, oy, (c) => c === '.') + wallFloor(), `fill="${FLOOR}"`)
  }
  // Grass runs under the water too: water edges wobble, and the shore shows grass, not paper.
  const grassy = (x: number, y: number) => at(x, y) === '~' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === '"')
  fill(runs(doc, ox, oy, (c, x, y) => c === '"' || grassy(x, y)), `fill="${GRASS}" fill-opacity=".55"`)
  fill(runs(doc, ox, oy, (c) => c === '"'), 'fill="url(#p-grass)"')
  fill(runs(doc, ox, oy, (c) => c === '='), `fill="${ROAD}"`)
  fill(runs(doc, ox, oy, (c) => c === '='), 'fill="url(#p-cobble)"')
  fill(runs(doc, ox, oy, (c) => c === ':'), `fill="${DIRT}" fill-opacity=".75"`)
  fill(runs(doc, ox, oy, (c) => c === ':'), 'fill="url(#p-dirt)"')
  fill(runs(doc, ox, oy, (c) => c === '+'), `fill="${PAVING}"`)
  fill(runs(doc, ox, oy, (c) => c === '+'), 'fill="url(#p-paving)"')
  if (!under) fill(runs(doc, ox, oy, (c) => c === '.'), 'fill="url(#p-grid)"')
  const water = cells((x, y) => at(x, y) === '~', wobble)
  fill(water, `fill="${WATER}" stroke="${WATER}" stroke-width="1"`)
  fill(water, 'fill="url(#p-water)"')

  // Edges between kinds of ground: shores, road sides, path sides.
  const is = (chars: string) => (x: number, y: number) => x >= 0 && y >= 0 && x < doc.cols && y < doc.rows && chars.includes(at(x, y))
  const plain = (x: number, y: number): [number, number] => [ox + x * CELL, oy + y * CELL]
  fill(edges(doc, is('~'), wobble), `fill="none" stroke="${WATER_INK}" stroke-width="1.8" stroke-linecap="round"`)
  fill(edges(doc, is('=+'), plain), `fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round" opacity=".7"`)
  fill(edges(doc, is(':'), plain), `fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="4 5" stroke-linecap="round" opacity=".6"`)

  if (under) {
    // The cave wall, and hatching on the rock along it.
    fill(edges(doc, isOpen, jitter), `fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"`)
    let hatch = ''
    for (let y = -1; y <= doc.rows; y++) {
      for (let x = -1; x <= doc.cols; x++) {
        if (isOpen(x, y)) continue
        let near = false
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = isOpen(x + dx, y + dy)
        if (!near) continue
        const a = hash(Math.floor(x / 2), Math.floor(y / 2), seed + 3) * Math.PI
        const cx = ox + (x + 0.5) * CELL
        const cy = oy + (y + 0.5) * CELL
        const dx = Math.cos(a) * 12
        const dy = Math.sin(a) * 12
        for (const k of [-10, 0, 10]) {
          const px = cx - Math.sin(a) * k
          const py = cy + Math.cos(a) * k
          hatch += `M${f(px - dx)} ${f(py - dy)}L${f(px + dx)} ${f(py + dy)}`
        }
      }
    }
    // Keep the hatching on the rock: clip to the map, behind the open ground.
    out.push(`<clipPath id="inside"><rect x="${ox}" y="${oy}" width="${gw}" height="${gh}"/></clipPath>`)
    out.push(`<path d="${hatch}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round" opacity=".55" clip-path="url(#inside)"/>`)
    // Redraw the open ground over the hatching's ends, then the wall again.
    fill(open, `fill="${FLOOR}" stroke="${FLOOR}" stroke-width="1.2" stroke-linejoin="round"`)
    fill(water, `fill="${WATER}" stroke="${WATER}" stroke-width="1"`)
    fill(water, 'fill="url(#p-water)"')
    fill(edges(doc, isOpen, jitter), `fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"`)
  }

  // ---------------------------------------------------------------- walls, doors, windows
  const wallish = (x: number, y: number) => x >= 0 && y >= 0 && x < doc.cols && y < doc.rows && WALLISH.has(at(x, y))
  let walls = ''
  let thin = ''
  let secretMarks = ''
  const doorAcross = (x: number, y: number) => wallish(x - 1, y) || wallish(x + 1, y) || (!wallish(x, y - 1) && !wallish(x, y + 1) && (isOpen(x, y - 1) || isOpen(x, y + 1)))
  for (let y = 0; y < doc.rows; y++) {
    for (let x = 0; x < doc.cols; x++) {
      const c = at(x, y)
      const cx = ox + (x + 0.5) * CELL
      const cy = oy + (y + 0.5) * CELL
      const h = CELL / 2
      if (under) {
        if (c === 'd' || c === 's') {
          // A door across a passage: the passage runs where the open neighbours are.
          const across = isOpen(x - 1, y) || isOpen(x + 1, y)
          const bar = across ? `M${f(cx - 4)} ${f(cy - h + 4)}h8v${CELL - 8}h-8z` : `M${f(cx - h + 4)} ${f(cy - 4)}v8h${CELL - 8}v-8z`
          if (c === 'd') walls += bar
          else secretMarks += bar
        }
        continue
      }
      if (!WALLISH.has(c)) continue
      if (c === '#' || c === 's') {
        const n = [wallish(x, y - 1), wallish(x + 1, y), wallish(x, y + 1), wallish(x - 1, y)]
        if (!n.some(Boolean)) walls += `M${f(cx - 6)} ${f(cy - 6)}h12v12h-12z`
        else {
          if (n[0]) walls += `M${f(cx)} ${f(cy)}V${f(cy - h)}`
          if (n[1]) walls += `M${f(cx)} ${f(cy)}H${f(cx + h)}`
          if (n[2]) walls += `M${f(cx)} ${f(cy)}V${f(cy + h)}`
          if (n[3]) walls += `M${f(cx)} ${f(cy)}H${f(cx - h)}`
        }
        if (c === 's') secretMarks += doorAcross(x, y) ? `M${f(cx - h + 3)} ${f(cy - 8)}h${CELL - 6}v16h${-(CELL - 6)}z` : `M${f(cx - 8)} ${f(cy - h + 3)}v${CELL - 6}h16v${-(CELL - 6)}z`
      } else if (c === 'd') {
        const across = doorAcross(x, y)
        // Jambs, the door leaf open at a right angle, and its swing.
        if (across) {
          walls += `M${f(cx - h)} ${f(cy)}H${f(cx - h + 5)}M${f(cx + h)} ${f(cy)}H${f(cx + h - 5)}`
          thin += `M${f(cx - h + 5)} ${f(cy)}V${f(cy + CELL - 10)}M${f(cx - h + 5)} ${f(cy + CELL - 10)}A${CELL - 10} ${CELL - 10} 0 0 0 ${f(cx + h - 5)} ${f(cy)}`
        } else {
          walls += `M${f(cx)} ${f(cy - h)}V${f(cy - h + 5)}M${f(cx)} ${f(cy + h)}V${f(cy + h - 5)}`
          thin += `M${f(cx)} ${f(cy - h + 5)}H${f(cx + CELL - 10)}M${f(cx + CELL - 10)} ${f(cy - h + 5)}A${CELL - 10} ${CELL - 10} 0 0 1 ${f(cx)} ${f(cy + h - 5)}`
        }
      } else if (c === 'w') {
        const across = doorAcross(x, y)
        if (across) {
          walls += `M${f(cx - h)} ${f(cy)}H${f(cx - h + 4)}M${f(cx + h)} ${f(cy)}H${f(cx + h - 4)}`
          thin += `M${f(cx - h + 4)} ${f(cy - 4)}H${f(cx + h - 4)}M${f(cx - h + 4)} ${f(cy + 4)}H${f(cx + h - 4)}M${f(cx - h + 4)} ${f(cy - 4)}V${f(cy + 4)}M${f(cx + h - 4)} ${f(cy - 4)}V${f(cy + 4)}`
        } else {
          walls += `M${f(cx)} ${f(cy - h)}V${f(cy - h + 4)}M${f(cx)} ${f(cy + h)}V${f(cy + h - 4)}`
          thin += `M${f(cx - 4)} ${f(cy - h + 4)}V${f(cy + h - 4)}M${f(cx + 4)} ${f(cy - h + 4)}V${f(cy + h - 4)}M${f(cx - 4)} ${f(cy - h + 4)}H${f(cx + 4)}M${f(cx - 4)} ${f(cy + h - 4)}H${f(cx + 4)}`
        }
      }
    }
  }
  fill(walls, under ? `fill="#8a6a45" stroke="${INK}" stroke-width="1.6"` : `fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="square" stroke-linejoin="miter"`)
  fill(thin, `fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"`)
  if (secretMarks && audience === 'keeper') fill(secretMarks, `fill="${PAPER}" fill-opacity=".7" stroke="${RED}" stroke-width="1.6" stroke-dasharray="3 3"`)

  // Secret cells, for the keeper: a red dotted outline around them.
  if (audience === 'keeper' && doc.secret) {
    fill(edges(doc, (x, y) => x >= 0 && y >= 0 && x < doc.cols && y < doc.rows && isSecretCell(doc, x, y), plain), `fill="none" stroke="${RED}" stroke-width="1.6" stroke-dasharray="2 4" stroke-linecap="round"`)
  }

  // ---------------------------------------------------------------- stamps
  const items = [...doc.items].sort((a, b) => Number(!!a.secret) - Number(!!b.secret))
  for (const it of items) {
    const st = STAMPS[it.t]
    if (!st) continue
    const s = it.s ?? 1
    const [fw, fh] = footprint(it)
    const bw = st.size[0] * s * CELL
    const bh = st.size[1] * s * CELL
    const cx = ox + (it.x + fw / 2) * CELL
    const cy = oy + (it.y + fh / 2) * CELL
    const r = (it.r ?? 0) * 90
    const colour = it.secret ? RED : INK
    out.push(
      `<use href="#st-${it.t}" x="${f(-bw / 2)}" y="${f(-bh / 2)}" width="${f(bw)}" height="${f(bh)}" color="${colour}" transform="translate(${f(cx)} ${f(cy)})${r ? ` rotate(${r})` : ''}"/>`,
    )
  }

  // ---------------------------------------------------------------- labels
  const labelSize = doc.kind === 'outdoor' ? 14 : 13
  for (const l of doc.labels) {
    out.push(
      `<text x="${f(ox + l.x * CELL)}" y="${f(oy + l.y * CELL)}" font-family="serif" font-style="italic" font-size="${labelSize}" text-anchor="middle" dominant-baseline="middle" fill="${l.secret ? RED : INK}" stroke="${PAPER}" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke">${esc(l.text)}</text>`,
    )
  }

  // ---------------------------------------------------------------- frame, title, compass, scale
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#vignette)"/>`)
  out.push(`<rect x="${ox - 8}" y="${oy - 8}" width="${gw + 16}" height="${gh + 16}" fill="none" stroke="${INK}" stroke-width="2"/>`)
  out.push(`<rect x="${ox - 13}" y="${oy - 13}" width="${gw + 26}" height="${gh + 26}" fill="none" stroke="${INK}" stroke-width=".8"/>`)
  if (doc.title) {
    out.push(`<text x="${f(W / 2)}" y="44" font-family="serif" font-size="26" letter-spacing="2" text-anchor="middle" fill="${INK}">${esc(doc.title)}</text>`)
    out.push(`<path d="M${f(W / 2 - 90)} 60H${f(W / 2 - 8)}M${f(W / 2 + 8)} 60H${f(W / 2 + 90)}M${f(W / 2)} 55l5 5l-5 5l-5 -5z" fill="none" stroke="${INK}" stroke-width="1.2"/>`)
  }
  if (audience === 'keeper') {
    out.push(`<text x="${f(W / 2)}" y="${f(top - 22)}" font-family="serif" font-style="italic" font-size="12" text-anchor="middle" fill="${RED}">${esc(words.keeper)}</text>`)
  }
  // Compass rose, bottom right.
  const rx = W - side - 30
  const ry = H - bottom / 2 + 4
  out.push(
    `<g transform="translate(${f(rx)} ${f(ry)})"><circle r="15" fill="none" stroke="${INK}" stroke-width="1"/><path d="M0 -22L5 -5L22 0L5 5L0 22L-5 5L-22 0L-5 -5Z" fill="${PAPER}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="M0 -22L5 -5L0 0Z M22 0L5 5L0 0Z M0 22L-5 5L0 0Z M-22 0L-5 -5L0 0Z" fill="${INK}"/><text y="-27" font-family="serif" font-size="12" text-anchor="middle" fill="${INK}">${words.n}</text></g>`,
  )
  // Scale bar, bottom left: five cells, alternately filled.
  const m = CELL_METRES[doc.kind]
  const sx = side
  const sy = H - bottom / 2 - 2
  let bar = ''
  for (let i = 0; i < 5; i++) bar += `<rect x="${f(sx + i * CELL)}" y="${f(sy)}" width="${CELL}" height="7" fill="${i % 2 ? PAPER : INK}" stroke="${INK}" stroke-width="1"/>`
  out.push(bar)
  out.push(`<text x="${f(sx)}" y="${f(sy + 22)}" font-family="serif" font-size="11" fill="${INK}">0</text>`)
  out.push(`<text x="${f(sx + 5 * CELL)}" y="${f(sy + 22)}" font-family="serif" font-size="11" text-anchor="middle" fill="${INK}">${metres(Math.round(m * 5 * 10) / 10, lang)} m</text>`)
  out.push(`<text x="${f(sx + 5 * CELL + 30)}" y="${f(sy + 7)}" font-family="serif" font-style="italic" font-size="11" fill="${INK}">${esc(words.cell(metres(m, lang)))}</text>`)

  out.push('</svg>')
  return out.join('')
}
