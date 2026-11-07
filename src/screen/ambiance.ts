// Ambiance screen, pure part: presets (what living layers a scene gets) and scene → ambiance.
// No DOM, no Supabase: shared by the keeper's game screen (which decides) and the screen (which draws).

export const PRESETS = [
  'fog', 'rain', 'candle', 'hearth', 'night', 'storm', 'dust',
  'snow', 'abyss', 'ritual', 'nightmare', 'bulb', 'blaze',
] as const
export type PresetId = (typeof PRESETS)[number]

export const isPreset = (v: unknown): v is PresetId => typeof v === 'string' && (PRESETS as readonly string[]).includes(v)

/** French label of each preset (shown through t(), English in en.ts). */
export const PRESET_LABEL: Record<PresetId, string> = {
  fog: 'Brouillard',
  rain: 'Pluie',
  candle: 'Chandelle',
  hearth: 'Âtre',
  night: 'Nuit',
  storm: 'Orage',
  dust: 'Poussière',
  snow: 'Neige',
  abyss: 'Abysses',
  ritual: 'Rituel',
  nightmare: 'Cauchemar',
  bulb: 'Ampoule',
  blaze: 'Incendie',
}

// ------------------------------------------------------------------ time of day

/**
 * Time of day, apart from the preset: the preset is the weather and the mood, the time the light.
 * A church in the rain by day, a street in the snow at night. 'night' keeps the presets' own palettes.
 */
export const TIMES = ['day', 'dusk', 'night'] as const
export type TimeOfDay = (typeof TIMES)[number]

export const isTime = (v: unknown): v is TimeOfDay => typeof v === 'string' && (TIMES as readonly string[]).includes(v)

/** French label of each time (shown through t(), English in en.ts). */
export const TIME_LABEL: Record<TimeOfDay, string> = { day: 'Jour', dusk: 'Crépuscule', night: 'Nuit' }

/** A pale daylight sky, blended into presets that have no day palette of their own. */
const DAY_SKY: [string, string, string] = ['#56697a', '#93a6b5', '#d9e0e4']
/** Dusk: violet above, a warm glow at the horizon. */
const DUSK_SKY: [string, string, string] = ['#1c1830', '#553a52', '#d58a5c']

const hex = (c: string): number[] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
/** `a` blended towards `b` by t (0 to 1), as #rrggbb. */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a)
  const y = hex(b)
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

/** The three colours a preset is drawn with at a time of day. */
export function paletteFor(preset: PresetId, time: TimeOfDay): [string, string, string] {
  const look = LOOKS[preset]
  const p = look.palette
  if (time === 'night') return p
  if (time === 'dusk') return [mix(p[0], DUSK_SKY[0], 0.55), mix(p[1], DUSK_SKY[1], 0.55), mix(p[2], DUSK_SKY[2], 0.55)]
  return look.day ?? [mix(p[0], DAY_SKY[0], 0.75), mix(p[1], DAY_SKY[1], 0.75), mix(p[2], DAY_SKY[2], 0.75)]
}

/** Words in a scene's title (or id) → time of day, French and English, accents ignored. */
const TIME_WORDS: Array<[TimeOfDay, string[]]> = [
  ['dusk', ['aube', 'crepuscule', 'soir', 'soiree', 'couchant', 'aurore', 'dawn', 'dusk', 'evening', 'sunset', 'sunrise', 'twilight', 'nightfall', 'daybreak']],
  ['night', ['nuit', 'minuit', 'nocturne', 'night', 'midnight', 'nocturnal']],
  ['day', ['jour', 'matin', 'matinee', 'midi', 'apres-midi', 'journee', 'day', 'morning', 'noon', 'afternoon', 'daylight']],
]

/** Library ambience ids that tell the time. */
const TIME_SOUNDS: Array<[TimeOfDay, string[]]> = [
  ['night', ['night-crickets', 'village-night']],
  ['day', ['nature-day', 'village-day', 'street']],
]

