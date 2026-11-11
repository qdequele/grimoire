// What Claude is told to compose a map from a description (create-story, actions "map" and
// "scene-map"), and the structured output it answers. The map kit (./maps/, copied from
// src/maps/kit by `pnpm maps:bundle`) checks and draws the answer.
import { CELL_METRES, MAP_KINDS, MAP_LIMITS, type MapKind } from './maps/model.ts'
import { STAMP_LIST } from './maps/stamps.ts'

export const MAP_DESCRIPTION_MAX = 1500

/** Grid sizes Claude should stay within, by kind. */
export const MAP_SIZES: Record<MapKind, { cols: [number, number]; rows: [number, number] }> = {
  building: { cols: [14, 36], rows: [10, 26] },
  underground: { cols: [18, 40], rows: [12, 30] },
  outdoor: { cols: [24, 48], rows: [16, 36] },
}

const catalogue = () =>
  STAMP_LIST.map((s) => `- ${s.id} (${s.size[0]}×${s.size[1]}; ${s.kinds.join(', ')}): ${s.label.en}`).join('\n')

export function mapSystemPrompt(): string {
  return `You draw maps for a tabletop investigation and horror roleplaying game set mostly in the 1920s. The keeper describes a place; you answer with that place as a map on a grid, as JSON. Grimoire draws it as an ink-on-paper plan: a keeper's copy with the secrets in red, and a players' copy without them.

# The grid

- cols × rows cells. "ground" is exactly rows strings of exactly cols characters, one character per cell, row 0 at the top (north).
- Ground characters:
  "#" wall (a building's walls, a garden wall) or solid rock underground
  "." floor: inside a building, a cave, a courtyard
  " " nothing: outside a building (open ground); underground, solid rock
  "d" door, "s" secret door, "w" window: in a wall line (between two "#" on the same row or the same column)
  "~" water, "\\"" grass, "=" road (cobbles), ":" dirt path, "+" paving (a square, a quay, a terrace)
- Scale: one cell is ${CELL_METRES.building} m in a building, ${CELL_METRES.underground} m underground, ${CELL_METRES.outdoor} m outdoors.
- Sizes: building ${MAP_SIZES.building.cols.join('–')} cols × ${MAP_SIZES.building.rows.join('–')} rows; underground ${MAP_SIZES.underground.cols.join('–')} × ${MAP_SIZES.underground.rows.join('–')}; outdoor ${MAP_SIZES.outdoor.cols.join('–')} × ${MAP_SIZES.outdoor.rows.join('–')}. Never more than ${MAP_LIMITS.maxCols} × ${MAP_LIMITS.maxRows}.

# Kinds of map ("kind": ${MAP_KINDS.map((k) => `"${k}"`).join(', ')})

- building: one floor of a house, an asylum, a church, a police station… Rooms are rectangles of "." enclosed by walls one cell thick; neighbouring rooms share a wall. Every room can be reached through doors: a door is a "d" in a wall with floor on both sides. The front door opens on the outside. Windows "w" on outside walls. Keep one or two cells around the building for the garden, a path or the street. Other floors are other maps: mark the stairs with stamps.
- underground: crypts, cellars, caves, tunnels, mines. Fill the grid with " " (rock) and carve chambers and passages of "." (passages 1 or 2 cells wide). Caves can be irregular. A door in a passage is a "d" with floor on both sides. Underground water "~" for pools and streams.
- outdoor: a village, a farm, a stretch of coast, a park. Fill with grass, then roads ("=", 2 cells wide), paths (":"), rivers or the sea ("~", 2 to 4 cells wide), squares ("+"). Buildings are stamps (house, long-house, barn, church, tower) on the grass beside the roads; walls "#" for garden or cemetery walls.

# Stamps ("items")

Objects drawn on the map. id, size in cells (width × height, unrotated), kinds where it fits best, name:
${catalogue()}

- x, y: the top-left cell of the stamp's footprint (after rotation). Whole or half numbers.
- r: quarter turns clockwise, 0 to 3. Unrotated, a stamp's top edge is its back: a bed's head, a bookcase or a fireplace against the wall above it. Against the right wall r = 1, the bottom wall r = 2, the left wall r = 3. With r = 1 or 3 the footprint's width and height swap.
- s: size, 1 normally (0.5 to ${MAP_LIMITS.maxScale}; a big tree 1.5, a huge one 2).
- On floor or ground cells only, never on walls, not on top of each other, never in the cell in front of a door. Furnish each room for what it is (beds in bedrooms, a stove and a counter in the kitchen, shelves in a library, coffins in a crypt), 2 to 8 stamps per room, leaving space to walk.
- At most ${MAP_LIMITS.items} stamps.

# Labels

- Short names (at most ${MAP_LIMITS.label} characters) in the requested language: rooms, chambers, streets, places. x, y is the centre of the text in cells (half numbers allowed: a room from x = 2 to x = 9 has its centre at 6). Put it inside its room, on a free row (not on a stamp). One label per room or place; at most ${MAP_LIMITS.labels}.

# Secrets

- The map is the keeper's: it holds everything, secrets included. Mark only what the investigators don't know at first: a secret door "s"; stamps and labels with "secret": true; hidden rooms or passages as "x" in "secret" (rows of cols characters, "x" = hidden, "." = known; leave "secret" an empty list when nothing is hidden).
- The players' copy turns secret doors into walls and leaves the rest out, so the known part must still make sense without them.

# Answer

- "title": the place's name, short, in the requested language.
- Check before answering: every row has exactly cols characters; walls are closed; every door and window sits in a wall; every room can be reached; stamps are inside the grid, on floor, not overlapping.
- Draw an original place. Never use names from published games or fiction.

# Example (a small building, 14 × 10)

{"kind":"building","title":"The Gardener's Cottage","cols":14,"rows":10,"ground":["##############","#....#.......#","#....d.......w","#....#.......#","##d###.......#","#....#.......#","w....#########","#....s....#   ","#####d#####   ","     :        "],"items":[{"t":"bed","x":1,"y":1,"r":0,"s":1,"secret":false},{"t":"wardrobe","x":3,"y":1,"r":0,"s":1,"secret":false},{"t":"fireplace","x":8,"y":1,"r":0,"s":1,"secret":false},{"t":"table","x":8,"y":3,"r":0,"s":1,"secret":false},{"t":"chair","x":8,"y":4,"r":2,"s":1,"secret":false},{"t":"stove","x":1,"y":5,"r":3,"s":1,"secret":false},{"t":"chest","x":9,"y":7,"r":0,"s":1,"secret":true}],"labels":[{"text":"Bedroom","x":2.5,"y":3.5,"secret":false},{"text":"Parlour","x":9.5,"y":5.5,"secret":false},{"text":"Kitchen","x":3,"y":6.5,"secret":false},{"text":"Hidden store","x":7.5,"y":7.5,"secret":true}],"secret":["","","","","","","","......xxxx    ","",""]}`
}

