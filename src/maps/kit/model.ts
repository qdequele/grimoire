// A map on a grid: what the editor edits, what Claude composes from a description, what render.ts
// draws. Pure TypeScript with relative `.ts` imports and no DOM: copied as is into the Edge Functions
// by `pnpm maps:bundle` (scripts/gen-map-bundle.mjs), a test fails when the copy is stale.
//
// The ground is a list of rows, one character per cell (easy for a model to write and read back):
//   #  wall (a building, a garden wall) or solid rock (underground)
//   .  floor: inside a building, a cave or a courtyard
//   ␠  nothing: outside, open ground (underground: solid rock)
//   d  door in a wall          s  secret door (players see a wall)       w  window in a wall
//   ~  water                   "  grass                                  =  road (cobbles)
//   :  dirt path               +  paving (a square, a quay)
// Items are stamps (a bed, a tree, a coffin…) placed on cells, labels are words on the map. Anything
// marked secret, and the cells of `secret`, are left out of the players' copy.
import { STAMPS, type StampId } from './stamps.ts'

export const MAP_KINDS = ['building', 'underground', 'outdoor'] as const
export type MapKind = (typeof MAP_KINDS)[number]

export const GROUND = ['#', '.', ' ', 'd', 's', 'w', '~', '"', '=', ':', '+'] as const
export type Ground = (typeof GROUND)[number]

/** Ground the walls are made of (they join each other). */
export const WALLISH: ReadonlySet<string> = new Set(['#', 'd', 's', 'w'])

export const MAP_LIMITS = {
  minCols: 6,
  maxCols: 48,
  minRows: 6,
  maxRows: 36,
  items: 300,
  labels: 60,
  label: 40,
  title: 80,
  maxScale: 4,
} as const

/** Metres per cell, by kind: the scale bar. */
export const CELL_METRES: Record<MapKind, number> = { building: 1.5, underground: 3, outdoor: 10 }

export interface MapItem {
  /** Stamp id. */
  t: StampId
  /** Top-left cell of its footprint (after rotation); steps of 0.5. */
  x: number
  y: number
  /** Quarter turns clockwise. */
  r?: 0 | 1 | 2 | 3
  /** Size multiplier (a big tree, a large table), 1 to 4. */
  s?: number
  secret?: boolean
}

export interface MapLabel {
  text: string
  /** Centre of the text, in cells; steps of 0.5. */
  x: number
  y: number
  secret?: boolean
}

export interface MapDoc {
  v: 1
  kind: MapKind
  title: string
  cols: number
  rows: number
  ground: string[]
  items: MapItem[]
  labels: MapLabel[]
  /** Rows of `cols` characters: `x` marks a cell the players don't know about. */
  secret?: string[]
}