/** The time a scene's title or id names, or null. */
export function timeFromText(...texts: Array<string | undefined>): TimeOfDay | null {
  const found = words(texts.filter(Boolean).join(' '))
  return TIME_WORDS.find(([, ws]) => ws.some((w) => found.has(w)))?.[0] ?? null
}

/** The time a scene's ambience sounds tell, or null. */
export function timeFromSounds(sounds: readonly string[] | undefined): TimeOfDay | null {
  const set = new Set(sounds ?? [])
  return TIME_SOUNDS.find(([, ids]) => ids.some((id) => set.has(id)))?.[0] ?? null
}

/**
 * A light effect over the scene, drawn in CSS (screen.css):
 * - `shafts`: light falling from above in slow swaying beams (under water, under the moon);
 * - `aura`: a sickly glow breathing at the centre, faint rays turning slowly around it;
 * - `heartbeat`: the screen's edges throb, double beat, in blood red;
 * - `bulb`: a failing electric bulb, mostly on, then off for a heartbeat;
 * - `blaze`: a fire's red glow from below, strong and restless.
 */
export type PresetEffect = 'shafts' | 'aura' | 'heartbeat' | 'bulb' | 'blaze'

/** How a preset looks. Every layer is cheap: transforms and opacity, one small canvas at most. */
export interface PresetLook {
  /** Generated background when the scene has no picture: three colours, dark to light. */
  palette: [string, string, string]
  /** Drifting fog layers, 0 (none) to 1 (thick). */
  fog: number
  /** Film grain opacity. */
  grain: number
  /** Vignette darkness, 0 to 1. */
  vignette: number
  /** Warm light that flickers (candle, lamp). */
  flicker: boolean
  /** Particles on the canvas. */
  particles: 'rain' | 'dust' | 'embers' | 'snow' | 'bubbles' | 'spores' | null
  /** How many particles, 1 = the kind's usual amount. */
  density: number
  /** Fog colour, as `r, g, b` (pale mist, dark smoke, green murk…). */
  fogColor: string
  /** One light effect over the scene, or none. */
  effect: PresetEffect | null
  /** Lightning flashes now and then. */
  lightning: boolean
  /** One pan-and-zoom pass, in seconds (alternates back and forth). */
  drift: number
  /** A live fire (flames, embers, its flickering light) at the scene's fire place. */
  fire: boolean
  /** Time of day when the scene doesn't say (see TIMES). */
  time: TimeOfDay
  /** Grey sky: no moon or sun shows (rain, storm, snow). */
  overcast: boolean
  /** The palette by day, when the preset has its own; else DAY_SKY blended in (paletteFor). */
  day?: [string, string, string]
}

const MIST = '205, 214, 218'

