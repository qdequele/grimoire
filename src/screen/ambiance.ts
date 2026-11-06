// Ambiance screen, pure part: presets (what living layers a scene gets) and scene → ambiance.
// No DOM, no Supabase: shared by the keeper's game screen (which decides) and the screen (which draws).

export const PRESETS = ['fog', 'rain', 'candle', 'hearth', 'night', 'storm', 'dust'] as const
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
}

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
  particles: 'rain' | 'dust' | 'embers' | null
  /** Lightning flashes now and then. */
  lightning: boolean
  /** One pan-and-zoom pass, in seconds (alternates back and forth). */
  drift: number
  /** A live fire (flames, embers, its flickering light) at the scene's fire place. */
  fire: boolean
}

export const LOOKS: Record<PresetId, PresetLook> = {
  fog: { palette: ['#0b1114', '#22323a', '#5f7479'], fog: 0.85, grain: 0.07, vignette: 0.6, flicker: false, particles: null, lightning: false, drift: 110, fire: false },
  rain: { palette: ['#060b12', '#13263a', '#3d5a74'], fog: 0.35, grain: 0.06, vignette: 0.65, flicker: false, particles: 'rain', lightning: false, drift: 95, fire: false },
  candle: { palette: ['#0b0604', '#3b1d0b', '#a8621f'], fog: 0.15, grain: 0.08, vignette: 0.8, flicker: true, particles: 'embers', lightning: false, drift: 120, fire: false },
  hearth: { palette: ['#070302', '#2a0f05', '#8a3a10'], fog: 0.08, grain: 0.08, vignette: 0.8, flicker: false, particles: null, lightning: false, drift: 120, fire: true },
  night: { palette: ['#04050b', '#111933', '#34457a'], fog: 0.3, grain: 0.06, vignette: 0.75, flicker: false, particles: 'dust', lightning: false, drift: 120, fire: false },
  storm: { palette: ['#05060a', '#1a1d2a', '#4b5068'], fog: 0.45, grain: 0.07, vignette: 0.7, flicker: false, particles: 'rain', lightning: true, drift: 80, fire: false },
  dust: { palette: ['#0d0a06', '#3a2e1e', '#a08658'], fog: 0.2, grain: 0.1, vignette: 0.55, flicker: false, particles: 'dust', lightning: false, drift: 100, fire: false },
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

/** The preset a scene's ambience sounds suggest; fog when they say nothing. */
export function presetFromSounds(sounds: readonly string[] | undefined): PresetId {
  const set = new Set(sounds ?? [])
  return SOUND_RULES.find(([, ids]) => ids.some((id) => set.has(id)))?.[0] ?? 'fog'
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
  ambience?: string[]
  handouts?: string[]
  images?: Array<{ src: string; caption?: string; keeperOnly?: boolean }>
  screen?: { image?: string; preset?: string; fire?: unknown }
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
}

export const findScene = (story: StoryForScreen, sceneId: string | undefined): StoryScene | undefined =>
  sceneId ? story.acts.flatMap((a) => a.scenes).find((s) => s.id === sceneId) : undefined

/**
 * A scene's ambiance: its `screen` field first, then what its sounds and images say.
 * Only pictures the pack really has are used (`packFiles`), so a missing file never shows a broken image;
 * scene images are used only when marked `keeperOnly: false` (the spec's default keeps them from players).
 */
export function sceneAmbiance(story: StoryForScreen, sceneId: string | undefined, packFiles: readonly string[]): SceneAmbiance {
  const scene = findScene(story, sceneId)
  const files = new Set(packFiles)
  const has = (p: string | undefined): p is string => !!p && files.has(p)
  const preset = isPreset(scene?.screen?.preset) ? scene.screen.preset : presetFromSounds(scene?.ambience)
  const shared = scene?.images?.find((i) => i.keeperOnly === false && has(i.src))?.src
  const image = has(scene?.screen?.image) ? scene.screen.image : (shared ?? null)
  return { preset, image, sounds: (scene?.ambience ?? []).slice(0, 3), fire: asFire(scene?.screen?.fire) }
}