/** Characters refused in titles and labels (the map is also shown as HTML in places). */
export const hasMarkup = (s: string): boolean => /[<>&"]/.test(s)

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const half = (n: number) => Math.round(n * 2) / 2
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)
const text = (v: unknown, max: number) =>
  String(typeof v === 'string' ? v : '')
    .replace(/[<>&"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

/** An empty map of this kind and size: walls nowhere, floor underground is rock. */
export function emptyMap(kind: MapKind, cols = 24, rows = 18, title = ''): MapDoc {
  return { v: 1, kind, title, cols, rows, ground: Array.from({ length: rows }, () => ' '.repeat(cols)), items: [], labels: [] }
}

/** The ground character at a cell (outside the map: nothing). */
export const groundAt = (doc: Pick<MapDoc, 'ground' | 'cols' | 'rows'>, x: number, y: number): string =>
  x < 0 || y < 0 || x >= doc.cols || y >= doc.rows ? ' ' : (doc.ground[y]?.[x] ?? ' ')

/** Size of an item's footprint in cells, rotation and scale applied. */
export function footprint(item: Pick<MapItem, 't' | 'r' | 's'>): [number, number] {
  const st = STAMPS[item.t]
  const s = item.s ?? 1
  const [w, h] = st ? st.size : [1, 1]
  return (item.r ?? 0) % 2 ? [h * s, w * s] : [w * s, h * s]
}

/**
 * Reads a map from anything (a model's answer, a saved draft, a file): keeps what makes sense, fixes
 * sizes, drops what it can't use, and says what it changed. Never throws.
 */
export function parseMapDoc(input: unknown): { doc: MapDoc; problems: string[] } {
  const problems: string[] = []
  const src = isObj(input) ? input : {}
  if (!isObj(input)) problems.push('not an object: empty map')
  const kind: MapKind = MAP_KINDS.includes(src.kind as MapKind) ? (src.kind as MapKind) : 'building'
  if (src.kind !== undefined && kind !== src.kind) problems.push(`unknown kind "${String(src.kind)}": building`)

  const rawGround = Array.isArray(src.ground) ? src.ground.map((r) => (typeof r === 'string' ? r : '')) : []
  const widest = rawGround.reduce((m, r) => Math.max(m, r.length), 0)
  const cols = clamp(Math.round(num(src.cols) ?? (widest || 24)), MAP_LIMITS.minCols, MAP_LIMITS.maxCols)
  const rows = clamp(Math.round(num(src.rows) ?? (rawGround.length || 18)), MAP_LIMITS.minRows, MAP_LIMITS.maxRows)
  if (rawGround.length > rows || widest > cols) problems.push(`ground larger than ${cols}×${rows}: cut`)

  let unknown = 0
  const ground = Array.from({ length: rows }, (_, y) => {
    const row = rawGround[y] ?? ''
    let out = ''
    for (let x = 0; x < cols; x++) {
      const c = row[x] ?? ' '
      if ((GROUND as readonly string[]).includes(c)) out += c
      else {
        unknown++
        out += c === '\t' ? ' ' : '.'
      }
    }
    return out
  })
  if (unknown) problems.push(`${unknown} unknown ground character(s): floor`)

  const items: MapItem[] = []
  let dropped = 0
  for (const it of Array.isArray(src.items) ? src.items : []) {
    if (items.length >= MAP_LIMITS.items) {
      dropped++
      continue
    }
    if (!isObj(it) || typeof it.t !== 'string' || !(it.t in STAMPS)) {
      dropped++
      continue
    }
    const x = num(it.x)
    const y = num(it.y)
    if (x === null || y === null) {
      dropped++
      continue
    }
    const r = num(it.r)
    const s = num(it.s)
    const item: MapItem = { t: it.t as StampId, x: 0, y: 0 }
    if (r !== null && Math.round(r) % 4) item.r = (((Math.round(r) % 4) + 4) % 4) as 1 | 2 | 3
    if (s !== null && s !== 1) item.s = clamp(half(s), 0.5, MAP_LIMITS.maxScale)
    if (it.secret === true) item.secret = true
    const [w, h] = footprint(item)
    item.x = clamp(half(x), 0, Math.max(0, cols - w))
    item.y = clamp(half(y), 0, Math.max(0, rows - h))
    items.push(item)
  }
  if (dropped) problems.push(`${dropped} item(s) dropped (unknown stamp, no position or too many)`)

  const labels: MapLabel[] = []
  for (const l of Array.isArray(src.labels) ? src.labels : []) {
    if (labels.length >= MAP_LIMITS.labels || !isObj(l)) continue
    const t = text(l.text, MAP_LIMITS.label)
    const x = num(l.x)
    const y = num(l.y)
    if (!t || x === null || y === null) continue
    labels.push({ text: t, x: clamp(half(x), 0, cols), y: clamp(half(y), 0, rows), ...(l.secret === true ? { secret: true } : {}) })
  }

  const doc: MapDoc = { v: 1, kind, title: text(src.title, MAP_LIMITS.title), cols, rows, ground, items, labels }
  if (Array.isArray(src.secret) && src.secret.some((r) => typeof r === 'string' && r.includes('x'))) {
    doc.secret = Array.from({ length: rows }, (_, y) => {
      const row = typeof src.secret === 'object' && Array.isArray(src.secret) && typeof src.secret[y] === 'string' ? (src.secret[y] as string) : ''
      let out = ''
      for (let x = 0; x < cols; x++) out += row[x] === 'x' ? 'x' : '.'
      return out
    })
  }
  return { doc, problems }
}

/** Whether a cell is hidden from the players. */
export const isSecretCell = (doc: MapDoc, x: number, y: number) => doc.secret?.[y]?.[x] === 'x'

/**
 * The players' copy: secret cells become what surrounds a building (nothing) or rock, secret doors
 * become walls, secret items and labels go, and items standing on secret cells go too.
 */
export function playersMap(doc: MapDoc): MapDoc {
  const hidden = (x: number, y: number) => isSecretCell(doc, x, y)
  const ground = doc.ground.map((row, y) =>
    [...row].map((c, x) => (hidden(x, y) ? ' ' : c === 's' ? '#' : c)).join(''),
  )
  const coversSecret = (it: MapItem) => {
    const [w, h] = footprint(it)
    return hidden(Math.floor(it.x + w / 2), Math.floor(it.y + h / 2))
  }
  return {
    v: 1,
    kind: doc.kind,
    title: doc.title,
    cols: doc.cols,
    rows: doc.rows,
    ground,
    items: doc.items.filter((it) => !it.secret && !coversSecret(it)),
    labels: doc.labels.filter((l) => !l.secret && !hidden(Math.floor(l.x), Math.floor(l.y))),
  }
}

/** Cells you can walk on. */
const open = (c: string, kind: MapKind) => c !== '#' && c !== 'w' && c !== '~' && (kind !== 'underground' || c !== ' ')

/**
 * What looks wrong on a map (warnings, the map still draws): doors and windows that aren't in a wall,
 * and, for a building or underground, walkable areas you can't reach from the largest one.
 */
export function mapProblems(doc: MapDoc): string[] {
  const out: string[] = []
  const at = (x: number, y: number) => groundAt(doc, x, y)
  let badOpenings = 0
  for (let y = 0; y < doc.rows; y++) {
    for (let x = 0; x < doc.cols; x++) {
      const c = at(x, y)
      if (c !== 'd' && c !== 's' && c !== 'w') continue
      const across = WALLISH.has(at(x - 1, y)) && WALLISH.has(at(x + 1, y))
      const down = WALLISH.has(at(x, y - 1)) && WALLISH.has(at(x, y + 1))
      if (doc.kind !== 'underground' && !across && !down) badOpenings++
    }
  }
  if (badOpenings) out.push(`${badOpenings} door(s) or window(s) not between two wall cells`)

  if (doc.kind !== 'outdoor') {
    // Flood fill the walkable cells inside the map (a building's outside counts as walkable: it is
    // how you reach the doors).
    const seen = new Uint8Array(doc.cols * doc.rows)
    const regions: number[] = []
    for (let y0 = 0; y0 < doc.rows; y0++) {
      for (let x0 = 0; x0 < doc.cols; x0++) {
        if (seen[y0 * doc.cols + x0] || !open(at(x0, y0), doc.kind)) continue
        let size = 0
        const stack = [[x0, y0]]
        seen[y0 * doc.cols + x0] = 1
        while (stack.length) {
          const [x, y] = stack.pop()!
          size++
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= doc.cols || ny >= doc.rows || seen[ny * doc.cols + nx] || !open(at(nx, ny), doc.kind)) continue
            seen[ny * doc.cols + nx] = 1
            stack.push([nx, ny])
          }
        }
        regions.push(size)
      }
    }
    const cut = regions.filter((n) => n >= 2).length - 1
    if (cut > 0) out.push(`${cut} area(s) can't be reached from the main one (add a door or a passage)`)
  }
  return out
}