export const LOOKS: Record<PresetId, PresetLook> = {
  fog: { palette: ['#0b1114', '#22323a', '#5f7479'], fog: 0.85, fogColor: MIST, grain: 0.07, vignette: 0.6, flicker: false, particles: null, density: 1, lightning: false, drift: 110, fire: false, effect: null, time: 'night', overcast: false, day: ['#6f7d82', '#a4b0b3', '#dde3e3'] },
  rain: { palette: ['#060b12', '#13263a', '#3d5a74'], fog: 0.35, fogColor: MIST, grain: 0.06, vignette: 0.65, flicker: false, particles: 'rain', density: 1, lightning: false, drift: 95, fire: false, effect: null, time: 'night', overcast: true, day: ['#3f4a54', '#6c7883', '#a7b1b8'] },
  candle: { palette: ['#0b0604', '#3b1d0b', '#a8621f'], fog: 0.15, fogColor: MIST, grain: 0.08, vignette: 0.8, flicker: true, particles: 'embers', density: 1, lightning: false, drift: 120, fire: false, effect: null, time: 'night', overcast: false },
  hearth: { palette: ['#070302', '#2a0f05', '#8a3a10'], fog: 0.08, fogColor: MIST, grain: 0.08, vignette: 0.8, flicker: false, particles: null, density: 1, lightning: false, drift: 120, fire: true, effect: null, time: 'night', overcast: false },
  night: { palette: ['#04050b', '#111933', '#34457a'], fog: 0.3, fogColor: MIST, grain: 0.06, vignette: 0.75, flicker: false, particles: 'dust', density: 1, lightning: false, drift: 120, fire: false, effect: null, time: 'night', overcast: false },
  storm: { palette: ['#05060a', '#1a1d2a', '#4b5068'], fog: 0.45, fogColor: MIST, grain: 0.07, vignette: 0.7, flicker: false, particles: 'rain', density: 1.5, lightning: true, drift: 80, fire: false, effect: null, time: 'night', overcast: true, day: ['#262c36', '#4a525f', '#7d8693'] },
  dust: { palette: ['#0d0a06', '#3a2e1e', '#a08658'], fog: 0.2, fogColor: MIST, grain: 0.1, vignette: 0.55, flicker: false, particles: 'dust', density: 1, lightning: false, drift: 100, fire: false, effect: null, time: 'day', overcast: false, day: ['#4f7aa1', '#94b4cd', '#efe0bf'] },
  // Falling snow in a cold blue night, a pale mist low on the ground.
  snow: { palette: ['#070a10', '#1c2736', '#7d8fa6'], fog: 0.45, fogColor: '225, 232, 242', grain: 0.05, vignette: 0.6, flicker: false, particles: 'snow', density: 1, lightning: false, drift: 130, fire: false, effect: null, time: 'night', overcast: true, day: ['#5f6b78', '#929eaa', '#d3dbe2'] },
  // Deep water: green-blue murk, light from the surface, bubbles rising.
  abyss: { palette: ['#010608', '#062a2e', '#2f7a78'], fog: 0.5, fogColor: '60, 120, 115', grain: 0.07, vignette: 0.85, flicker: false, particles: 'bubbles', density: 1, lightning: false, drift: 140, fire: false, effect: 'shafts', time: 'night', overcast: false, day: ['#0b4148', '#24807f', '#86c8bd'] },
  // Something answers the chant: a sickly glow breathes, spores drift around it.
  ritual: { palette: ['#040603', '#14200e', '#5e7d2c'], fog: 0.35, fogColor: '120, 160, 90', grain: 0.09, vignette: 0.85, flicker: false, particles: 'spores', density: 1, lightning: false, drift: 150, fire: false, effect: 'aura', time: 'night', overcast: false },
  // Dread: dark reds, heavy grain, the edges of the screen throb like a heartbeat.
  nightmare: { palette: ['#050102', '#250509', '#6b1a1f'], fog: 0.3, fogColor: '120, 70, 75', grain: 0.14, vignette: 0.9, flicker: false, particles: 'dust', density: 0.6, lightning: false, drift: 70, fire: false, effect: 'heartbeat', time: 'night', overcast: false },
  // An asylum corridor, a hospital, a basement: a bare bulb that keeps failing.
  bulb: { palette: ['#07080a', '#22262a', '#8a8f7a'], fog: 0.12, fogColor: MIST, grain: 0.11, vignette: 0.75, flicker: false, particles: 'dust', density: 0.8, lightning: false, drift: 110, fire: false, effect: 'bulb', time: 'night', overcast: false },
  // A house on fire: red glow from below, dark smoke rolling, a storm of embers.
  blaze: { palette: ['#080201', '#3a0c03', '#b0400e'], fog: 0.55, fogColor: '45, 32, 28', grain: 0.08, vignette: 0.7, flicker: false, particles: 'embers', density: 4, lightning: false, drift: 60, fire: false, effect: 'blaze', time: 'night', overcast: false },
}

/**
 * Library sound ids (spec/sounds.json) → preset, most dramatic first: a storm beats rain, rain beats a
 * fireplace, and so on. The first rule that matches any of the scene's sounds wins.
 */