export interface MapRequest {
  description: string
  /** Leave the choice to Claude when absent. */
  kind?: MapKind
  lang: 'fr' | 'en'
  /** What the story says about the place (a scene's text), for maps the story creator draws. */
  context?: string
}

export function mapUserPrompt(req: MapRequest): string {
  const language = req.lang === 'fr' ? 'French' : 'English'
  return [
    req.kind ? `Kind of map: ${req.kind}.` : 'Kind of map: choose building, underground or outdoor from the description.',
    `Language of the title and the labels: ${language}.`,
    req.context ? `\nWhat the story says about this place (keep to it, and keep its secrets secret on the map):\n<story>\n${req.context}\n</story>` : '',
    `\nThe keeper's description of the place:\n<description>\n${req.description}\n</description>`,
    '\nAnswer with the map.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** The structured output: a MapDoc with every field required (the kit coerces and checks it). */
export function mapSchema(): Record<string, unknown> {
  const obj = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties })
  return obj({
    kind: { type: 'string', enum: [...MAP_KINDS] },
    title: { type: 'string' },
    cols: { type: 'integer' },
    rows: { type: 'integer' },
    ground: { type: 'array', items: { type: 'string' } },
    items: { type: 'array', items: obj({ t: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, r: { type: 'integer' }, s: { type: 'number' }, secret: { type: 'boolean' } }) },
    labels: { type: 'array', items: obj({ text: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, secret: { type: 'boolean' } }) },
    secret: { type: 'array', items: { type: 'string' } },
  })
}

/** The keeper's request, checked: a description is required, the kind optional. */
export function parseMapRequest(body: Record<string, unknown>): MapRequest | string {
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (description.length < 10) return 'Décris le lieu en une phrase au moins.'
  if (description.length > MAP_DESCRIPTION_MAX) return `Description trop longue (${MAP_DESCRIPTION_MAX} caractères au plus).`
  const kind = body.kind === undefined || body.kind === '' || body.kind === null ? undefined : (body.kind as MapKind)
  if (kind !== undefined && !MAP_KINDS.includes(kind)) return `kind must be one of ${MAP_KINDS.join(', ')}.`
  const lang = body.lang === 'en' ? 'en' : 'fr'
  return { description, kind, lang }
}