const SOUND_RULES: Array<[PresetId, string[]]> = [
  ['storm', ['storm']],
  ['rain', ['rain', 'rain-heavy', 'rain-window']],
  ['hearth', ['fireplace']],
  ['candle', ['clock', 'crowd-indoor']],
  ['night', ['wind-howling', 'night-crickets', 'village-night']],
  ['fog', ['wind', 'crows']],
  ['dust', ['nature-day', 'village-day', 'street']],
]

/** The preset a scene's ambience sounds suggest, or null when they say nothing. */
function soundsPreset(sounds: readonly string[] | undefined): PresetId | null {
  const set = new Set(sounds ?? [])
  return SOUND_RULES.find(([, ids]) => ids.some((id) => set.has(id)))?.[0] ?? null
}

/** The preset a scene's ambience sounds suggest; fog when they say nothing. */
export const presetFromSounds = (sounds: readonly string[] | undefined): PresetId => soundsPreset(sounds) ?? 'fog'

// ------------------------------------------------------------------ places (drawn décors)

/**
 * Drawn décors (Places.tsx): silhouettes of a place, shown when the scene has no picture.
 * They go with any preset: the preset is the weather and the light, the place is what stands there.
 */
export const PLACES = [
  'church', 'graveyard', 'crypt', 'castle', 'manor', 'library', 'police', 'forest', 'harbour', 'street',
  'asylum', 'station', 'swamp', 'dig', 'mountain', 'museum', 'cavern', 'farm', 'ship', 'fair', 'mine', 'moor',
] as const
export type PlaceId = (typeof PLACES)[number]

export const isPlace = (v: unknown): v is PlaceId => typeof v === 'string' && (PLACES as readonly string[]).includes(v)

/** French label of each place (shown through t(), English in en.ts). */
export const PLACE_LABEL: Record<PlaceId, string> = {
  church: 'Église',
  graveyard: 'Cimetière',
  crypt: 'Crypte',
  castle: 'Château',
  manor: 'Manoir',
  library: 'Bibliothèque',
  police: 'Commissariat',
  forest: 'Forêt',
  harbour: 'Port',
  street: 'Rue',
  asylum: 'Asile',
  station: 'Gare',
  swamp: 'Marais',
  dig: 'Fouilles',
  mountain: 'Montagne',
  museum: 'Musée',
  cavern: 'Grotte',
  farm: 'Ferme',
  ship: 'Navire',
  fair: 'Fête foraine',
  mine: 'Mine',
  moor: 'Lande',
}

/** The preset a place gets when neither the scene nor its sounds name one. */
export const PLACE_PRESET: Record<PlaceId, PresetId> = {
  church: 'night',
  graveyard: 'fog',
  crypt: 'candle',
  castle: 'night',
  manor: 'night',
  library: 'candle',
  police: 'rain',
  forest: 'fog',
  harbour: 'fog',
  street: 'rain',
  asylum: 'storm',
  station: 'rain',
  swamp: 'fog',
  dig: 'dust',
  mountain: 'snow',
  museum: 'candle',
  cavern: 'candle',
  farm: 'night',
  ship: 'storm',
  fair: 'night',
  mine: 'night',
  moor: 'fog',
}

/**
 * Words in a scene's title (or id) → place, French and English, accents ignored. Most specific first:
 * "La crypte de l'église" is a crypt, "La bibliothèque du manoir" a library.
 */
const PLACE_WORDS: Array<[PlaceId, string[]]> = [
  ['fair', ['foraine', 'foire', 'cirque', 'manege', 'carnaval', 'fair', 'fairground', 'funfair', 'carnival', 'circus']],
  ['station', ['gare', 'train', 'wagon', 'locomotive', 'station', 'railway', 'platform', 'depot']],
  ['ship', ['navire', 'bateau', 'paquebot', 'cargo', 'goelette', 'ship', 'boat', 'steamer', 'liner', 'deck', 'schooner', 'freighter']],
  ['museum', ['musee', 'exposition', 'museum', 'exhibit', 'exhibition']],
  ['asylum', ['asile', 'sanatorium', 'hopital', 'clinique', 'hospice', 'asylum', 'hospital', 'clinic', 'infirmary', 'madhouse']],
  ['mine', ['mine', 'mines', 'puits', 'houillere', 'charbonnage', 'mineshaft', 'colliery', 'pit']],
  ['cavern', ['grotte', 'grottes', 'caverne', 'cavernes', 'gouffre', 'grotto', 'cavern', 'caverns', 'sinkhole']],
  ['crypt', ['crypte', 'caveau', 'catacombe', 'catacombes', 'souterrain', 'souterrains', 'cave', 'crypt', 'vault', 'catacomb', 'catacombs', 'cellar', 'tunnel', 'tunnels']],
  ['library', ['bibliotheque', 'archives', 'librairie', 'library', 'archive', 'study', 'bookshop']],
  ['police', ['commissariat', 'police', 'gendarmerie', 'prison', 'cellule', 'jail', 'precinct', 'sheriff']],
  ['graveyard', ['cimetiere', 'tombe', 'tombeau', 'mausolee', 'graveyard', 'cemetery', 'churchyard', 'graves', 'tomb', 'mausoleum']],
  ['church', ['eglise', 'chapelle', 'cathedrale', 'abbaye', 'presbytere', 'church', 'chapel', 'cathedral', 'abbey', 'parish', 'rectory']],
  ['castle', ['chateau', 'forteresse', 'donjon', 'castle', 'fortress']],
  ['harbour', ['port', 'quai', 'quais', 'docks', 'phare', 'jetee', 'harbour', 'harbor', 'dock', 'pier', 'wharf', 'quay', 'lighthouse']],
  ['dig', ['fouilles', 'fouille', 'desert', 'dunes', 'oasis', 'excavation', 'dig']],
  ['mountain', ['montagne', 'montagnes', 'sommet', 'refuge', 'chalet', 'glacier', 'mountain', 'mountains', 'peak', 'summit']],
  ['swamp', ['marais', 'marecage', 'marecages', 'bayou', 'tourbiere', 'swamp', 'marsh', 'bog', 'fen']],
  ['farm', ['ferme', 'grange', 'champ', 'champs', 'mais', 'moulin', 'farm', 'barn', 'field', 'fields', 'cornfield', 'windmill', 'farmhouse']],
  ['moor', ['lande', 'landes', 'menhir', 'menhirs', 'dolmen', 'cromlech', 'moor', 'moors', 'heath', 'megalith', 'megaliths']],
  ['forest', ['foret', 'bois', 'sous-bois', 'clairiere', 'forest', 'woods', 'wood', 'clearing', 'grove']],
  ['manor', ['manoir', 'demeure', 'villa', 'manor', 'mansion', 'estate']],
  ['street', ['rue', 'ruelle', 'avenue', 'boulevard', 'quartier', 'faubourg', 'street', 'alley', 'lane', 'downtown']],
]

const words = (text: string): Set<string> =>
  new Set(text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z-]+/).flatMap((w) => [w, ...w.split('-')]))

/** The place a scene's title (or id) names, or null. */
export function placeFromText(...texts: Array<string | undefined>): PlaceId | null {
  const found = words(texts.filter(Boolean).join(' '))
  return PLACE_WORDS.find(([, ws]) => ws.some((w) => found.has(w)))?.[0] ?? null
}

/** Library ambience id → file in public/sons (the engine's recordings). */
export const AMBIENCE_FILE: Record<string, string> = {
  rain: 'amb-pluie',
  'rain-heavy': 'amb-pluie-forte',
  'rain-window': 'amb-pluie-vitre',
  storm: 'amb-orage',
  fireplace: 'amb-cheminee',
  clock: 'amb-horloge',
  wind: 'amb-vent',
  'wind-howling': 'amb-vent-hurlant',
  crows: 'amb-corbeaux',
  'nature-day': 'amb-nature',
  'night-crickets': 'amb-nuit',
  'village-night': 'amb-village-nuit',
  'village-day': 'amb-village-jour',
  street: 'amb-rue',
  'crowd-indoor': 'amb-foule',
}

/** URLs of the sounds the screen can play (unknown ids, e.g. a story's own sounds, are skipped). */
export const soundUrls = (ids: readonly string[]): string[] =>
  ids.filter((id) => AMBIENCE_FILE[id]).map((id) => `/sons/${AMBIENCE_FILE[id]}.mp3`)

// ------------------------------------------------------------------ fire place (hearth preset)

/** Where the fire burns in the picture: base centre and width, as fractions of the picture (0 to 1). */
export interface FirePlace {
  x: number
  y: number
  width: number
}

/** Bottom centre: a hearth seen from the room, or the generated background's glow. */
export const DEFAULT_FIRE: FirePlace = { x: 0.5, y: 0.9, width: 0.34 }

const fraction = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1

/** A valid fire place, or null (missing or out-of-range numbers). */
export function asFire(v: unknown): FirePlace | null {
  if (!v || typeof v !== 'object') return null
  const { x, y, width } = v as Record<string, unknown>
  return fraction(x) && fraction(y) && fraction(width) && width > 0 ? { x, y, width } : null
}

// ------------------------------------------------------------------ scene → ambiance

/** Loose view of a story scene: only what the screen needs (spec/story.schema.json). */
export interface StoryScene {
  id: string
  title?: string
  ambience?: string[]
  handouts?: string[]
  images?: Array<{ src: string; caption?: string; keeperOnly?: boolean }>
  screen?: { image?: string; preset?: string; place?: string; time?: string; fire?: unknown }
}
export interface StoryForScreen {
  acts: Array<{ scenes: StoryScene[] }>
  handouts?: Array<{ id: string; title: string; text?: string; image?: string; scene?: string }>
}

/** What the screen shows for a scene. `image` is a path inside the story pack (images/…). */
export interface SceneAmbiance {
  preset: PresetId
  image: string | null
  sounds: string[]
  /** Where the fire is in the picture (hearth preset); null: DEFAULT_FIRE. */
  fire: FirePlace | null
  /** Drawn décor, shown when there is no picture; null: none. */
  place: PlaceId | null
  /** Time of day; null: the preset's own (LOOKS[preset].time). */
  time: TimeOfDay | null
}

export const findScene = (story: StoryForScreen, sceneId: string | undefined): StoryScene | undefined =>
  sceneId ? story.acts.flatMap((a) => a.scenes).find((s) => s.id === sceneId) : undefined

/**
 * A scene's ambiance: its `screen` field first, then what its sounds, images and title say
 * (a title naming a place gives its décor, and that place's preset when the sounds name none; the time of day
 * comes from words in the title, else from day or night sounds).
 * Only pictures the pack really has are used (`packFiles`), so a missing file never shows a broken image;
 * scene images are used only when marked `keeperOnly: false` (the spec's default keeps them from players).
 */
export function sceneAmbiance(story: StoryForScreen, sceneId: string | undefined, packFiles: readonly string[]): SceneAmbiance {
  const scene = findScene(story, sceneId)
  const files = new Set(packFiles)
  const has = (p: string | undefined): p is string => !!p && files.has(p)
  const place = isPlace(scene?.screen?.place) ? scene.screen.place : scene ? placeFromText(scene.title, scene.id) : null
  const preset = isPreset(scene?.screen?.preset) ? scene.screen.preset
    : (soundsPreset(scene?.ambience) ?? (place ? PLACE_PRESET[place] : 'fog'))
  const shared = scene?.images?.find((i) => i.keeperOnly === false && has(i.src))?.src
  const image = has(scene?.screen?.image) ? scene.screen.image : (shared ?? null)
  const time = isTime(scene?.screen?.time) ? scene.screen.time : scene ? (timeFromText(scene.title, scene.id) ?? timeFromSounds(scene.ambience)) : null
  return { preset, image, sounds: (scene?.ambience ?? []).slice(0, 3), fire: asFire(scene?.screen?.fire), place, time }
}
